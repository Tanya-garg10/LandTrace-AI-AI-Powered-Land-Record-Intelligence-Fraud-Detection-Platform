import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'landtrace-dev-secret-change-in-production';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar_url: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

const VALID_ROLES = new Set<UserRole>([
  'Citizen / Landowner',
  'Revenue Officer',
  'Document Verification Officer',
  'System Administrator',
]);

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = header.slice(7).trim();
  try {
    const decoded = verifyToken(token);
    if (!decoded || !VALID_ROLES.has(decoded.role)) {
      res.status(401).json({ error: 'Session schema updated. Please sign in again.' });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRoles(...allowed: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied for role "${req.user.role}". Required: ${allowed.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}
