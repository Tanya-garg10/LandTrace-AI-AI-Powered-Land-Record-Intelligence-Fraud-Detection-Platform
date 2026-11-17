import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, FileText, History, Plus, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { OwnershipEvent, Property } from '../types';
import { VerificationStatusText } from '../components/StatusText';
import { ModalDialog } from '../components/SlideDrawer';
import { useToast } from '../components/Toast';

export function TimelinePage() {
  const { user, canManageProperties } = useAuth();
  const canWrite = canManageProperties;
  const { notify } = useToast();
  const [searchParams] = useSearchParams();

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedParcel, setSelectedParcel] = useState(searchParams.get('parcel') || 'LT-PAR-1004');
  const [activeProperty, setActiveProperty] = useState<Property | null>(null);
  const [events, setEvents] = useState<OwnershipEvent[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    previous_owner: '',
    new_owner: '',
    change_type: 'Sale Deed',
    mutation_reference: '',
    submitted_date: new Date().toISOString().slice(0, 10),
    approval_status: 'Approved',
    supporting_document: '',
    notes: '',
  });

  useEffect(() => {
    const param = searchParams.get('parcel');
    if (param) setSelectedParcel(param);
  }, [searchParams]);

  useEffect(() => {
    const query = user?.role === 'Citizen / Landowner' ? '/api/properties?limit=100&scope=mine' : '/api/properties?limit=100';
    apiRequest<{ properties: Property[] }>(query)
      .then((res) => {
        setProperties(res.properties);
        if (res.properties.length > 0 && !searchParams.get('parcel')) {
          setSelectedParcel((prev) =>
            res.properties.some((p) => p.parcel_id === prev) ? prev : res.properties[0].parcel_id
          );
        }
      })
      .catch(() => undefined);
  }, [user?.role, searchParams]);

  const loadTimeline = useCallback(
    async (parcelId: string) => {
      setLoading(true);
      try {
        const res = await apiRequest<{ property: Property; events: OwnershipEvent[] }>(
          `/api/properties/${encodeURIComponent(parcelId)}/timeline`
        );
        setActiveProperty(res.property);
        setEvents(res.events);
        const initialExpanded: Record<number, boolean> = {};
        if (res.events[0]) initialExpanded[res.events[0].id] = true;
        setExpandedIds(initialExpanded);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Unable to load ownership timeline.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    void loadTimeline(selectedParcel);
  }, [selectedParcel, loadTimeline]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openModal = () => {
    setForm({
      previous_owner: activeProperty?.current_owner || '',
      new_owner: '',
      change_type: 'Sale Deed',
      mutation_reference: `MUT-2026-${Math.floor(500 + Math.random() * 400)}`,
      submitted_date: new Date().toISOString().slice(0, 10),
      approval_status: 'Approved',
      supporting_document: 'DOC-ANNEX-NEW',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleAppend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest(`/api/properties/${encodeURIComponent(selectedParcel)}/ownership`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      notify(`Appended ownership event to ${selectedParcel}. Historical records preserved.`);
      setModalOpen(false);
      await loadTimeline(selectedParcel);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to append ownership event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27]">
            Ownership History
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Append-only chain of title · Prior historical records are never overwritten
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openModal}
            className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Append Ownership Event</span>
          </button>
        )}
      </div>

      {/* Parcel Selector Card */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="w-full md:w-96">
          <label className="block text-xs font-medium text-[#616D66] mb-1">Select Property Parcel</label>
          <select
            value={selectedParcel}
            onChange={(e) => setSelectedParcel(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          >
            {properties.map((p) => (
              <option key={p.parcel_id} value={p.parcel_id}>
                {p.parcel_id} · {p.current_owner} ({p.survey_number})
              </option>
            ))}
          </select>
        </div>
        {activeProperty && (
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div>
              <span className="text-[#616D66]">Current Holder</span>
              <p className="font-semibold text-[#242B27] mt-0.5">{activeProperty.current_owner}</p>
            </div>
            <div>
              <span className="text-[#616D66]">Survey &amp; Location</span>
              <p className="font-medium text-[#242B27] mt-0.5">
                {activeProperty.survey_number} · {activeProperty.village}, {activeProperty.district_name}
              </p>
            </div>
            <div>
              <span className="text-[#616D66]">Recorded Transfers</span>
              <p className="font-display font-semibold text-[#173F32] mt-0.5 tabular-nums">{events.length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Chronological Vertical Timeline */}
      {loading ? (
        <div className="h-64 bg-white border border-[#E4E7DF] rounded-xl animate-pulse" />
      ) : events.length === 0 ? (
        <div className="bg-white border border-[#E4E7DF] rounded-xl p-8 text-center text-xs text-[#616D66]">
          No ownership transfer history recorded for {selectedParcel}.
        </div>
      ) : (
        <div className="bg-white border border-[#E4E7DF] rounded-xl p-6">
          <div className="relative pl-9 space-y-5 before:content-[''] before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-[#E4E7DF]">
            {events.map((ev, idx) => {
              const isExpanded = Boolean(expandedIds[ev.id]);
              return (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-9 top-1 w-7 h-7 rounded-full bg-[#173F32] text-white font-display text-[11px] font-semibold flex items-center justify-center ring-4 ring-white">
                    {idx + 1}
                  </div>
                  <div className="bg-[#FAFAF6] border border-[#E4E7DF] rounded-xl p-4 transition-colors hover:border-[#398568]/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <History className="w-3.5 h-3.5 text-[#173F32]" />
                        <span className="font-semibold text-[#242B27]">{ev.change_type}</span>
                        <span className="text-[#616D66]">·</span>
                        <span className="font-mono text-[#173F32] font-medium">{ev.mutation_reference}</span>
                        <span className="text-[#616D66]">·</span>
                        <span className="font-mono text-[11px] text-[#616D66] tabular-nums">{ev.submitted_date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <VerificationStatusText status={ev.approval_status} />
                        <button
                          onClick={() => toggleExpand(ev.id)}
                          className="p-1 rounded hover:bg-[#EAF0E9] text-[#616D66] hover:text-[#173F32] cursor-pointer"
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-[#242B27] mt-2">
                      {ev.previous_owner} <span className="text-[#616D66] mx-1">→</span>{' '}
                      <span className="text-[#173F32] font-semibold">{ev.new_owner}</span>
                    </p>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[#E4E7DF] space-y-2 text-xs">
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-[#616D66]">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-[#173F32]" />
                            Supporting Doc:{' '}
                            <span className="font-mono text-[#242B27] font-medium">
                              {ev.supporting_document || '—'}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-[#398568]" />
                            Officer: <span className="text-[#242B27] font-medium">{ev.verification_officer}</span>
                          </span>
                          <span className="font-mono tabular-nums">
                            Recorded {new Date(ev.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {ev.notes && (
                          <p className="text-xs text-[#616D66] leading-relaxed bg-white border border-[#EFF2EC] rounded-lg px-3 py-2">
                            {ev.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Append Ownership Event Modal */}
      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Append Ownership Event (${selectedParcel})`}
        subtitle="Preserves all prior historical records without overwriting past ownership entries."
      >
        <form onSubmit={handleAppend} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Previous Owner</label>
              <input
                required
                value={form.previous_owner}
                onChange={(e) => setForm({ ...form, previous_owner: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">New Owner</label>
              <input
                required
                value={form.new_owner}
                onChange={(e) => setForm({ ...form, new_owner: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Change Type</label>
              <select
                value={form.change_type}
                onChange={(e) => setForm({ ...form, change_type: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              >
                <option value="Sale Deed">Sale Deed</option>
                <option value="Inheritance">Inheritance</option>
                <option value="Gift Deed">Gift Deed</option>
                <option value="Partition Deed">Partition Deed</option>
                <option value="Court Decree">Court Decree</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Approval Status</label>
              <select
                value={form.approval_status}
                onChange={(e) => setForm({ ...form, approval_status: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              >
                <option value="Approved">Approved</option>
                <option value="Under Scrutiny">Under Scrutiny</option>
                <option value="Disputed">Disputed</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Mutation Reference</label>
              <input
                required
                value={form.mutation_reference}
                onChange={(e) => setForm({ ...form, mutation_reference: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Submitted Date</label>
              <input
                type="date"
                required
                value={form.submitted_date}
                onChange={(e) => setForm({ ...form, submitted_date: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-[#242B27] mb-1">Supporting Document Reference</label>
            <input
              value={form.supporting_document}
              onChange={(e) => setForm({ ...form, supporting_document: e.target.value })}
              className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium text-[#242B27] mb-1">Verification Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
            />
          </div>
          <div className="pt-3 border-t border-[#E4E7DF] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-[#E4E7DF] rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#173F32] text-white font-semibold rounded-lg hover:bg-[#113026] cursor-pointer"
            >
              {saving ? 'Appending...' : 'Record Ownership Event'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
