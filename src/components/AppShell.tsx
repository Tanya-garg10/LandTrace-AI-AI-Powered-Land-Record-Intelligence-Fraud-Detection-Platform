import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  FileCheck2,
  FileSpreadsheet,
  GitCompareArrows,
  Globe,
  HelpCircle,
  History,
  Landmark,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { NotificationItem, UserRole } from '../types';
import { BrandLogo } from './BrandMark';
import { ModalDialog } from './SlideDrawer';

interface NavConfigItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const ROLE_NAV_MAP: Record<UserRole, NavConfigItem[]> = {
  'Citizen / Landowner': [
    { to: '/workspace', label: 'My Overview', icon: LayoutDashboard },
    { to: '/workspace/properties', label: 'My Properties', icon: Landmark },
    { to: '/workspace/map', label: 'Location Map', icon: MapPin },
    { to: '/workspace/timeline', label: 'Ownership History', icon: History },
    { to: '/workspace/mutations', label: 'My Applications', icon: GitCompareArrows },
    { to: '/workspace/documents', label: 'Upload Documents', icon: FileCheck2 },
    { to: '/workspace/reports', label: 'Verification Reports', icon: FileSpreadsheet },
  ],
  'Revenue Officer': [
    { to: '/workspace', label: 'Operations Command', icon: LayoutDashboard },
    { to: '/workspace/properties', label: 'Property Records', icon: Landmark },
    { to: '/workspace/map', label: 'GIS Parcel Explorer', icon: MapPin },
    { to: '/workspace/mutations', label: 'Mutation Queue', icon: GitCompareArrows },
    { to: '/workspace/timeline', label: 'Ownership History', icon: History },
    { to: '/workspace/risk', label: 'Risk Intelligence', icon: ShieldAlert },
    { to: '/workspace/reports', label: 'Case Reports', icon: FileSpreadsheet },
  ],
  'Document Verification Officer': [
    { to: '/workspace', label: 'Verification Desk', icon: LayoutDashboard },
    { to: '/workspace/documents', label: 'Document Intelligence', icon: FileCheck2 },
    { to: '/workspace/mutations', label: 'Mutation Scrutiny', icon: GitCompareArrows },
    { to: '/workspace/risk', label: 'Risk Intelligence', icon: ShieldAlert },
    { to: '/workspace/properties', label: 'Property Lookup', icon: Landmark },
    { to: '/workspace/reports', label: 'Reports', icon: FileSpreadsheet },
  ],
  'System Administrator': [
    { to: '/workspace', label: 'System Command', icon: LayoutDashboard },
    { to: '/workspace/map', label: 'GIS Parcel Explorer', icon: MapPin },
    { to: '/workspace/properties', label: 'Property Registry', icon: Landmark },
    { to: '/workspace/documents', label: 'AI Verification', icon: FileCheck2 },
    { to: '/workspace/timeline', label: 'Ownership History', icon: History },
    { to: '/workspace/mutations', label: 'Mutation Activity', icon: GitCompareArrows },
    { to: '/workspace/risk', label: 'Risk Monitor', icon: ShieldAlert },
    { to: '/workspace/audit', label: 'Integrity Ledger', icon: Lock },
    { to: '/workspace/reports', label: 'Reports', icon: FileSpreadsheet },
    { to: '/workspace/admin', label: 'Users & Settings', icon: Settings },
  ],
};

const ROUTE_TITLES: Record<string, string> = {
  '/workspace': 'Workspace Overview',
  '/workspace/map': 'GIS Parcel Explorer',
  '/workspace/properties': 'Property Records',
  '/workspace/documents': 'Document Intelligence',
  '/workspace/timeline': 'Ownership History',
  '/workspace/mutations': 'Mutation Requests',
  '/workspace/risk': 'Risk Intelligence',
  '/workspace/audit': 'Integrity Ledger',
  '/workspace/reports': 'Verification Reports',
  '/workspace/admin': 'System Governance & Settings',
};

