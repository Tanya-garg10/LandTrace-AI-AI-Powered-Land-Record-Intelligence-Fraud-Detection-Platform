import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Download,
  FileUp,
  GitCompareArrows,
  History,
  MapPin,
  Plus,
} from 'lucide-react';
import { ModalDialog } from '../../components/SlideDrawer';
import { RiskScoreDisplay, VerificationStatusText } from '../../components/StatusText';
import { useToast } from '../../components/Toast';
import { apiRequest, downloadWithAuth } from '../../lib/api';
import type { MutationRequest, NotificationItem, OwnershipEvent, Property, VerificationReport } from '../../types';

export interface CitizenOverviewData {
  role: string;
  kpis: {
    my_properties: number;
    verified_records: number;
    pending_applications: number;
    recent_updates: number;
    reports_count: number;
  };
  my_properties: Property[];
  my_mutations: MutationRequest[];
  my_reports: VerificationReport[];
  recent_ownership_updates: OwnershipEvent[];
  recent_notifications: NotificationItem[];
}

export function CitizenDashboard({
  data,
  onRefresh,
}: {
  data: CitizenOverviewData;
  onRefresh: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [mutationModalOpen, setMutationModalOpen] = useState(false);
  const [parcelId, setParcelId] = useState(data.my_properties[0]?.parcel_id || '');
  const [proposedOwner, setProposedOwner] = useState('');
  const [changeType, setChangeType] = useState('Family Transfer');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleMutationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcelId || !proposedOwner.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest('/api/mutations', {
        method: 'POST',
        body: JSON.stringify({
          parcel_id: parcelId,
          proposed_owner: proposedOwner.trim(),
          change_type: changeType,
          admin_notes: notes.trim() || 'Submitted via Citizen Portal',
        }),
      });
      notify('Mutation application submitted to Revenue Officer queue.', 'success');
      setMutationModalOpen(false);
      setProposedOwner('');
      setNotes('');
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#398568] font-semibold">
            Citizen / Landowner Portal
          </p>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27] mt-0.5">
            Your Land. Your Records. Your Control.
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Track your registered parcels, inspect ownership lineage, submit transfer applications, and download verification reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/workspace/documents')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E4E7DF] hover:border-[#173F32] text-[#242B27] text-xs font-medium rounded-lg cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5 text-[#398568]" />
            <span>Upload Land Document</span>
          </button>
          <button
            onClick={() => {
              setParcelId(data.my_properties[0]?.parcel_id || '');
              setMutationModalOpen(true);
            }}
            disabled={data.my_properties.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#173F32] hover:bg-[#113026] disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Submit Mutation Request</span>
          </button>
        </div>
      </div>

      {/* 4 Citizen KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Properties', value: data.kpis.my_properties, note: 'Registered in your workspace', accent: '#173F32' },
          { label: 'Verified Records', value: data.kpis.verified_records, note: 'Consistent with baseline', accent: '#398568' },
          { label: 'Pending Applications', value: data.kpis.pending_applications, note: 'Active mutation reviews', accent: '#C5831B' },
          { label: 'Recent Updates', value: data.kpis.recent_updates, note: 'Timeline & alert notices', accent: '#242B27' },
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

      {/* My Properties Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#242B27]">My Registered Properties</h2>
            <p className="text-xs text-[#616D66]">Select any parcel to inspect boundaries, ownership timeline, or documents</p>
          </div>
          <button
            onClick={() => navigate('/workspace/map')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#173F32] hover:underline cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Open Parcel Location Map</span>
          </button>
        </div>

        {data.my_properties.length === 0 ? (
          <div className="bg-white border border-[#E4E7DF] rounded-xl p-8 text-center text-xs text-[#616D66]">
            No parcels are currently linked to this self-registered account. Sign in with the Citizen demo account (<span className="font-mono">citizen@landtrace.demo</span>) to inspect 4 pre-linked parcels.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.my_properties.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-[#E4E7DF] hover:border-[#398568] rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#173F32]">{p.parcel_id}</span>
                      <span className="text-[#9AA59E]">·</span>
                      <span className="font-mono text-xs text-[#616D66]">{p.survey_number}</span>
                    </div>
                    <p className="text-xs text-[#616D66] mt-1">
                      {p.village}, {p.tehsil} · {p.district_name}
                    </p>
                  </div>
                  <VerificationStatusText status={p.verification_status} />
                </div>

                <div className="grid grid-cols-3 gap-3 py-3 border-y border-[#EFF2EC] text-xs">
                  <div>
                    <span className="text-[11px] text-[#616D66] block">Land Area</span>
                    <span className="font-semibold text-[#242B27] tabular-nums">{p.land_area_display}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#616D66] block">Classification</span>
                    <span className="font-semibold text-[#242B27]">{p.land_type}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#616D66] block">Risk Indicator</span>
                    <RiskScoreDisplay score={p.risk_score} category={p.risk_category} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => navigate(`/workspace/timeline?parcel=${encodeURIComponent(p.parcel_id)}`)}
                    className="inline-flex items-center gap-1 text-[#525E57] hover:text-[#173F32] font-medium cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Ownership History</span>
                  </button>
                  <button
                    onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(p.parcel_id)}`)}
                    className="inline-flex items-center gap-1 text-[#173F32] font-semibold hover:underline cursor-pointer"
                  >
                    <span>View Parcel Details</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Tracking & Verification Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Track Application Status */}
        <div className="lg:col-span-7 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7DF] flex items-center justify-between bg-[#FAFAF6]">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#242B27]">Track Application Status</h2>
              <p className="text-[11px] text-[#616D66]">Your mutation &amp; transfer requests</p>
            </div>
            <button
              onClick={() => navigate('/workspace/mutations')}
              className="text-xs font-medium text-[#173F32] hover:underline cursor-pointer"
            >
              All Applications
            </button>
          </div>
          <div className="divide-y divide-[#EFF2EC]">
            {data.my_mutations.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#616D66]">No mutation applications submitted yet.</div>
            ) : (
              data.my_mutations.slice(0, 6).map((m) => (
                <div key={m.id} className="px-5 py-3.5 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <GitCompareArrows className="w-3.5 h-3.5 text-[#398568] shrink-0" />
                      <span className="font-mono font-semibold text-[#173F32]">{m.mutation_ref}</span>
                      <span className="text-[#9AA59E]">·</span>
                      <span className="font-mono text-[#242B27]">{m.parcel_id}</span>
                    </div>
                    <p className="text-[#242B27] mt-0.5 truncate">
                      {m.change_type} → {m.proposed_owner}
                    </p>
                    <p className="text-[11px] text-[#616D66] truncate">Reviewer: {m.assigned_officer_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <VerificationStatusText status={m.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Downloadable Verification Reports & Recent Updates */}
        <div className="lg:col-span-5 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7DF] flex items-center justify-between bg-[#FAFAF6]">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#242B27]">Verification Reports</h2>
              <p className="text-[11px] text-[#616D66]">Download structured CSV or view details</p>
            </div>
            <button
              onClick={() => navigate('/workspace/reports')}
              className="text-xs font-medium text-[#173F32] hover:underline cursor-pointer"
            >
              Open Reports
            </button>
          </div>
          <div className="divide-y divide-[#EFF2EC]">
            {data.my_reports.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#616D66]">No verification reports generated yet.</div>
            ) : (
              data.my_reports.slice(0, 5).map((r) => (
                <div key={r.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#173F32]">{r.report_ref}</span>
                      <span className="text-[#9AA59E]">·</span>
                      <span className="font-mono text-[#242B27]">{r.parcel_id}</span>
                    </div>
                    <p className="text-[11px] text-[#616D66] truncate mt-0.5">
                      Decision: {r.human_decision || 'Pending Review'} · Risk {r.risk_score}/100
                    </p>
                  </div>
                  <button
                    onClick={() => void downloadWithAuth(`/api/reports/${r.report_ref}/csv`, `${r.report_ref}.csv`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E4E7DF] hover:border-[#173F32] text-[11px] font-medium text-[#242B27] shrink-0 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>CSV</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Submit Mutation Request Modal */}
      <ModalDialog
        open={mutationModalOpen}
        onClose={() => setMutationModalOpen(false)}
        title="Submit Mutation Request"
        subtitle="Apply for an ownership transfer or record update on one of your registered parcels."
      >
        <form onSubmit={handleMutationSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#242B27] mb-1">Select Your Parcel</label>
            <select
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
            >
              {data.my_properties.map((p) => (
                <option key={p.parcel_id} value={p.parcel_id}>
                  {p.parcel_id} · {p.survey_number} ({p.village})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#242B27] mb-1">Proposed New Owner / Transferee</label>
            <input
              type="text"
              value={proposedOwner}
              onChange={(e) => setProposedOwner(e.target.value)}
              required
              placeholder="e.g. Meera Anand Gokhale"
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#242B27] mb-1">Transfer / Mutation Type</label>
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
            >
              <option value="Family Transfer">Family Transfer</option>
              <option value="Sale Deed">Sale Deed</option>
              <option value="Inheritance">Inheritance</option>
              <option value="Gift Deed">Gift Deed</option>
              <option value="Partition Deed">Partition Deed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#242B27] mb-1">Supporting Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional reference to registered deed number or family settlement details..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setMutationModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-[#616D66] hover:text-[#242B27] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
