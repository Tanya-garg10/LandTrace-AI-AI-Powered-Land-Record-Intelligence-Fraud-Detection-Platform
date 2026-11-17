import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileCheck2,
  FileSearch,
  GitCompareArrows,
  Globe2,
  History,
  Layers,
  Lock,
  MapPin,
  ScanText,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';

interface HeroParcel {
  parcel_id: string;
  survey_number: string;
  village: string;
  district: string;
  owner: string;
  area: string;
  status: string;
  risk_score: number;
  risk_label: string;
  color: string;
  coords: string;
  labelX: number;
  labelY: number;
}

const HERO_PARCELS: HeroParcel[] = [
  {
    parcel_id: 'LT-PAR-1001',
    survey_number: 'SY-101/A',
    village: 'Paudwadi · Mulshi',
    district: 'Sahyadri Valley',
    owner: 'Anand Narayan Gokhale',
    area: '3,200 sq.m',
    status: 'Verified',
    risk_score: 12,
    risk_label: 'Low Risk',
    color: '#398568',
    coords: '110,95 235,82 260,185 130,205',
    labelX: 185,
    labelY: 145,
  },
  {
    parcel_id: 'LT-PAR-1004',
    survey_number: 'SY-408/B',
    village: 'Hinjewadi Phase I',
    district: 'Sahyadri Valley',
    owner: 'Rajeshwari Kulkarni',
    area: '2,450 sq.m',
    status: 'Pending Review',
    risk_score: 68,
    risk_label: 'High Variance Alert',
    color: '#E5A13A',
    coords: '245,84 395,98 410,205 268,187',
    labelX: 332,
    labelY: 145,
  },
  {
    parcel_id: 'LT-PAR-1005',
    survey_number: 'SY-512/A',
    village: 'Bavdhan Ridge',
    district: 'Sahyadri Valley',
    owner: 'Horizon Realty Holdings',
    area: '5,120 sq.m',
    status: 'Under Investigation',
    risk_score: 86,
    risk_label: 'Duplicate Survey Flag',
    color: '#D95B55',
    coords: '138,214 275,196 302,300 155,315',
    labelX: 222,
    labelY: 256,
  },
  {
    parcel_id: 'LT-PAR-1002',
    survey_number: 'SY-204/C',
    village: 'Lavale Creek',
    district: 'Sahyadri Valley',
    owner: 'Anand Narayan Gokhale',
    area: '1,850 sq.m',
    status: 'Verified',
    risk_score: 15,
    risk_label: 'Low Risk',
    color: '#398568',
    coords: '284,198 415,212 435,310 310,302',
    labelX: 360,
    labelY: 256,
  },
];

const PREVIEW_RECORDS = [
  { parcel: 'LT-PAR-1001', survey: 'SY-101/A', owner: 'Anand N. Gokhale', status: 'Verified', risk: 12, mutation: 'Approved · MUT-2026-404' },
  { parcel: 'LT-PAR-1004', survey: 'SY-408/B', owner: 'Rajeshwari Kulkarni', status: 'Pending Review', risk: 68, mutation: 'Submitted · MUT-2026-401' },
  { parcel: 'LT-PAR-1005', survey: 'SY-512/A', owner: 'Horizon Realty Holdings', status: 'Under Investigation', risk: 86, mutation: 'Flagged · MUT-2026-406' },
  { parcel: 'LT-PAR-1008', survey: 'SY-774/D', owner: 'Kaveri Precision Pvt Ltd', status: 'Flagged', risk: 74, mutation: 'Flagged · MUT-2026-407' },
];

const PROBLEM_CARDS = [
  {
    title: 'Fragmented Land Records',
    description: 'Property deeds, survey maps, and mutation registers remain isolated across disconnected ledgers and paper archives.',
  },
  {
    title: 'Difficult Ownership Tracking',
    description: 'Tracing multi-decade inheritance, partition, and conveyance lineage requires slow manual cross-referencing.',
  },
  {
    title: 'Unauthorized Modifications',
    description: 'Silent edits to ownership fields or overlapping survey claims can go undetected without cryptographic change logging.',
  },
  {
    title: 'Document Inconsistencies',
    description: 'Subtle mismatches in claimant names, extent measurements, or execution dates slip past overloaded manual desks.',
  },
  {
    title: 'Limited Transparency',
    description: 'Landowners and oversight teams lack real-time visibility into pending mutation steps and documentary review status.',
  },
];