interface SearchResults {
  properties: Array<{ id: number; parcel_id: string; survey_number: string; current_owner: string; district_name: string }>;
  mutations: Array<{ id: number; mutation_ref: string; parcel_id: string; proposed_owner: string; status: string }>;
  reports: Array<{ id: number; report_ref: string; parcel_id: string; risk_score: number; risk_category: string }>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      const data = await apiRequest<{ notifications?: NotificationItem[]; unread_count?: number }>('/api/notifications');
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unread_count === 'number' ? data.unread_count : 0);
    } catch {
      // ignore silent refresh error
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`);
        setSearchResults(res);
        setSearchOpen(true);
      } catch {
        // ignore search error
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
    await loadNotifications();
  };

  const markOneRead = async (id: number, parcelId: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifOpen(false);
    await loadNotifications();
    if (parcelId) navigate(`/workspace/properties?parcel=${encodeURIComponent(parcelId)}`);
  };

  const navItems = (user && ROLE_NAV_MAP[user.role]) || [];
  const currentTitle = ROUTE_TITLES[location.pathname] || 'Workspace';

  const SidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E4E7DF] select-none">
      <div className="px-5 h-16 border-b border-[#E4E7DF] flex items-center justify-between">
        <Link to="/workspace">
          <BrandLogo size="md" variant="dark" />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Workspace navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/workspace'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#EAF0E9] text-[#173F32] font-semibold'
                    : 'text-[#525E57] hover:bg-[#FAFAF6] hover:text-[#242B27]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#173F32]"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#173F32]' : 'text-[#6D7972]'}`} />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#E4E7DF] bg-[#FAFAF6] space-y-2">
        <div>
          <p className="text-[11px] font-semibold text-[#173F32]">{user?.role}</p>
          <p className="text-[11px] text-[#616D66] mt-0.5 leading-relaxed">
            Synthetic demo dataset · Advisory intelligence only, not legal proof of title.
          </p>
        </div>
        <button
          onClick={() => navigate('/workspaces')}
          className="w-full py-1.5 px-2.5 rounded-lg bg-white border border-[#E4E7DF] hover:border-[#173F32] text-[11px] font-medium text-[#242B27] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Layers className="w-3 h-3 text-[#398568]" />
          <span>Switch Role Workspace</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF6] text-[#242B27] flex">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">{SidebarContent}</aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-[#242B27]/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-64 h-full">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 p-1.5 text-[#616D66] hover:text-[#242B27] cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E4E7DF] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#242B27] hover:bg-[#FAFAF6] border border-[#E4E7DF] cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-[#616D66] min-w-0">
              <span className="hidden sm:inline whitespace-nowrap font-medium">{user?.role}</span>
              <ChevronRight className="w-3.5 h-3.5 hidden sm:inline shrink-0 text-[#9AA59E]" />
              <span className="font-display font-semibold text-[#242B27] truncate text-sm">{currentTitle}</span>
            </div>
          </div>

          {/* Right: Search + Notifications + Help + Profile */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search by Parcel ID or Owner */}
            <div ref={searchRef} className="relative hidden md:block w-72">
              <Search className="w-3.5 h-3.5 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                placeholder="Search Parcel ID, Survey, or Owner..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg text-[#242B27] placeholder-[#7B8680] focus:outline-none focus:border-[#173F32] focus:bg-white transition-colors"
              />
              {searchOpen && searchResults && (
                <div className="absolute right-0 mt-2 w-96 bg-white border border-[#E4E7DF] rounded-xl shadow-xl overflow-hidden z-40">
                  <div className="max-h-96 overflow-y-auto divide-y divide-[#EFF2EC]">
                    {searchResults.properties.length === 0 &&
                    searchResults.mutations.length === 0 &&
                    searchResults.reports.length === 0 ? (
                      <div className="p-4 text-xs text-[#616D66] text-center">No matching records in your workspace scope.</div>
                    ) : (
                      <>
                        {searchResults.properties.length > 0 && (
                          <div className="p-2">
                            <p className="px-2 py-1 text-[11px] font-semibold text-[#616D66]">Properties</p>
                            {searchResults.properties.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/workspace/properties?parcel=${encodeURIComponent(p.parcel_id)}`);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#EAF0E9]/60 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-[#242B27] truncate">{p.current_owner}</p>
                                  <p className="text-[11px] text-[#616D66] truncate">
                                    {p.survey_number} · {p.district_name}
                                  </p>
                                </div>
                                <span className="font-mono text-[11px] font-semibold text-[#173F32] shrink-0">
                                  {p.parcel_id}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.mutations.length > 0 && (
                          <div className="p-2">
                            <p className="px-2 py-1 text-[11px] font-semibold text-[#616D66]">Mutation Requests</p>
                            {searchResults.mutations.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => {
                                  setSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/workspace/mutations?ref=${encodeURIComponent(m.mutation_ref)}`);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#EAF0E9]/60 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-[#242B27] truncate">{m.proposed_owner}</p>
                                  <p className="text-[11px] text-[#616D66] truncate">
                                    {m.parcel_id} · {m.status}
                                  </p>
                                </div>
                                <span className="font-mono text-[11px] text-[#616D66] shrink-0">{m.mutation_ref}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.reports.length > 0 && (
                          <div className="p-2">
                            <p className="px-2 py-1 text-[11px] font-semibold text-[#616D66]">Reports</p>
                            {searchResults.reports.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => {
                                  setSearchOpen(false);
                                  setSearchQuery('');
                                  navigate(`/workspace/reports?ref=${encodeURIComponent(r.report_ref)}`);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#EAF0E9]/60 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <span className="font-mono text-xs font-medium text-[#173F32]">{r.report_ref}</span>
                                <span className="text-[11px] text-[#616D66]">
                                  {r.parcel_id} · Risk {r.risk_score}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Center */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg border border-[#E4E7DF] bg-white text-[#242B27] hover:bg-[#FAFAF6] transition-colors cursor-pointer"
                aria-label="Notification center"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#D95B55] text-white text-[10px] font-display font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E4E7DF] rounded-xl shadow-xl z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E4E7DF] flex items-center justify-between bg-[#FAFAF6]">
                    <span className="text-xs font-semibold text-[#242B27]">Notification Center</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => void markAllRead()}
                        className="text-[11px] font-medium text-[#173F32] hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#EFF2EC]">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-xs text-[#616D66] text-center">No notifications.</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => void markOneRead(n.id, n.parcel_id)}
                          className={`w-full text-left px-4 py-3 hover:bg-[#FAFAF6] transition-colors cursor-pointer ${
                            n.is_read === 0 ? 'bg-[#EAF0E9]/35' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold text-[#242B27]">{n.title}</span>
                            <span
                              className={`text-[10px] font-medium ${
                                n.severity === 'critical'
                                  ? 'text-[#D95B55]'
                                  : n.severity === 'warning'
                                  ? 'text-[#C5831B]'
                                  : 'text-[#398568]'
                              }`}
                            >
                              {n.severity === 'critical' ? 'Critical' : n.severity === 'warning' ? 'Warning' : 'Notice'}
                            </span>
                          </div>
                          <p className="text-xs text-[#616D66] leading-snug">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Help Center */}
            <button
              onClick={() => setHelpOpen(true)}
              className="p-2 rounded-lg border border-[#E4E7DF] bg-white text-[#242B27] hover:bg-[#FAFAF6] transition-colors cursor-pointer"
              aria-label="Platform Help"
              title="Platform Guide & Demo Scope"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* User Profile */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-lg border border-[#E4E7DF] bg-white hover:bg-[#FAFAF6] transition-colors cursor-pointer"
              >
                <img
                  src={user?.avatar_url || '/src/assets/images/avatar_admin_director_1794895343634.jpg'}
                  alt={user?.name || 'User avatar'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-md object-cover border border-[#E4E7DF]"
                />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-[#242B27] leading-none">{user?.name}</p>
                  <p className="text-[11px] text-[#616D66] mt-0.5 leading-none">{user?.role}</p>
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E4E7DF] rounded-xl shadow-xl z-40 overflow-hidden">
                  <div className="p-4 border-b border-[#E4E7DF] bg-[#FAFAF6]">
                    <p className="text-xs font-semibold text-[#242B27]">{user?.name}</p>
                    <p className="text-[11px] text-[#616D66] mt-0.5">{user?.email}</p>
                    <p className="text-[11px] text-[#173F32] font-medium mt-1">
                      {user?.role}
                    </p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/workspaces');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#242B27] hover:bg-[#FAFAF6] rounded-lg transition-colors cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#398568]" />
                      <span>Switch Workspace</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#242B27] hover:bg-[#FAFAF6] rounded-lg transition-colors cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5 text-[#616D66]" />
                      <span>Public Marketing Website</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        void logout().then(() => navigate('/auth'));
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#D95B55] hover:bg-[#FDF2F2] rounded-lg transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>

      {/* Help Modal */}
      <ModalDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="LandTrace AI — Workspace Guide"
        subtitle="Every Parcel Has a Story. Every Change Leaves a Trace."
      >
        <div className="space-y-4 text-xs text-[#616D66] leading-relaxed">
          <div className="p-3.5 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg space-y-1">
            <p className="font-semibold text-[#242B27]">Role-Scoped Workspace ({user?.role})</p>
            <p>
              Navigation and operational tools are filtered strictly to your active role: Citizens manage their own
              parcels and transfer applications; Revenue Officers handle parcel records and mutation queues; Document
              Verification Officers inspect OCR diffs and issue formal review decisions; System Administrators govern
              users, analytics, and the SHA-256 ledger.
            </p>
          </div>
          <div className="p-3.5 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg space-y-1">
            <p className="font-semibold text-[#242B27]">Signature Evaluation Workflow</p>
            <p>
              Open <span className="font-medium text-[#173F32]">Document Intelligence</span> and test the demo mismatch
              deed on <span className="font-mono">LT-PAR-1004</span> to observe Gemini structured extraction, mismatch
              detection, risk scoring, human review decisions, and SHA-256 ledger recording.
            </p>
          </div>
          <p className="text-[11px]">
            Notice: All records and GIS coordinates are synthetic demo data. AI risk indicators support human review
            and do not constitute legal proof of ownership.
          </p>
        </div>
      </ModalDialog>
    </div>
  );
}
