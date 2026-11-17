import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  canWrite: boolean;
  canManageProperties: boolean;
  canVerifyDocuments: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const VALID_ROLES = new Set([
  'Citizen / Landowner',
  'Revenue Officer',
  'Document Verification Officer',
  'System Administrator',
]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: User }>('/api/auth/me');
      if (!data.user || !VALID_ROLES.has(data.user.role)) {
        setStoredToken(null);
        setUser(null);
      } else {
        setUser(data.user);
      }
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('landtrace:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('landtrace:unauthorized', handleUnauthorized);
  }, [loadMe]);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    const data = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      if (getStoredToken()) {
        await apiRequest('/api/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore logout error
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  };

  const canManageProperties = user?.role === 'System Administrator' || user?.role === 'Revenue Officer';
  const canVerifyDocuments = user?.role === 'System Administrator' || user?.role === 'Document Verification Officer';
  const canWrite =
    user?.role === 'System Administrator' ||
    user?.role === 'Revenue Officer' ||
    user?.role === 'Document Verification Officer';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        canWrite,
        canManageProperties,
        canVerifyDocuments,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
