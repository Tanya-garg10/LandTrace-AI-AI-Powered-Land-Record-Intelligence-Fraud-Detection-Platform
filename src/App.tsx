import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { AppShell } from './components/AppShell';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { WorkspaceSelectPage } from './pages/WorkspaceSelectPage';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { RiskPage } from './pages/RiskPage';
import { TimelinePage } from './pages/TimelinePage';
import { MutationsPage } from './pages/MutationsPage';
import { AuditPage } from './pages/AuditPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import type { UserRole } from './types';

function ProtectedWorkspace({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] flex items-center justify-center text-xs text-[#616D66]">
        Initializing LandTrace AI Workspace...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return <AppShell>{children}</AppShell>;
}

function RoleRoute({ allowed, children }: { allowed: UserRole[]; children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/workspace" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Phase 1: Public Marketing Website */}
            <Route path="/" element={<LandingPage />} />

            {/* Phase 2: Split-Screen Authentication */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<AuthPage />} />

            {/* Phase 3: Role Selection Hub */}
            <Route path="/workspaces" element={<WorkspaceSelectPage />} />

            {/* Phase 4: Role-Specific Workspaces */}
            <Route
              path="/workspace"
              element={
                <ProtectedWorkspace>
                  <DashboardPage />
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/map"
              element={
                <ProtectedWorkspace>
                  <RoleRoute
                    allowed={[
                      'Citizen / Landowner',
                      'Revenue Officer',
                      'System Administrator',
                    ]}
                  >
                    <MapPage />
                  </RoleRoute>
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/properties"
              element={
                <ProtectedWorkspace>
                  <PropertiesPage />
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/documents"
              element={
                <ProtectedWorkspace>
                  <RoleRoute
                    allowed={[
                      'Citizen / Landowner',
                      'Document Verification Officer',
                      'System Administrator',
                    ]}
                  >
                    <DocumentsPage />
                  </RoleRoute>
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/risk"
              element={
                <ProtectedWorkspace>
                  <RoleRoute
                    allowed={[
                      'Revenue Officer',
                      'Document Verification Officer',
                      'System Administrator',
                    ]}
                  >
                    <RiskPage />
                  </RoleRoute>
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/timeline"
              element={
                <ProtectedWorkspace>
                  <RoleRoute
                    allowed={[
                      'Citizen / Landowner',
                      'Revenue Officer',
                      'System Administrator',
                    ]}
                  >
                    <TimelinePage />
                  </RoleRoute>
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/mutations"
              element={
                <ProtectedWorkspace>
                  <MutationsPage />
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/audit"
              element={
                <ProtectedWorkspace>
                  <RoleRoute allowed={['System Administrator']}>
                    <AuditPage />
                  </RoleRoute>
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/reports"
              element={
                <ProtectedWorkspace>
                  <ReportsPage />
                </ProtectedWorkspace>
              }
            />
            <Route
              path="/workspace/admin"
              element={
                <ProtectedWorkspace>
                  <RoleRoute allowed={['System Administrator']}>
                    <AdminPage />
                  </RoleRoute>
                </ProtectedWorkspace>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
