import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { BrandLogo } from '../components/BrandMark';
import { ModalDialog } from '../components/SlideDrawer';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

const DEMO_ACCOUNTS = [
  {
    role: 'Citizen / Landowner',
    email: 'citizen@landtrace.demo',
    pass: 'Citizen@123',
    scope: 'View owned parcels, submit mutations, upload deeds, download reports',
  },
  {
    role: 'Revenue Officer',
    email: 'revenue@landtrace.demo',
    pass: 'Revenue@123',
    scope: 'Assigned properties, mutation review queue, ownership record updates',
  },
  {
    role: 'Document Verification Officer',
    email: 'officer@landtrace.demo',
    pass: 'Officer@123',
    scope: 'Split-screen OCR comparison desk, AI analysis & formal review decisions',
  },
  {
    role: 'System Administrator',
    email: 'admin@landtrace.demo',
    pass: 'Admin@123',
    scope: 'System command center, user governance, analytics & SHA-256 ledger',
  },
];

export function AuthPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('officer@landtrace.demo');
  const [password, setPassword] = useState('Officer@123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  useEffect(() => {
    if (searchParams.get('mode') === 'register') {
      setMode('register');
      setEmail('');
      setPassword('');
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      navigate('/workspaces', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setSubmitting(false);
          return;
        }
        await register(name.trim(), email.trim(), password);
      }
      navigate('/workspaces', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setForgotMessage(res.message);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Request failed.');
    }
  };

  const handleDemoFill = async (demoEmail: string, demoPass: string) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
    setSubmitting(true);
    try {
      await login(demoEmail, demoPass);
      navigate('/workspaces', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF6] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Brand & Topographic Cadastral Panel */}
      <div className="lg:col-span-5 bg-[#173F32] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
        <img
          src="/src/assets/images/hero_cadastral_terrain_1794898756200.jpg"
          alt="Topographic land intelligence terrain"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none"
        />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <BrandLogo size="lg" variant="light" />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-[#DCE6DF] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Website</span>
            </Link>
          </div>

          <div className="pt-8 space-y-4 max-w-md">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#C4A36A] font-semibold">
              Verified Access Portal
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Trust begins with verified records.
            </h1>
            <p className="text-sm text-[#DCE6DF] leading-relaxed">
              Access your dedicated LandTrace AI workspace to verify property deeds, track ownership lineage, review
              mutation applications, or audit cryptographic record integrity.
            </p>
          </div>

          <div className="pt-4 space-y-3 text-xs text-[#DCE6DF]">
            {[
              'Role-scoped workspaces tailored to Citizen, Revenue, Verification & Admin workflows',
              'Gemini AI deed extraction with field-by-field discrepancy checks',
              'Tamper-evident SHA-256 hash chain across every record change',
            ].map((point) => (
              <div key={point} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#5BB995] shrink-0 mt-0.5" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-10 pt-5 border-t border-white/15 text-[11px] text-[#B5C9BF] leading-relaxed">
          Self-registered accounts are strictly provisioned as <strong className="text-white">Citizen / Landowner</strong>.
          Privileged official workspaces require authorized credentials. Synthetic demo data only.
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#242B27]">
                {mode === 'login' ? 'Welcome back' : 'Create your Citizen account'}
              </h2>
              <p className="text-xs text-[#616D66] mt-1">
                {mode === 'login'
                  ? 'Sign in to proceed to workspace role selection.'
                  : 'Register a Citizen / Landowner workspace to track parcels and applications.'}
              </p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 p-1 rounded-lg bg-[#EAF0E9]/60 border border-[#E4E7DF]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login' ? 'bg-white text-[#173F32] shadow-xs' : 'text-[#616D66] hover:text-[#242B27]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                if (email.endsWith('@landtrace.demo')) {
                  setEmail('');
                  setPassword('');
                }
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register' ? 'bg-white text-[#173F32] shadow-xs' : 'text-[#616D66] hover:text-[#242B27]'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="bg-white border border-[#E4E7DF] rounded-2xl p-6 shadow-xs space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#242B27] mb-1.5">Full Legal Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vikram Kulkarni"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32] focus:bg-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#242B27] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[#242B27]">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotMessage('');
                      setForgotError('');
                      setForgotOpen(true);
                    }}
                    className="text-[11px] font-medium text-[#173F32] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 6 characters' : 'Enter your password'}
                  required
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#616D66] hover:text-[#242B27] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'login' ? (
              <label className="flex items-center gap-2 text-xs text-[#616D66] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#D4DBD0] text-[#173F32] focus:ring-[#173F32]"
                />
                <span>Remember session on this device</span>
              </label>
            ) : (
              <div className="p-3 rounded-lg bg-[#EAF0E9]/60 border border-[#C8DBD3] text-[11px] text-[#173F32] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  New accounts are provisioned strictly with <strong>Citizen / Landowner</strong> access and cannot self-grant official roles.
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F5C6C4] text-xs text-[#B83B35]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-[#173F32] hover:bg-[#113026] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {submitting
                ? mode === 'login'
                  ? 'Signing In...'
                  : 'Provisioning Citizen Account...'
                : mode === 'login'
                ? 'Sign In'
                : 'Create Citizen Account'}
            </button>
          </form>

          {/* Controlled Demo Credentials Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#616D66]">
              <span className="font-semibold text-[#242B27] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#398568]" />
                Demo Role Quick Access
              </span>
              <span className="text-[11px]">Click any role to sign in</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => void handleDemoFill(acc.email, acc.pass)}
                  className="text-left p-3 rounded-xl bg-white border border-[#E4E7DF] hover:border-[#173F32] hover:bg-[#EAF0E9]/30 transition-all cursor-pointer"
                >
                  <p className="text-xs font-semibold text-[#242B27]">{acc.role}</p>
                  <p className="font-mono text-[11px] text-[#398568] mt-0.5 truncate">{acc.email}</p>
                  <p className="text-[11px] text-[#616D66] mt-1 line-clamp-2 leading-snug">{acc.scope}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ModalDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Account Password"
        subtitle="Enter your registered email address to request a reset link."
      >
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#242B27] mb-1.5">Email Address</label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              placeholder="you@domain.com"
              className="w-full px-3.5 py-2 text-sm bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
            />
          </div>
          {forgotError && <p className="text-xs text-[#D95B55]">{forgotError}</p>}
          {forgotMessage && (
            <div className="p-3 rounded-lg bg-[#EAF0E9] border border-[#C8DBD3] text-xs text-[#173F32]">
              {forgotMessage}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="px-4 py-2 text-xs font-medium text-[#616D66] hover:text-[#242B27] cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Send Reset Request
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
