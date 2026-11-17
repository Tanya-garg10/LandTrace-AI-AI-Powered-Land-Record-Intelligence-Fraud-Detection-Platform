import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Clock, MapPin, Plus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RiskScoreDisplay, VerificationStatusText } from '../../components/StatusText';
import { useToast } from '../../components/Toast';
import { apiRequest } from '../../lib/api';
import type { MutationRequest, OwnershipEvent, Property } from '../../types';

export interface RevenueOverviewData {
  role: string;
  kpis: {
    assigned_properties: number;
    pending_mutations: number;
    records_requiring_review: number;
    recent_ownership_changes: number;
  };
  charts: {
    mutation_breakdown: Array<{ name: string; count: number }>;
    verification_breakdown: Array<{ name: string; count: number }>;
  };
  assigned_properties: Property[];
  assigned_mutations: MutationRequest[];
  recent_ownership_changes: Array<OwnershipEvent & { district_name?: string; village?: string }>;
}

export function RevenueOfficerDashboard({
  data,
  onRefresh,
}: {
  data: RevenueOverviewData;
  onRefresh: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleQuickStatus = async (mutationRef: string, status: string, note: string) => {
    setUpdatingId(mutationRef);
    try {
      await apiRequest(`/api/mutations/${encodeURIComponent(mutationRef)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, admin_notes: note }),
      });
      notify(`${mutationRef} updated to ${status}.`, 'success');
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Status update failed.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">
            Revenue Officer Workspace
          </p>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27] mt-0.5">
            Land Operations Command
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Process mutation queues, verify circle parcel records, inspect GIS boundaries, and log ownership transitions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/workspace/map')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E4E7DF] hover:border-[#173F32] text-[#242B27] text-xs font-medium rounded-lg cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-[#398568]" />
            <span>GIS Parcel Explorer</span>
          </button>
          <button
            onClick={() => navigate('/workspace/properties?new=1')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Parcel</span>
          </button>
        </div>
      </div>

      {/* 4 Revenue Officer KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Properties', value: data.kpis.assigned_properties, note: 'Circle jurisdiction parcels', accent: '#173F32' },
          { label: 'Pending Mutation Requests', value: data.kpis.pending_mutations, note: 'Awaiting officer action', accent: '#C5831B' },
          { label: 'Records Requiring Review', value: data.kpis.records_requiring_review, note: 'Pending or flagged parcels', accent: '#D95B55' },
          { label: 'Recent Ownership Changes', value: data.kpis.recent_ownership_changes, note: 'Preserved transfer events', accent: '#398568' },
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

      {/* Mutation Review Queue + Mutation Status Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7DF] bg-[#FAFAF6] flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#242B27]">Mutation Review Queue</h2>
              <p className="text-[11px] text-[#616D66]">Take direct workflow action or inspect supporting documentation</p>
            </div>
            <Link to="/workspace/mutations" className="text-xs font-medium text-[#173F32] hover:underline">
              Full Queue
            </Link>
          </div>
          <div className="divide-y divide-[#EFF2EC]">
            {data.assigned_mutations.slice(0, 6).map((m) => (
              <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[#173F32]">{m.mutation_ref}</span>
                    <span className="text-[#9AA59E]">·</span>
                    <span className="font-mono text-[#242B27]">{m.parcel_id}</span>
                    <span className="text-[#9AA59E]">·</span>
                    <VerificationStatusText status={m.status} />
                  </div>
                  <p className="font-medium text-[#242B27] truncate">
                    {m.change_type}: {m.current_owner_snapshot} → {m.proposed_owner}
                  </p>
                  <p className="text-[11px] text-[#616D66] truncate">
                    {m.district_name} ({m.village}) · Assigned: {m.assigned_officer_name}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => void handleQuickStatus(m.mutation_ref, 'Under Review', 'Picked up by Revenue Officer for circle scrutiny.')}
                    disabled={updatingId === m.mutation_ref || m.status === 'Under Review'}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E4E7DF] hover:border-[#173F32] disabled:opacity-45 text-[11px] font-medium text-[#242B27] cursor-pointer"
                  >
                    <Clock className="w-3 h-3 text-[#C5831B]" />
                    <span>Review</span>
                  </button>
                  <button
                    onClick={() => void handleQuickStatus(m.mutation_ref, 'Approved', 'Approved by Revenue Officer after circle verification.')}
                    disabled={updatingId === m.mutation_ref || m.is_suspicious === 1}
                    title={m.is_suspicious === 1 ? 'Flagged cases require investigation clearance first' : 'Approve mutation'}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EAF0E9] hover:bg-[#173F32] text-[#173F32] hover:text-white disabled:opacity-45 text-[11px] font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E4E7DF] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#242B27]">Mutation Pipeline Distribution</h2>
            <p className="text-xs text-[#616D66] mt-0.5 mb-4">Active request counts across processing stages</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.mutation_breakdown} layout="vertical" margin={{ top: 4, right: 12, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFF2EC" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 11, fill: '#242B27' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E4E7DF', fontSize: 12 }} />
                <Bar dataKey="count" name="Requests" fill="#173F32" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Assigned Parcels & Recent Ownership Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7DF] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#242B27]">Assigned &amp; Review-Queue Parcels</h2>
            <Link to="/workspace/properties" className="text-xs font-medium text-[#173F32] hover:underline">
              All Properties
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E4E7DF] bg-[#FAFAF6] text-[11px] font-semibold text-[#616D66]">
                  <th className="py-2.5 px-4">Parcel</th>
                  <th className="py-2.5 px-4">Holder</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Risk</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF2EC]">
                {data.assigned_properties.slice(0, 6).map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAFAF6]">
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-semibold text-[#173F32] block">{p.parcel_id}</span>
                      <span className="text-[11px] text-[#616D66]">{p.survey_number} · {p.village}</span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[#242B27]">{p.current_owner}</td>
                    <td className="py-2.5 px-4">
                      <VerificationStatusText status={p.verification_status} />
                    </td>
                    <td className="py-2.5 px-4">
                      <RiskScoreDisplay score={p.risk_score} category={p.risk_category} />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(p.parcel_id)}`)}
                        className="inline-flex items-center gap-1 text-[#173F32] font-semibold hover:underline cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7DF] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#242B27]">Recent Ownership Changes</h2>
            <Link to="/workspace/timeline" className="text-xs font-medium text-[#173F32] hover:underline">
              History Ledger
            </Link>
          </div>
          <div className="divide-y divide-[#EFF2EC]">
            {data.recent_ownership_changes.slice(0, 6).map((ev) => (
              <button
                key={ev.id}
                onClick={() => navigate(`/workspace/timeline?parcel=${encodeURIComponent(ev.parcel_id)}`)}
                className="w-full text-left px-5 py-3 hover:bg-[#FAFAF6] text-xs cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-[#173F32]">{ev.parcel_id}</span>
                  <span className="font-mono text-[11px] text-[#616D66] tabular-nums">{ev.submitted_date}</span>
                </div>
                <p className="text-[#242B27] mt-0.5 truncate">
                  {ev.previous_owner} → <strong>{ev.new_owner}</strong>
                </p>
                <p className="text-[11px] text-[#616D66]">
                  {ev.change_type} · {ev.approval_status}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