const FEATURE_SHOWCASES = [
  {
    eyebrow: '01 · AI Document Intelligence',
    title: 'Compare uploaded deeds against registry records in seconds.',
    description:
      'Gemini structured extraction reads deeds, survey extracts, and mutation applications, then compares every field against baseline parcel records—highlighting matched values in emerald and variances in amber or red.',
    bullets: ['OCR & multimodal deed parsing', 'Field-level database vs. extract diffing', 'Preliminary human-in-the-loop review actions'],
    icon: FileCheck2,
    visualType: 'doc' as const,
  },
  {
    eyebrow: '02 · Ownership History',
    title: 'Append-only transfer lineage where nothing is ever overwritten.',
    description:
      'Every conveyance, inheritance, gift deed, and court partition is preserved chronologically with supporting document references and reviewing officer signatures.',
    bullets: ['Immutable historical transfer chain', 'Rapid churn & multi-transfer detection', 'Exportable lineage summaries'],
    icon: History,
    visualType: 'timeline' as const,
  },
  {
    eyebrow: '03 · Mutation Tracking',
    title: 'Structured 6-stage governance for every transfer request.',
    description:
      'Citizens submit transfer applications on their parcels, Revenue Officers manage circle case queues, and Verification Officers escalate flagged discrepancies with full status auditability.',
    bullets: ['Submitted → Review → Docs Required → Decision', 'Officer assignment & escalation notes', 'Real-time citizen application tracking'],
    icon: GitCompareArrows,
    visualType: 'mutation' as const,
  },
  {
    eyebrow: '04 · GIS Parcel Explorer',
    title: 'Spatial parcel boundaries linked directly to record status.',
    description:
      'Inspect interactive cadastral polygons, survey coordinates, district clustering, and risk overlays across synthetic districts without switching tools.',
    bullets: ['GeoJSON parcel boundary rendering', 'District & verification status filters', 'Direct drill-down into parcel dossier'],
    icon: MapPin,
    visualType: 'gis' as const,
  },
  {
    eyebrow: '05 · Risk Intelligence',
    title: 'Deterministic anomaly signals paired with explainable summaries.',
    description:
      'Automated heuristics scan for duplicate survey identifiers, document owner mismatches, abnormal plot area changes, and rapid ownership churn to prioritize human scrutiny.',
    bullets: ['Weighted 0–100 composite risk score', 'Evidence breakdown per triggered indicator', 'Advisory framing—never automated accusations'],
    icon: ShieldAlert,
    visualType: 'risk' as const,
  },
  {
    eyebrow: '06 · Tamper-Evident Audit Ledger',
    title: 'Cryptographic SHA-256 hash chaining on every state change.',
    description:
      'Every property creation, verification decision, and mutation status update hashes both the record payload and the preceding ledger block, exposing unauthorized database edits immediately.',
    bullets: ['Sequential cryptographic chain validation', 'Actor, timestamp & payload hash snapshots', 'One-click ledger integrity verification'],
    icon: Lock,
    visualType: 'audit' as const,
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload Document', desc: 'Submit deed scan, extract, or PDF inside parcel desk.' },
  { step: '02', title: 'AI Extraction', desc: 'OCR + Gemini model structure owner, survey, and area fields.' },
  { step: '03', title: 'Record Comparison', desc: 'Extracted values diffed against baseline parcel registry.' },
  { step: '04', title: 'Risk Assessment', desc: 'Deterministic indicators compute score & flag anomalies.' },
  { step: '05', title: 'Review & Audit Trail', desc: 'Officer approves or flags; SHA-256 ledger logs decision.' },
];

const TECH_STACK = [
  { name: 'Gemini AI', role: 'Structured JSON deed extraction & narrative explanations', icon: Cpu },
  { name: 'Python & FastAPI', role: 'Reference backend architecture for AI & OCR pipelines', icon: Globe2 },
  { name: 'React + TypeScript', role: 'Modular role-aware geospatial web application', icon: Layers },
  { name: 'PostgreSQL / SQLite', role: 'Relational parcel registry & ownership history schema', icon: Database },
  { name: 'OCR Engine', role: 'Multimodal & text extraction for deed instruments', icon: ScanText },
  { name: 'GIS & Leaflet', role: 'GeoJSON boundary overlays & survey spatial explorer', icon: MapPin },
  { name: 'SHA-256 Ledger', role: 'Append-only cryptographic hash chain integrity verification', icon: Lock },
  { name: 'RBAC Workspaces', role: 'Strict 4-role capability separation & audit logging', icon: ShieldCheck },
];

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedParcel, setSelectedParcel] = useState<HeroParcel>(HERO_PARCELS[1]);
  const [previewTab, setPreviewTab] = useState<'records' | 'timeline' | 'mutations'>('records');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#F8F9F5] text-[#242B27] selection:bg-[#173F32] selection:text-white">
      {/* 1. NAVBAR */}
      <header className="sticky top-0 z-40 bg-[#F8F9F5]/92 backdrop-blur-md border-b border-[#E4E7DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="shrink-0">
            <BrandLogo size="md" variant="dark" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#525E57]" aria-label="Marketing navigation">
            <button onClick={() => scrollToSection('platform-preview')} className="hover:text-[#173F32] transition-colors whitespace-nowrap shrink-0 cursor-pointer">
              Platform
            </button>
            <button onClick={() => scrollToSection('features')} className="hover:text-[#173F32] transition-colors whitespace-nowrap shrink-0 cursor-pointer">
              Features
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-[#173F32] transition-colors whitespace-nowrap shrink-0 cursor-pointer">
              How It Works
            </button>
            <button onClick={() => scrollToSection('technology')} className="hover:text-[#173F32] transition-colors whitespace-nowrap shrink-0 cursor-pointer">
              Technology
            </button>
            <button onClick={() => scrollToSection('about')} className="hover:text-[#173F32] transition-colors whitespace-nowrap shrink-0 cursor-pointer">
              About
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <>
                <Link
                  to="/workspaces"
                  className="text-[13px] font-medium text-[#242B27] hover:text-[#173F32] px-3 py-2 whitespace-nowrap shrink-0"
                >
                  Workspaces
                </Link>
                <Link
                  to="/workspace"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#173F32] hover:bg-[#113026] text-white text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Open Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="text-[13px] font-medium text-[#242B27] hover:text-[#173F32] px-3 py-2 whitespace-nowrap shrink-0"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#173F32] hover:bg-[#113026] text-white text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden border-b border-[#E4E7DF] bg-parcel-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#398568] font-semibold">
              AI-Powered Land Record Intelligence
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-[#173F32] leading-[1.08]">
              Every Parcel Has a Story.
              <br />
              Every Change Leaves a Trace.
            </h1>
            <p className="text-base text-[#525E57] leading-relaxed max-w-xl">
              Bring transparency, intelligence and trust to land records. Track ownership changes, verify documents and
              identify suspicious modifications with AI-powered land intelligence.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => scrollToSection('platform-preview')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#173F32] hover:bg-[#113026] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <span>Explore Platform</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate(user ? '/workspaces' : '/auth')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white border border-[#D4DBD0] hover:border-[#173F32] text-[#242B27] text-sm font-semibold transition-colors cursor-pointer"
              >
                <span>{user ? 'Choose Workspace' : 'Sign In'}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#E4E7DF] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#616D66]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#398568]" />
                Gemini Structured Extraction
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#398568]" />
                SHA-256 Integrity Chain
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#398568]" />
                4-Role Governance Sandbox
              </span>
            </div>
          </div>

          {/* Interactive Geospatial Cadastral Map Visual */}
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl border border-[#D4DBD0] bg-[#173F32] overflow-hidden shadow-xl">
              <div className="relative h-[420px] sm:h-[460px]">
                <img
                  src="/src/assets/images/hero_cadastral_terrain_1794898756200.jpg"
                  alt="Interactive geospatial topographic parcel intelligence map"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-55 mix-blend-luminosity"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle at 65% 40%, rgba(57,133,104,0.22), rgba(19,48,38,0.88) 78%)',
                  }}
                />

                {/* Top Telemetry Strip inside Map */}
                <div className="relative z-10 px-4 py-3 border-b border-white/15 bg-[#123127]/75 backdrop-blur-sm flex items-center justify-between text-[11px] text-[#DCE6DF]">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="w-2 h-2 rounded-full bg-[#5BB995]" />
                    <span>SAHYADRI VALLEY · CADASTRAL LAYER SV-01</span>
                  </div>
                  <span className="text-[#C4A36A] font-medium">Click a parcel boundary to inspect</span>
                </div>

                {/* Interactive SVG Parcel Boundary Overlay */}
                <svg viewBox="0 0 540 360" className="relative z-10 w-full h-[355px]" role="img" aria-label="Interactive land parcel boundaries">
                  {/* Subtle Topographic Grid Lines */}
                  <g stroke="rgba(234,240,233,0.08)" strokeWidth="1">
                    <line x1="0" y1="80" x2="540" y2="80" />
                    <line x1="0" y1="160" x2="540" y2="160" />
                    <line x1="0" y1="240" x2="540" y2="240" />
                    <line x1="120" y1="0" x2="120" y2="360" />
                    <line x1="260" y1="0" x2="260" y2="360" />
                    <line x1="400" y1="0" x2="400" y2="360" />
                  </g>

                  {HERO_PARCELS.map((p) => {
                    const isActive = selectedParcel.parcel_id === p.parcel_id;
                    return (
                      <g
                        key={p.parcel_id}
                        onClick={() => setSelectedParcel(p)}
                        className="cursor-pointer transition-opacity"
                      >
                        <polygon
                          points={p.coords}
                          fill={p.color}
                          fillOpacity={isActive ? 0.38 : 0.16}
                          stroke={isActive ? '#FAFAF6' : p.color}
                          strokeWidth={isActive ? 2.5 : 1.5}
                        />
                        <circle cx={p.labelX} cy={p.labelY - 14} r={isActive ? 4.5 : 3} fill="#C4A36A" />
                        <text
                          x={p.labelX}
                          y={p.labelY + 2}
                          textAnchor="middle"
                          fill="#FAFAF6"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="600"
                        >
                          {p.parcel_id}
                        </text>
                        <text
                          x={p.labelX}
                          y={p.labelY + 15}
                          textAnchor="middle"
                          fill="#DCE6DF"
                          fontSize="9"
                          fontFamily="Inter, sans-serif"
                        >
                          {p.survey_number}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Floating Property Information Panel */}
                <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:w-80 z-20 bg-[#FAFAF6]/96 backdrop-blur-md border border-[#E4E7DF] rounded-xl p-4 shadow-lg text-[#242B27]">
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#E4E7DF]">
                    <div>
                      <p className="font-mono text-xs font-bold text-[#173F32]">{selectedParcel.parcel_id}</p>
                      <p className="text-[11px] text-[#616D66] mt-0.5">
                        {selectedParcel.survey_number} · {selectedParcel.village}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        selectedParcel.risk_score >= 60
                          ? 'text-[#D95B55]'
                          : selectedParcel.risk_score >= 40
                          ? 'text-[#C5831B]'
                          : 'text-[#398568]'
                      }`}
                    >
                      Risk {selectedParcel.risk_score}/100
                    </span>
                  </div>
                  <div className="pt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[#616D66] block">Registered Holder</span>
                      <span className="font-semibold text-[#242B27] truncate block">{selectedParcel.owner}</span>
                    </div>
                    <div>
                      <span className="text-[#616D66] block">Extent &amp; Status</span>
                      <span className="font-semibold text-[#242B27] tabular-nums block">
                        {selectedParcel.area} · {selectedParcel.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#EFF2EC] flex items-center justify-between text-[11px]">
                    <span className="text-[#616D66]">{selectedParcel.risk_label}</span>
                    <button
                      onClick={() => navigate(user ? '/workspace' : '/auth')}
                      className="font-semibold text-[#173F32] hover:underline cursor-pointer"
                    >
                      Inspect in Workspace →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TRUST / PLATFORM PREVIEW */}
      <section id="platform-preview" className="py-16 lg:py-24 bg-white border-b border-[#E4E7DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">
                Platform Preview · Illustrative Demo Data
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#242B27] mt-2">
                Unified visibility across parcels, mutations, and AI verification.
              </h2>
            </div>
            <p className="text-xs text-[#616D66] max-w-xs">
              All metrics and parcel identifiers shown below represent synthetic demo data designed for workflow demonstration.
            </p>
          </div>

          {/* Interactive Preview Window */}
          <div className="rounded-2xl border border-[#E4E7DF] bg-[#FAFAF6] overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 bg-white border-b border-[#E4E7DF] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold text-[#173F32]">DEMO SANDBOX</span>
                <span className="text-[#9AA59E]">·</span>
                <span className="text-[#616D66]">Illustrative Registry Snapshot (25 Synthetic Parcels)</span>
              </div>
              <div className="flex items-center gap-1 bg-[#FAFAF6] p-1 rounded-lg border border-[#E4E7DF]">
                {[
                  { id: 'records', label: 'Property Records' },
                  { id: 'timeline', label: 'Ownership Timeline' },
                  { id: 'mutations', label: 'Mutation & Risk' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPreviewTab(tab.id as 'records' | 'timeline' | 'mutations')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      previewTab === tab.id ? 'bg-[#173F32] text-white' : 'text-[#616D66] hover:text-[#242B27]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Demo Parcels Tracked', value: '25', note: '5 synthetic districts' },
                  { label: 'Verified Baseline Records', value: '14', note: 'Illustrative demo count' },
                  { label: 'Active Mutation Queue', value: '8', note: 'Across 6 lifecycle stages' },
                  { label: 'Flagged Variance Alerts', value: '5', note: 'Requiring officer review' },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white border border-[#E4E7DF] rounded-xl p-4">
                    <p className="text-[11px] font-medium text-[#616D66]">{kpi.label}</p>
                    <p className="font-display text-2xl font-bold text-[#242B27] tabular-nums mt-1">{kpi.value}</p>
                    <p className="text-[11px] text-[#616D66] mt-0.5">{kpi.note}</p>
                  </div>
                ))}
              </div>

              {previewTab === 'records' && (
                <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E4E7DF] bg-[#FAFAF6] text-[11px] font-semibold text-[#616D66]">
                        <th className="py-3 px-4">Parcel ID</th>
                        <th className="py-3 px-4">Survey</th>
                        <th className="py-3 px-4">Registered Holder</th>
                        <th className="py-3 px-4">Verification Status</th>
                        <th className="py-3 px-4">Risk Indicator</th>
                        <th className="py-3 px-4">Mutation Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFF2EC]">
                      {PREVIEW_RECORDS.map((row) => (
                        <tr key={row.parcel}>
                          <td className="py-3 px-4 font-mono font-semibold text-[#173F32]">{row.parcel}</td>
                          <td className="py-3 px-4 font-mono text-[#616D66]">{row.survey}</td>
                          <td className="py-3 px-4 font-medium text-[#242B27]">{row.owner}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-medium ${
                                row.status === 'Verified'
                                  ? 'text-[#398568]'
                                  : row.status === 'Pending Review'
                                  ? 'text-[#C5831B]'
                                  : 'text-[#D95B55]'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold tabular-nums">
                            <span className={row.risk >= 60 ? 'text-[#D95B55]' : 'text-[#398568]'}>{row.risk}/100</span>
                          </td>
                          <td className="py-3 px-4 text-[#616D66]">{row.mutation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previewTab === 'timeline' && (
                <div className="bg-white border border-[#E4E7DF] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[#173F32]">LT-PAR-1004 · Append-Only Ownership Lineage</span>
                    <span className="text-[#616D66]">Prior records remain preserved</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { date: '2016-06-18', title: 'Initial Title Grant', desc: 'State Allotment → Mohanrao Kulkarni · Approved' },
                      { date: '2022-03-11', title: 'Registered Inheritance', desc: 'Mohanrao Kulkarni → Rajeshwari Kulkarni · Approved' },
                      { date: '2026-11-10', title: 'Pending Family Transfer', desc: 'Claimant deed variance flagged for officer review' },
                    ].map((ev) => (
                      <div key={ev.date} className="p-4 rounded-xl bg-[#FAFAF6] border border-[#E4E7DF] space-y-1">
                        <span className="font-mono text-[11px] text-[#398568] font-semibold">{ev.date}</span>
                        <p className="text-xs font-semibold text-[#242B27]">{ev.title}</p>
                        <p className="text-xs text-[#616D66]">{ev.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewTab === 'mutations' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-[#E4E7DF] rounded-xl p-5 space-y-2">
                    <p className="font-mono text-xs font-semibold text-[#D95B55]">LT-PAR-1005 · Duplicate Survey Alert (86/100)</p>
                    <p className="text-xs text-[#242B27]">
                      Survey identifier SY-512/A appears across two distinct parcels in Sahyadri Valley, triggering automatic scrutiny hold.
                    </p>
                  </div>
                  <div className="bg-white border border-[#E4E7DF] rounded-xl p-5 space-y-2">
                    <p className="font-mono text-xs font-semibold text-[#C5831B]">LT-PAR-1004 · Document Owner Mismatch (68/100)</p>
                    <p className="text-xs text-[#242B27]">
                      Uploaded deed lists claimant Suresh Kulkarni while registry records Rajeshwari Kulkarni. Sent to Document Verification Desk.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE PROBLEM */}
      <section id="problem" className="py-16 lg:py-24 bg-[#F8F9F5] border-b border-[#E4E7DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#C4A36A] font-semibold">The Challenge</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#242B27] mt-2">
              Why traditional property record systems struggle to detect anomalies early.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
            {PROBLEM_CARDS.map((item, idx) => (
              <div key={item.title} className="bg-white border border-[#E4E7DF] rounded-xl p-5 flex flex-col justify-between space-y-4">
                <span className="font-mono text-xs font-semibold text-[#9AA59E] tabular-nums">0{idx + 1}</span>
                <div>
                  <h3 className="font-display text-sm font-bold text-[#242B27]">{item.title}</h3>
                  <p className="text-xs text-[#616D66] mt-2 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. THE SOLUTION */}
      <section id="solution" className="py-16 lg:py-24 bg-[#173F32] text-white border-b border-[#113026]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#C4A36A] font-semibold">
              Connected Land Intelligence
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              One verifiable ecosystem connecting landowners, revenue officers, verification desks, and auditors.
            </h2>
            <p className="text-sm text-[#DCE6DF] leading-relaxed">
              LandTrace AI unifies geospatial parcel boundaries, structured AI deed analysis, append-only ownership lineage,
              and cryptographic audit trails—giving every stakeholder a workspace tailored strictly to their mandate.
            </p>
          </div>
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { role: 'Citizen / Landowner', desc: 'Track your parcels, inspect ownership lineage, submit mutation requests, and download reports.' },
              { role: 'Revenue Officer', desc: 'Manage assigned parcels, evaluate mutation queues, and append verified ownership changes.' },
              { role: 'Verification Officer', desc: 'Inspect side-by-side OCR deeds, review Gemini diffs, and issue formal review decisions.' },
              { role: 'System Administrator', desc: 'Oversee district analytics, manage user workspaces, and verify SHA-256 ledger integrity.' },
            ].map((card) => (
              <div key={card.role} className="p-5 rounded-xl bg-white/8 border border-white/15 space-y-1.5">
                <p className="font-display text-sm font-bold text-[#FAFAF6]">{card.role}</p>
                <p className="text-xs text-[#C8DBD3] leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FEATURE SHOWCASE */}
      <section id="features" className="py-16 lg:py-24 bg-[#F8F9F5] border-b border-[#E4E7DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">Core Modules</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#242B27] mt-2">
              Six integrated intelligence modules built for clarity and accountability.
            </h2>
          </div>

          <div className="space-y-12">
            {FEATURE_SHOWCASES.map((feat, idx) => {
              const Icon = feat.icon;
              const reverse = idx % 2 === 1;
              return (
                <div
                  key={feat.title}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-[#E4E7DF] rounded-2xl p-6 sm:p-8"
                >
                  <div className={`lg:col-span-6 space-y-4 ${reverse ? 'lg:order-2' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#EAF0E9] flex items-center justify-center">
                        <Icon className="w-4 h-4 text-[#173F32]" />
                      </div>
                      <span className="font-mono text-xs font-semibold text-[#398568]">{feat.eyebrow}</span>
                    </div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-[#242B27]">{feat.title}</h3>
                    <p className="text-sm text-[#525E57] leading-relaxed">{feat.description}</p>
                    <ul className="space-y-2 pt-1">
                      {feat.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-xs text-[#242B27]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#398568] shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`lg:col-span-6 ${reverse ? 'lg:order-1' : ''}`}>
                    <div className="rounded-xl bg-[#FAFAF6] border border-[#E4E7DF] p-5 space-y-3 text-xs">
                      {feat.visualType === 'doc' && (
                        <>
                          <div className="flex justify-between font-mono text-[11px] text-[#616D66]">
                            <span>DOC-2026-A109 · LT-PAR-1004</span>
                            <span className="text-[#D95B55] font-semibold">1 Variance Detected</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between p-2.5 bg-white border border-[#E4E7DF] rounded-lg">
                              <span className="text-[#616D66]">Survey Number</span>
                              <span className="font-mono font-semibold text-[#398568]">SY-408/B · Matched</span>
                            </div>
                            <div className="flex justify-between p-2.5 bg-[#FDF4F4] border border-[#F5C6C4] rounded-lg">
                              <span className="text-[#242B27] font-medium">Owner Name</span>
                              <span className="font-semibold text-[#D95B55]">Suresh vs. Rajeshwari · Mismatch</span>
                            </div>
                          </div>
                        </>
                      )}
                      {feat.visualType === 'timeline' && (
                        <div className="space-y-2.5">
                          <div className="p-3 bg-white border border-[#E4E7DF] rounded-lg flex justify-between">
                            <span className="font-semibold">2014 · Initial Allotment</span>
                            <span className="font-mono text-[#398568]">Preserved</span>
                          </div>
                          <div className="p-3 bg-white border border-[#E4E7DF] rounded-lg flex justify-between">
                            <span className="font-semibold">2021 · Registered Sale</span>
                            <span className="font-mono text-[#398568]">Preserved</span>
                          </div>
                          <div className="p-3 bg-[#EAF0E9]/60 border border-[#C8DBD3] rounded-lg flex justify-between">
                            <span className="font-semibold text-[#173F32]">2026 · Mutation Review</span>
                            <span className="font-mono text-[#C5831B]">Appended</span>
                          </div>
                        </div>
                      )}
                      {feat.visualType === 'mutation' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] font-mono text-[#616D66]">
                            <span>MUT-2026-402 · LT-PAR-1003</span>
                            <span className="text-[#C5831B] font-semibold">Under Review</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center pt-1">
                            <div className="p-2.5 bg-white border border-[#E4E7DF] rounded-lg">Submitted</div>
                            <div className="p-2.5 bg-[#173F32] text-white rounded-lg font-semibold">Officer Review</div>
                            <div className="p-2.5 bg-white border border-[#E4E7DF] rounded-lg text-[#616D66]">Audit Logged</div>
                          </div>
                        </div>
                      )}
                      {feat.visualType === 'gis' && (
                        <div className="space-y-2">
                          <div className="flex justify-between font-mono text-[11px] text-[#616D66]">
                            <span>GeoJSON Cadastral Layer</span>
                            <span className="text-[#173F32] font-semibold">5 Districts Mapped</span>
                          </div>
                          <div className="h-28 rounded-lg bg-[#EAF0E9] border border-[#C8DBD3] flex items-center justify-center font-mono text-[11px] text-[#173F32]">
                            Polygon SY-101/A · 18.5204° N, 73.8567° E
                          </div>
                        </div>
                      )}
                      {feat.visualType === 'risk' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-[#242B27]">Composite Anomaly Indicators</span>
                            <span className="font-mono font-bold text-[#D95B55] tabular-nums">86 / 100</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#E4E7DF] overflow-hidden">
                            <div className="h-full bg-[#D95B55] w-[86%]" />
                          </div>
                          <p className="text-[11px] text-[#616D66]">
                            Triggers: Duplicate Survey Claim (+40) · Open Flagged Mutation (+25) · Area Delta (+21)
                          </p>
                        </div>
                      )}
                      {feat.visualType === 'audit' && (
                        <div className="space-y-2 font-mono text-[11px]">
                          <div className="p-2.5 bg-white border border-[#E4E7DF] rounded-lg truncate">
                            EVT-0041 · prev: 4f8a92c1... → curr: 9b21e0d7...
                          </div>
                          <div className="p-2.5 bg-[#EAF0E9]/60 border border-[#C8DBD3] rounded-lg text-[#173F32] font-semibold">
                            SHA-256 Chain Status: VERIFIED (0 broken links)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. HOW IT WORKS */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-white border-b border-[#E4E7DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">Workflow</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#242B27] mt-2">
              From document upload to cryptographic audit trail in five traceable steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {HOW_IT_WORKS.map((item, idx) => (
              <div key={item.step} className="relative bg-[#FAFAF6] border border-[#E4E7DF] rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#173F32]">{item.step}</span>
                  {idx < HOW_IT_WORKS.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-[#9AA59E] hidden md:block" />}
                </div>
                <h3 className="font-display text-sm font-bold text-[#242B27]">{item.title}</h3>
                <p className="text-xs text-[#616D66] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. TECHNOLOGY SECTION */}
      <section id="technology" className="py-16 lg:py-24 bg-[#F8F9F5] border-b border-[#E4E7DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">Architecture</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#242B27] mt-2">
                Engineered for practical deployment, structured AI, and cryptographic verifiability.
              </h2>
            </div>
            <p className="text-xs text-[#616D66] max-w-sm">
              Interactive demo runtime runs live via Node/Express + SQLite WAL with live Gemini API integration and PostgreSQL-compatible schemas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TECH_STACK.map((tech) => {
              const Icon = tech.icon;
              return (
                <div key={tech.name} className="bg-white border border-[#E4E7DF] rounded-xl p-5 space-y-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EAF0E9] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#173F32]" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#242B27]">{tech.name}</h3>
                  <p className="text-xs text-[#616D66] leading-relaxed">{tech.role}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. IMPACT SECTION */}
      <section id="about" className="py-16 lg:py-24 bg-white border-b border-[#E4E7DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-4">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">Governance Impact</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#242B27]">
              Designed to assist human decision-makers—never replace legal oversight.
            </h2>
            <p className="text-sm text-[#525E57] leading-relaxed">
              LandTrace AI accelerates preliminary document scrutiny while preserving human authority. Every AI flag is
              paired with field-level evidence and clear uncertainty notes, and no indicator is presented as conclusive
              proof of fraud or legal title.
            </p>
          </div>
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Record Transparency', desc: 'Clear parcel histories and application statuses reduce information asymmetry for landowners.' },
              { title: 'End-to-End Traceability', desc: 'Append-only ownership records and SHA-256 chains preserve every state transition.' },
              { title: 'Faster Preliminary Review', desc: 'Automated field comparisons help verification officers focus attention on mismatched deeds.' },
              { title: 'Proactive Monitoring', desc: 'Deterministic duplicate-survey and churn checks surface anomalies before final approval.' },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl bg-[#FAFAF6] border border-[#E4E7DF] space-y-1.5">
                <h3 className="font-display text-sm font-bold text-[#173F32]">{item.title}</h3>
                <p className="text-xs text-[#616D66] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer className="bg-[#173F32] text-[#DCE6DF] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-3">
              <BrandLogo size="md" variant="light" showTagline />
              <p className="text-xs text-[#B5C9BF] max-w-md leading-relaxed">
                An independent synthetic demonstration platform for AI-assisted land record intelligence, document
                consistency analysis, and tamper-evident audit logging. Does not connect to official government registries.
              </p>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-display font-semibold text-white">Platform</p>
              <button onClick={() => scrollToSection('features')} className="block hover:text-white cursor-pointer">
                Intelligence Modules
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="block hover:text-white cursor-pointer">
                Verification Workflow
              </button>
              <button onClick={() => scrollToSection('technology')} className="block hover:text-white cursor-pointer">
                Technology Stack
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-display font-semibold text-white">Access</p>
              <Link to="/auth" className="block hover:text-white">
                Sign In to Workspace
              </Link>
              <Link to="/auth?mode=register" className="block hover:text-white">
                Create Citizen Account
              </Link>
              <Link to="/workspaces" className="block hover:text-white">
                Role Selection Directory
              </Link>
            </div>
          </div>

          <div className="pt-6 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-[#B5C9BF]">
            <span>LandTrace AI · Synthetic GeoTech &amp; GovTech Demonstration Platform</span>
            <span>Advisory analysis only — not legally conclusive proof of ownership</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
