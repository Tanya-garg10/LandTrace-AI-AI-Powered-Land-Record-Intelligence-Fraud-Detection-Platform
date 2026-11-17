import { Link, useNavigate } from 'react-router-dom';
import { Lock, Settings, ShieldCheck } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RiskScoreDisplay, VerificationStatusText } from '../../components/StatusText';
import type { Property } from '../../types';

export interface AdminOverviewData {
  role: string;
  kpis: {
    total_properties: number;
    verified_records: number;
    pending_mutations: number;
    flagged_records: number;
    documents_analyzed: number;
    reports_count: number;
    system_activity: number;
    active_users: number;
  };
  charts: {
    verification_breakdown: Array<{ name: string; count: number }>;
    risk_distribution: Array<{ name: string; count: number }>;
    mutation_breakdown: Array<{ name: string; count: number }>;
    district_summary: Array<{ district: string; total: number; verified: number; high_risk: number }>;
    ownership_activity: Array<{ period: string; transfers: number; approved: number; scrutinized: number }>;
  };
  high_risk_records: Array<
    Pick<
      Property,
      'parcel_id' | 'survey_number' | 'district_name' | 'village' | 'current_owner' | 'verification_status' | 'risk_score' | 'risk_category'
    >
  >;
  recent_reports: Array<{
    id: number;
    report_ref: string;
    parcel_id: string;
    risk_score: number;
    risk_category: string;
    ai_explanation: string;
    current_owner: string;
    district_name: string;
    created_at: string;
  }>;
  recent_activity: Array<{
    event_id: string;
    parcel_id: string;
    action: string;
    actor_name: string;
    actor_role: string;
    current_ledger_hash: string;
    created_at: string;
  }>;
  audit_integrity: {
    status: 'VERIFIED' | 'TAMPER_DETECTED';
    total_entries: number;
    verified_entries: number;
    broken_links: number;
  };
}

