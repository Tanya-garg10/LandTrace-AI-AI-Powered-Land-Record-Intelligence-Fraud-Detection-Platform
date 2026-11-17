import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileCheck2,
  Home,
  Landmark,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandMark';
import { ModalDialog } from '../components/SlideDrawer';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface WorkspaceRoleCard {
  role: UserRole;
  title: string;
  tagline: string;
  description: string;
  capabilities: string[];
  icon: typeof Home;
  demoEmail: string;
  demoPass: string;
  avatar: string;
}

const WORKSPACES: WorkspaceRoleCard[] = [
  {
    role: 'Citizen / Landowner',
    title: 'Citizen / Landowner',
    tagline: 'Your Land. Your Records. Your Control.',
    description: 'View registered property records, inspect ownership history, submit mutation applications, and download reports.',
    capabilities: ['My Properties & Location Map', 'Submit Mutation Request', 'Upload Verification Deeds', 'Download Verification Reports'],
    icon: Home,
    demoEmail: 'citizen@landtrace.demo',
    demoPass: 'Citizen@123',
    avatar: '/src/assets/images/avatar_citizen_landowner_1794898755585.jpg',
  },
  {
    role: 'Revenue Officer',
    title: 'Revenue Officer',
    tagline: 'Land Operations Command.',
    description: 'Manage assigned parcels, inspect GIS boundaries, process mutation review queues, and append ownership records.',
    capabilities: ['Assigned Case Queue', 'Mutation Review & Processing', 'GIS Parcel Explorer', 'Ownership Record Management'],
    icon: Landmark,
    demoEmail: 'revenue@landtrace.demo',
    demoPass: 'Revenue@123',
    avatar: '/src/assets/images/avatar_revenue_officer_1794898756576.jpg',
  },
  {
    role: 'Document Verification Officer',
    title: 'Document Verification Officer',
    tagline: 'Document Intelligence & Verification Desk.',
    description: 'Scrutinize uploaded deeds side-by-side against Gemini OCR extractions and issue formal human review decisions.',
    capabilities: ['Split-Screen OCR Deed Desk', 'Green / Amber / Red Field Diffs', 'Approve, Clarify, or Flag Review', 'Preliminary AI Risk Scoring'],
    icon: FileCheck2,
    demoEmail: 'officer@landtrace.demo',
    demoPass: 'Officer@123',
    avatar: '/src/assets/images/avatar_verification_officer_1794895344663.jpg',
  },
  {
    role: 'System Administrator',
    title: 'System Administrator',
    tagline: 'LandTrace System Command Center.',
    description: 'Oversee district registries, monitor global risk intelligence, manage user accounts, and verify SHA-256 audit integrity.',
    capabilities: ['User & Role Governance', 'Global Risk & District Analytics', 'Tamper-Evident Audit Ledger', 'Platform Configuration'],
    icon: ShieldCheck,
    demoEmail: 'admin@landtrace.demo',
    demoPass: 'Admin@123',
    avatar: '/src/assets/images/avatar_admin_director_1794895343634.jpg',
  },
];

