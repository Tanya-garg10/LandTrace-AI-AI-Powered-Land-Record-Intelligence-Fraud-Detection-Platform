import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flag, Plus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { MutationRequest, MutationStatus, Property } from '../types';
import { EmptyState, RiskScoreDisplay, VerificationStatusText } from '../components/StatusText';
import { ModalDialog, SlideDrawer } from '../components/SlideDrawer';
import { useToast } from '../components/Toast';

const STATUS_TABS: Array<'All' | MutationStatus> = [
  'All',
  'Submitted',
  'Under Review',
  'Documents Required',
  'Approved',
  'Rejected',
  'Flagged for Investigation',
];

interface OfficerOption {
  id: number;
  name: string;
  role: string;
}

export function MutationsPage() {
  const { user, canWrite } = useAuth();
  const canSubmitMutation = canWrite || user?.role === 'Citizen / Landowner';
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allMutations, setAllMutations] = useState<MutationRequest[]>([]);
  const [mutations, setMutations] = useState<MutationRequest[]>([]);
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<MutationRequest | null>(null);
  const [updateForm, setUpdateForm] = useState({
    status: 'Under Review' as MutationStatus,
    assigned_officer_id: 0,
    admin_notes: '',
    is_suspicious: false,
  });
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    parcel_id: 'LT-PAR-1004',
    applicant_name: '',
    proposed_owner: '',
    change_type: 'Sale Deed',
    supporting_doc_ref: '',
    admin_notes: '',
  });

  const openDrawer = useCallback((m: MutationRequest) => {
    setSelected(m);
    setUpdateForm({
      status: m.status,
      assigned_officer_id: m.assigned_officer_id || 0,
      admin_notes: m.admin_notes || '',
      is_suspicious: m.is_suspicious === 1,
    });
  }, []);

  const loadMutations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== 'All') qs.set('status', statusFilter);
      if (search.trim()) qs.set('search', search.trim());

      const [filteredRes, fullRes] = await Promise.all([
        apiRequest<{ mutations: MutationRequest[]; officers: OfficerOption[] }>(`/api/mutations?${qs.toString()}`),
        apiRequest<{ mutations: MutationRequest[] }>('/api/mutations'),
      ]);

      setMutations(filteredRes.mutations);
      setOfficers(filteredRes.officers);
      setAllMutations(fullRes.mutations);

      const refParam = searchParams.get('ref');
      if (refParam) {
        const match = fullRes.mutations.find((m) => m.mutation_ref === refParam);
        if (match) {
          openDrawer(match);
        }
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load mutations.', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, notify, searchParams, openDrawer]);

  useEffect(() => {
    void loadMutations();
  }, [loadMutations]);

  useEffect(() => {
    const query = user?.role === 'Citizen / Landowner' ? '/api/properties?limit=100&scope=mine' : '/api/properties?limit=100';
    apiRequest<{ properties: Property[] }>(query)
      .then((res) => {
        setProperties(res.properties);
        if (res.properties.length > 0) {
          setNewForm((f) => ({
            ...f,
            parcel_id: res.properties.some((p) => p.parcel_id === f.parcel_id)
              ? f.parcel_id
              : res.properties[0].parcel_id,
          }));
        }
      })
      .catch(() => undefined);
  }, [user?.role]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {
      Submitted: 0,
      'Under Review': 0,
      'Documents Required': 0,
      Approved: 0,
      Rejected: 0,
      'Flagged for Investigation': 0,
    };
    for (const m of allMutations) {
      map[m.status] = (map[m.status] || 0) + 1;
    }
    return map;
  }, [allMutations]);

  const handleUpdateMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ mutation: MutationRequest }>(`/api/mutations/${selected.mutation_ref}`, {
        method: 'PATCH',
        body: JSON.stringify(updateForm),
      });
      notify(`Updated ${selected.mutation_ref} to "${updateForm.status}" and recorded SHA-256 audit log.`);
      await loadMutations();
      setSelected({ ...selected, ...res.mutation });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update mutation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/mutations', {
        method: 'POST',
        body: JSON.stringify(newForm),
      });
      notify('Mutation request created and logged to audit ledger.');
      setCreateOpen(false);
      await loadMutations();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create mutation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusHistory = selected
    ? (JSON.parse(selected.status_history_json || '[]') as Array<{
        status: string;
        changed_by: string;
        note: string;
        timestamp: string;
      }>)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27]">
            Mutation Requests
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Auditable transfer workflow · Every status transition is hashed to the integrity ledger
          </p>
        </div>
        {canSubmitMutation && (
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Mutation Request</span>
          </button>
        )}
      </div>

      {/* Compact Status Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(
          [
            ['Submitted', 'text-[#C5831B]'],
            ['Under Review', 'text-[#C5831B]'],
            ['Documents Required', 'text-[#C5831B]'],
            ['Approved', 'text-[#398568]'],
            ['Flagged for Investigation', 'text-[#D95B55]'],
            ['Rejected', 'text-[#616D66]'],
          ] as const
        ).map(([status, tone]) => (
          <button
            key={status}
            onClick={() => setStatusFilter((prev) => (prev === status ? 'All' : status))}
            className={`bg-white border rounded-xl p-3.5 text-left transition-colors cursor-pointer ${
              statusFilter === status
                ? 'border-[#173F32] bg-[#EAF0E9]/45'
                : 'border-[#E4E7DF] hover:border-[#398568]/45'
            }`}
          >
            <p className="text-[11px] font-medium text-[#616D66] truncate">{status}</p>
            <p className={`font-display text-xl font-semibold tabular-nums mt-1 ${tone}`}>
              {statusCounts[status] || 0}
            </p>
          </button>
        ))}
      </div>

      {/* Status Filter Tabs & Search */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-1 p-1 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab ? 'bg-[#EAF0E9] text-[#173F32]' : 'text-[#616D66] hover:text-[#242B27]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mutation ref, parcel, proposed owner..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="h-64 bg-white border border-[#E4E7DF] rounded-xl animate-pulse" />
      ) : mutations.length === 0 ? (
        <EmptyState
          title="No mutation requests match filter"
          description="Select All or clear your search query to view all pending and finalized mutations."
          actionLabel="View All Mutations"
          onAction={() => {
            setStatusFilter('All');
            setSearch('');
          }}
        />
      ) : (
        <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                  <th className="py-3 px-4">Mutation Ref</th>
                  <th className="py-3 px-4">Parcel &amp; Location</th>
                  <th className="py-3 px-4">Proposed Transfer</th>
                  <th className="py-3 px-4">Assigned Officer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Parcel Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF2EC] text-xs">
                {mutations.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => openDrawer(m)}
                    className="hover:bg-[#FAFAF6] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-[#173F32] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {m.is_suspicious === 1 && <Flag className="w-3 h-3 text-[#D95B55]" />}
                        {m.mutation_ref}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono font-medium text-[#242B27]">{m.parcel_id}</p>
                      <p className="text-[11px] text-[#616D66]">
                        {m.village} · {m.district_name}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#242B27]">
                        {m.current_owner_snapshot} → <span className="font-semibold">{m.proposed_owner}</span>
                      </p>
                      <p className="text-[11px] text-[#616D66]">{m.change_type}</p>
                    </td>
                    <td className="py-3 px-4 text-[#242B27]">{m.assigned_officer_name}</td>
                    <td className="py-3 px-4">
                      <VerificationStatusText status={m.status} />
                    </td>
                    <td className="py-3 px-4">
                      {m.risk_score !== undefined && (
                        <RiskScoreDisplay score={m.risk_score} category={m.risk_category || 'Low'} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mutation Detail & Review Drawer */}
      <SlideDrawer
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          if (searchParams.has('ref')) {
            const next = new URLSearchParams(searchParams);
            next.delete('ref');
            setSearchParams(next);
          }
        }}
        title={selected ? `${selected.mutation_ref} · ${selected.parcel_id}` : ''}
        subtitle={selected ? `${selected.change_type} · ${selected.current_owner_snapshot} → ${selected.proposed_owner}` : ''}
      >
        {selected && (
          <div className="space-y-6 text-xs">
            <div className="bg-[#FAFAF6] border border-[#E4E7DF] rounded-xl p-4 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[#616D66]">Current Status</span>
                <div className="mt-1">
                  <VerificationStatusText status={selected.status} />
                </div>
              </div>
              <div>
                <span className="text-[#616D66]">Supporting Doc</span>
                <p className="font-mono font-medium text-[#242B27] mt-1">{selected.supporting_doc_ref || 'None attached'}</p>
              </div>
              <div>
                <span className="text-[#616D66]">Applicant</span>
                <p className="font-medium text-[#242B27] mt-0.5">{selected.applicant_name}</p>
              </div>
              <div>
                <span className="text-[#616D66]">Assigned Officer</span>
                <p className="font-medium text-[#242B27] mt-0.5">{selected.assigned_officer_name}</p>
              </div>
            </div>

            {canWrite && (
              <form onSubmit={handleUpdateMutation} className="border border-[#E4E7DF] rounded-xl p-4 space-y-4">
                <h3 className="font-display font-semibold text-[#242B27]">Officer Review &amp; Status Transition</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#242B27] mb-1">Update Status</label>
                    <select
                      value={updateForm.status}
                      onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value as MutationStatus })}
                      className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
                    >
                      <option value="Submitted">Submitted</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Documents Required">Documents Required</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Flagged for Investigation">Flagged for Investigation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[#242B27] mb-1">Assign Officer</label>
                    <select
                      value={updateForm.assigned_officer_id}
                      onChange={(e) => setUpdateForm({ ...updateForm, assigned_officer_id: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
                    >
                      <option value={0}>Keep Current</option>
                      {officers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#242B27] mb-1">Administrative Notes</label>
                  <textarea
                    rows={3}
                    value={updateForm.admin_notes}
                    onChange={(e) => setUpdateForm({ ...updateForm, admin_notes: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateForm.is_suspicious}
                    onChange={(e) => setUpdateForm({ ...updateForm, is_suspicious: e.target.checked })}
                    className="rounded border-[#E4E7DF]"
                  />
                  <span className="font-medium text-[#D95B55]">Flag as suspicious transfer requiring investigation</span>
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-[#173F32] hover:bg-[#113026] text-white font-semibold rounded-lg cursor-pointer"
                >
                  {saving ? 'Saving Transition...' : 'Save Status Update & Log Audit'}
                </button>
              </form>
            )}

            <div className="space-y-2.5">
              <h3 className="font-display font-semibold text-[#242B27]">Status History</h3>
              <div className="space-y-2">
                {statusHistory.map((h, idx) => (
                  <div key={idx} className="p-3 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg">
                    <div className="flex items-center justify-between">
                      <VerificationStatusText status={h.status} />
                      <span className="font-mono text-[11px] text-[#616D66]">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#242B27] mt-1">{h.note}</p>
                    <p className="text-[11px] text-[#616D66] mt-0.5">Officer: {h.changed_by}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* New Mutation Request Modal */}
      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Submit New Mutation Request"
        subtitle="Creates a mutation case and records an initial audit ledger event."
      >
        <form onSubmit={handleCreateMutation} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#242B27] mb-1">Target Parcel</label>
            <select
              value={newForm.parcel_id}
              onChange={(e) => setNewForm({ ...newForm, parcel_id: e.target.value })}
              className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
            >
              {properties.map((p) => (
                <option key={p.parcel_id} value={p.parcel_id}>
                  {p.parcel_id} · {p.current_owner}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Applicant Name</label>
              <input
                required
                value={newForm.applicant_name}
                onChange={(e) => setNewForm({ ...newForm, applicant_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Proposed New Owner</label>
              <input
                required
                value={newForm.proposed_owner}
                onChange={(e) => setNewForm({ ...newForm, proposed_owner: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Change Type</label>
              <select
                value={newForm.change_type}
                onChange={(e) => setNewForm({ ...newForm, change_type: e.target.value })}
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
              <label className="block font-medium text-[#242B27] mb-1">Supporting Doc Ref</label>
              <input
                value={newForm.supporting_doc_ref}
                onChange={(e) => setNewForm({ ...newForm, supporting_doc_ref: e.target.value })}
                placeholder="Optional DOC ref"
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-[#242B27] mb-1">Notes</label>
            <textarea
              rows={2}
              value={newForm.admin_notes}
              onChange={(e) => setNewForm({ ...newForm, admin_notes: e.target.value })}
              className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
            />
          </div>
          <div className="pt-3 border-t border-[#E4E7DF] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 border border-[#E4E7DF] rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[#173F32] text-white font-semibold rounded-lg cursor-pointer">
              {saving ? 'Submitting...' : 'Submit Mutation'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