export function AdminDashboard({ data }: { data: AdminOverviewData }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">
            System Administrator Governance
          </p>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27] mt-0.5">
            LandTrace System Command Center
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Global registry oversight, user &amp; role governance, risk intelligence, and SHA-256 ledger integrity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/workspace/audit')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E4E7DF] hover:border-[#173F32] text-[#242B27] text-xs font-medium rounded-lg cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#398568]" />
            <span>Audit Integrity Ledger</span>
          </button>
          <button
            onClick={() => navigate('/workspace/admin')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Users &amp; Settings</span>
          </button>
        </div>
      </div>

      {/* 5 System Command KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Demo Properties', value: data.kpis.total_properties, note: 'Across 5 districts', accent: '#173F32' },
          { label: 'Verified Records', value: data.kpis.verified_records, note: 'Consistent baseline', accent: '#398568' },
          { label: 'Pending Reviews', value: data.kpis.pending_mutations, note: 'Active mutation queue', accent: '#C5831B' },
          { label: 'Flagged Records', value: data.kpis.flagged_records, note: 'High / Critical alerts', accent: '#D95B55' },
          { label: 'System Activity', value: data.kpis.system_activity, note: `${data.kpis.active_users} active accounts`, accent: '#242B27' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-[#E4E7DF] rounded-xl p-5">
            <p className="text-xs font-medium text-[#616D66]">{kpi.label}</p>
            <p className="font-display text-3xl font-bold tracking-tight tabular-nums mt-2" style={{ color: kpi.accent }}>
              {kpi.value}
            </p>
            <p className="text-[11px] text-[#616D66] mt-1">{kpi.note}</p>
          </div>
        ))}
      </div>

      {/* Tamper-Evident Ledger Banner */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#EAF0E9] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#173F32]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#242B27]">
              Tamper-Evident Audit Chain:{' '}
              <span className={data.audit_integrity.status === 'VERIFIED' ? 'text-[#398568]' : 'text-[#D95B55]'}>
                {data.audit_integrity.status === 'VERIFIED' ? 'Verified Intact' : 'Tampering Detected'}
              </span>
            </p>
            <p className="text-[11px] text-[#616D66] mt-0.5 tabular-nums">
              {data.audit_integrity.verified_entries} of {data.audit_integrity.total_entries} SHA-256 hash links validated ·{' '}
              {data.audit_integrity.broken_links} broken links
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/workspace/audit')}
          className="px-3.5 py-2 rounded-lg bg-[#EAF0E9] hover:bg-[#173F32] text-[#173F32] hover:text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
        >
          Inspect Hash Ledger
        </button>
      </div>

      {/* District Overview Chart + Global Risk Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#242B27]">District Registry Overview</h2>
              <p className="text-xs text-[#616D66]">Total vs. verified vs. flagged parcels across regions</p>
            </div>
            <Link to="/workspace/properties" className="text-xs font-medium text-[#173F32] hover:underline">
              Registry
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.district_summary} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFF2EC" vertical={false} />
                <XAxis dataKey="district" tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E4E7DF', fontSize: 12 }} />
                <Bar dataKey="total" name="Total Parcels" fill="#173F32" radius={[4, 4, 0, 0]} />
                <Bar dataKey="verified" name="Verified" fill="#398568" radius={[4, 4, 0, 0]} />
                <Bar dataKey="high_risk" name="High Risk" fill="#D95B55" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#E4E7DF] flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#242B27]">Global Risk Monitor</h2>
              <p className="text-xs text-[#616D66]">Parcels prioritized for oversight</p>
            </div>
            <Link to="/workspace/risk" className="text-xs font-medium text-[#173F32] hover:underline">
              Risk Engine
            </Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E4E7DF] bg-[#FAFAF6] text-[11px] font-semibold text-[#616D66]">
                  <th className="py-2.5 px-4">Parcel</th>
                  <th className="py-2.5 px-4">Holder</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Risk Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF2EC]">
                {data.high_risk_records.map((r) => (
                  <tr
                    key={r.parcel_id}
                    onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(r.parcel_id)}`)}
                    className="hover:bg-[#FAFAF6] cursor-pointer"
                  >
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-semibold text-[#173F32] block">{r.parcel_id}</span>
                      <span className="text-[11px] text-[#616D66]">{r.district_name}</span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[#242B27]">{r.current_owner}</td>
                    <td className="py-2.5 px-4">
                      <VerificationStatusText status={r.verification_status} />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <RiskScoreDisplay score={r.risk_score} category={r.risk_category} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ownership & Transfer Activity + Recent System Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#242B27]">Ownership Transfer Activity</h2>
              <p className="text-xs text-[#616D66]">Approved vs. scrutinized ownership events by year</p>
            </div>
            <Link to="/workspace/timeline" className="text-xs font-medium text-[#173F32] hover:underline">
              Ownership Ledger
            </Link>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts.ownership_activity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFF2EC" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E4E7DF', fontSize: 12 }} />
                <Area type="monotone" dataKey="approved" name="Approved" stroke="#398568" fill="#EAF0E9" strokeWidth={2} />
                <Area type="monotone" dataKey="scrutinized" name="Under Scrutiny" stroke="#D95B55" fill="#FDF2F2" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E7DF] flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#242B27]">Recent System Activity</h2>
              <p className="text-xs text-[#616D66]">Latest SHA-256 logged governance events</p>
            </div>
            <Link to="/workspace/audit" className="text-xs font-medium text-[#173F32] hover:underline">
              Full Audit Log
            </Link>
          </div>
          <div className="divide-y divide-[#EFF2EC]">
            {data.recent_activity.slice(0, 6).map((item) => (
              <div key={item.event_id} className="px-6 py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[#173F32]">{item.event_id}</span>
                    <span className="text-[#9AA59E]">·</span>
                    <span className="font-mono text-[#616D66]">{item.parcel_id}</span>
                  </div>
                  <p className="text-[#242B27] truncate mt-0.5">{item.action}</p>
                  <p className="text-[11px] text-[#616D66] truncate">
                    {item.actor_name} ({item.actor_role})
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[#616D66] shrink-0">
                  {item.current_ledger_hash.slice(0, 10)}...
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