export function WorkspaceSelectPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [switchTarget, setSwitchTarget] = useState<WorkspaceRoleCard | null>(null);
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [switching, setSwitching] = useState(false);

  const handleAccess = (card: WorkspaceRoleCard) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (user.role === card.role) {
      navigate('/workspace');
      return;
    }
    // Enforce RBAC boundary: switching to another role requires authenticating with that role's credentials
    setAuthPass(card.demoPass);
    setAuthError('');
    setSwitchTarget(card);
  };

  const handleConfirmSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchTarget) return;
    setSwitching(true);
    setAuthError('');
    try {
      await login(switchTarget.demoEmail, authPass);
      setSwitchTarget(null);
      navigate('/workspace');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Credential verification failed.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#242B27] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#E4E7DF] px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/">
          <BrandLogo size="md" variant="dark" />
        </Link>
        <div className="flex items-center gap-4 text-xs">
          {user && (
            <div className="hidden sm:flex items-center gap-2.5">
              <img
                src={user.avatar_url || '/src/assets/images/avatar_citizen_landowner_1794898755585.jpg'}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-md object-cover border border-[#E4E7DF]"
              />
              <div className="text-left">
                <p className="font-semibold text-[#242B27] leading-none">{user.name}</p>
                <p className="text-[11px] text-[#398568] mt-0.5 leading-none">{user.role}</p>
              </div>
            </div>
          )}
          {user ? (
            <button
              onClick={() => void logout().then(() => navigate('/auth'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E7DF] text-[#616D66] hover:text-[#D95B55] hover:border-[#F5C6C4] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <Link
              to="/auth"
              className="px-4 py-2 rounded-lg bg-[#173F32] text-white font-semibold hover:bg-[#113026]"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">
              Role-Based Access Control
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#242B27]">
              Choose Your Workspace
            </h1>
            <p className="text-sm text-[#525E57]">
              Your role determines the tools, records and actions available in your workspace.
            </p>
          </div>
          {user && (
            <div className="p-3.5 rounded-xl bg-white border border-[#E4E7DF] text-xs max-w-sm">
              <p className="font-semibold text-[#242B27]">
                Active Session: <span className="text-[#173F32]">{user.role}</span>
              </p>
              <p className="text-[11px] text-[#616D66] mt-0.5">
                RBAC strictly isolates elevated workspaces. Switching to another role requires authenticating with that role&apos;s credentials.
              </p>
            </div>
          )}
        </div>

        {/* 4 Large Workspace Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {WORKSPACES.map((card) => {
            const Icon = card.icon;
            const isCurrentRole = user?.role === card.role;

            return (
              <div
                key={card.role}
                className={`group rounded-2xl border p-6 sm:p-7 flex flex-col justify-between transition-all ${
                  isCurrentRole
                    ? 'bg-white border-[#173F32] shadow-md'
                    : 'bg-white border-[#E4E7DF] hover:border-[#398568] hover:shadow-sm'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isCurrentRole ? 'bg-[#173F32] text-white' : 'bg-[#EAF0E9] text-[#173F32]'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="font-display text-lg font-bold text-[#242B27]">{card.title}</h2>
                        <p className="text-xs font-medium text-[#398568]">{card.tagline}</p>
                      </div>
                    </div>
                    <img
                      src={card.avatar}
                      alt={card.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover border border-[#E4E7DF] shrink-0"
                    />
                  </div>

                  <p className="text-xs text-[#525E57] leading-relaxed">{card.description}</p>

                  <div className="pt-2 border-t border-[#EFF2EC] grid grid-cols-2 gap-2">
                    {card.capabilities.map((cap) => (
                      <div key={cap} className="text-[11px] text-[#242B27] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#398568] shrink-0" />
                        <span className="truncate">{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#EFF2EC] flex items-center justify-between gap-3">
                  <div className="text-[11px]">
                    {isCurrentRole ? (
                      <span className="font-semibold text-[#398568]">Active Authorized Workspace</span>
                    ) : (
                      <span className="text-[#616D66] flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Requires {card.role} credentials</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleAccess(card)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isCurrentRole
                        ? 'bg-[#173F32] hover:bg-[#113026] text-white'
                        : 'bg-[#EAF0E9] hover:bg-[#173F32] text-[#173F32] hover:text-white'
                    }`}
                  >
                    <span>{isCurrentRole ? 'Access Workspace' : 'Authenticate & Enter'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Controlled Credential Verification Modal for Role Switching */}
      <ModalDialog
        open={Boolean(switchTarget)}
        onClose={() => setSwitchTarget(null)}
        title={`Authenticate for ${switchTarget?.title || ''}`}
        subtitle="Users cannot self-elevate permissions. Sign in with authorized demo credentials to inspect this workspace."
      >
        {switchTarget && (
          <form onSubmit={handleConfirmSwitch} className="space-y-4">
            <div className="p-3.5 rounded-lg bg-[#FAFAF6] border border-[#E4E7DF] text-xs space-y-1">
              <p className="font-semibold text-[#242B27]">Role Security Policy</p>
              <p className="text-[#616D66]">
                Your current session ({user?.role}) does not hold <strong className="text-[#242B27]">{switchTarget.role}</strong> privileges.
                Authenticate with the controlled demo credential below to switch sessions.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B27] mb-1">Authorized Email</label>
              <input
                type="email"
                readOnly
                value={switchTarget.demoEmail}
                className="w-full px-3.5 py-2 text-xs font-mono bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg text-[#616D66]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#242B27] mb-1">Password</label>
              <input
                type="password"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-sm bg-white border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
              />
              <p className="text-[11px] text-[#616D66] mt-1 font-mono">Demo credential: {switchTarget.demoPass}</p>
            </div>

            {authError && <p className="text-xs text-[#D95B55]">{authError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSwitchTarget(null)}
                className="px-4 py-2 text-xs font-medium text-[#616D66] hover:text-[#242B27] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={switching}
                className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {switching ? 'Verifying...' : 'Access Workspace'}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
}
