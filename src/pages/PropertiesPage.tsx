import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  FileCheck2,
  History,
  Plus,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type {
  AuditLogEntry,
  District,
  DocumentRecord,
  MutationRequest,
  OwnershipEvent,
  Property,
  RiskAssessment,
  VerificationReport,
} from '../types';
import { EmptyState, RiskScoreDisplay, VerificationStatusText } from '../components/StatusText';
import { ModalDialog, SlideDrawer } from '../components/SlideDrawer';
import { useToast } from '../components/Toast';

interface PropertyDetailPayload {
  property: Property;
  ownership_history: OwnershipEvent[];
  documents: DocumentRecord[];
  mutations: MutationRequest[];
  risk_assessments: RiskAssessment[];
  reports: VerificationReport[];
  audit_logs: AuditLogEntry[];
}

type SortKey = 'parcel_id' | 'land_area_sq_m' | 'risk_score' | 'registration_date';

export function PropertiesPage() {
  const { user, canManageProperties, canVerifyDocuments } = useAuth();
  const canWrite = canManageProperties;
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [properties, setProperties] = useState<Property[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('parcel_id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [detail, setDetail] = useState<PropertyDetailPayload | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'documents' | 'history' | 'mutations' | 'audit'>('overview');

  const [formOpen, setFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState({
    parcel_id: '',
    survey_number: '',
    district_name: 'Sahyadri Valley',
    village: '',
    tehsil: '',
    land_area_sq_m: 2000,
    land_type: 'Residential',
    current_owner: '',
    previous_owner: '',
    registration_date: new Date().toISOString().slice(0, 10),
    verification_status: 'Pending Review',
  });

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        district: districtFilter,
        status: statusFilter,
        risk: riskFilter,
      });
      if (user?.role === 'Citizen / Landowner') {
        qs.set('scope', 'mine');
      }
      const res = await apiRequest<{
        properties: Property[];
        pagination: { page: number; total: number; total_pages: number };
      }>(`/api/properties?${qs.toString()}`);
      setProperties(res.properties);
      setTotalPages(res.pagination.total_pages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load properties.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, districtFilter, statusFilter, riskFilter, user?.role, notify]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    apiRequest<{ districts: District[] }>('/api/districts')
      .then((res) => setDistricts(res.districts))
      .catch(() => undefined);
  }, []);

  const openPropertyDetail = useCallback(
    async (parcelId: string) => {
      try {
        const res = await apiRequest<PropertyDetailPayload>(`/api/properties/${encodeURIComponent(parcelId)}`);
        setDetail(res);
        setDetailTab('overview');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Unable to load property details.', 'error');
      }
    },
    [notify]
  );

  const openAddModal = useCallback(() => {
    setEditingProperty(null);
    setFormState({
      parcel_id: `LT-PAR-${Math.floor(1026 + Math.random() * 800)}`,
      survey_number: '',
      district_name: districts[0]?.name || 'Sahyadri Valley',
      village: '',
      tehsil: '',
      land_area_sq_m: 2400,
      land_type: 'Residential',
      current_owner: '',
      previous_owner: '',
      registration_date: new Date().toISOString().slice(0, 10),
      verification_status: 'Pending Review',
    });
    setFormOpen(true);
  }, [districts]);

  useEffect(() => {
    const parcelParam = searchParams.get('parcel');
    if (parcelParam) {
      void openPropertyDetail(parcelParam);
    }
    if (searchParams.get('new') === '1' && canWrite) {
      openAddModal();
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, openPropertyDetail, openAddModal, canWrite, setSearchParams]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'risk_score' || key === 'land_area_sq_m' ? 'desc' : 'asc');
    }
  };

  const sortedProperties = useMemo(() => {
    const list = [...properties];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'land_area_sq_m' || sortKey === 'risk_score') {
        cmp = a[sortKey] - b[sortKey];
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [properties, sortKey, sortDir]);

  const openEditModal = (prop: Property) => {
    setEditingProperty(prop);
    setFormState({
      parcel_id: prop.parcel_id,
      survey_number: prop.survey_number,
      district_name: prop.district_name,
      village: prop.village,
      tehsil: prop.tehsil,
      land_area_sq_m: prop.land_area_sq_m,
      land_type: prop.land_type,
      current_owner: prop.current_owner,
      previous_owner: prop.previous_owner,
      registration_date: prop.registration_date,
      verification_status: prop.verification_status,
    });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingProperty) {
        await apiRequest(`/api/properties/${encodeURIComponent(editingProperty.parcel_id)}`, {
          method: 'PUT',
          body: JSON.stringify(formState),
        });
        notify(`Updated property ${editingProperty.parcel_id} and logged SHA-256 audit entry.`);
      } else {
        await apiRequest('/api/properties', {
          method: 'POST',
          body: JSON.stringify(formState),
        });
        notify(`Created property ${formState.parcel_id} in synthetic demo registry.`);
      }
      setFormOpen(false);
      await loadProperties();
      if (detail && editingProperty?.parcel_id === detail.property.parcel_id) {
        await openPropertyDetail(editingProperty.parcel_id);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save property.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-45" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#173F32]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#173F32]" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27]">
            Property Records
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            {totalCount} synthetic parcel records · Searchable, sortable &amp; auditable registry
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Property</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search parcel, survey, owner, village..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          />
        </div>

        <select
          value={districtFilter}
          onChange={(e) => {
            setDistrictFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
        >
          <option value="All">All Districts</option>
          {districts.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
        >
          <option value="All">All Verification Statuses</option>
          <option value="Verified">Verified</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Flagged">Flagged</option>
          <option value="Under Investigation">Under Investigation</option>
        </select>

        <select
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
        >
          <option value="All">All Risk Levels</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white border border-[#E4E7DF] rounded-xl p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#FAFAF6] rounded animate-pulse" />
          ))}
        </div>
      ) : sortedProperties.length === 0 ? (
        <EmptyState
          title="No matching property records"
          description="Try clearing your search or status filters to see all synthetic parcels."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearch('');
            setDistrictFilter('All');
            setStatusFilter('All');
            setRiskFilter('All');
          }}
        />
      ) : (
        <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                  <th className="py-3 px-4">
                    <button
                      onClick={() => toggleSort('parcel_id')}
                      className="inline-flex items-center gap-1 hover:text-[#242B27] cursor-pointer"
                    >
                      <span>Parcel ID</span>
                      <SortIcon col="parcel_id" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Survey No.</th>
                  <th className="py-3 px-4">Current Owner</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      onClick={() => toggleSort('land_area_sq_m')}
                      className="inline-flex items-center gap-1 hover:text-[#242B27] cursor-pointer"
                    >
                      <span>Area</span>
                      <SortIcon col="land_area_sq_m" />
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      onClick={() => toggleSort('registration_date')}
                      className="inline-flex items-center gap-1 hover:text-[#242B27] cursor-pointer"
                    >
                      <span>Registered</span>
                      <SortIcon col="registration_date" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">
                    <button
                      onClick={() => toggleSort('risk_score')}
                      className="inline-flex items-center gap-1 hover:text-[#242B27] cursor-pointer"
                    >
                      <span>Risk Score</span>
                      <SortIcon col="risk_score" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF2EC] text-xs">
                {sortedProperties.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAFAF6] transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-[#173F32] whitespace-nowrap">
                      <button
                        onClick={() => void openPropertyDetail(p.parcel_id)}
                        className="hover:underline cursor-pointer"
                      >
                        {p.parcel_id}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#242B27] whitespace-nowrap">{p.survey_number}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#242B27]">{p.current_owner}</p>
                      <p className="text-[11px] text-[#616D66]">Prev: {p.previous_owner || '—'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[#242B27]">{p.village}</p>
                      <p className="text-[11px] text-[#616D66]">
                        {p.tehsil} · {p.district_name}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#242B27] whitespace-nowrap">
                      {p.land_area_display}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] tabular-nums text-[#616D66] whitespace-nowrap">
                      {p.registration_date}
                    </td>
                    <td className="py-3 px-4">
                      <VerificationStatusText status={p.verification_status} />
                    </td>
                    <td className="py-3 px-4">
                      <RiskScoreDisplay score={p.risk_score} category={p.risk_category} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => void openPropertyDetail(p.parcel_id)}
                          className="p-1.5 text-[#616D66] hover:text-[#173F32] hover:bg-[#EAF0E9] rounded-md cursor-pointer transition-colors"
                          title="Inspect Record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-[#616D66] hover:text-[#173F32] hover:bg-[#EAF0E9] rounded-md cursor-pointer transition-colors"
                            title="Edit Property"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-[#E4E7DF] bg-[#FAFAF6] flex items-center justify-between text-xs text-[#616D66]">
            <span className="tabular-nums">
              Page {page} of {totalPages} · {totalCount} records
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 bg-white border border-[#E4E7DF] rounded-lg disabled:opacity-40 hover:bg-[#EAF0E9] inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 bg-white border border-[#E4E7DF] rounded-lg disabled:opacity-40 hover:bg-[#EAF0E9] inline-flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Detail Drawer */}
      <SlideDrawer
        open={Boolean(detail)}
        onClose={() => {
          setDetail(null);
          if (searchParams.has('parcel')) {
            const next = new URLSearchParams(searchParams);
            next.delete('parcel');
            setSearchParams(next);
          }
        }}
        title={detail ? `${detail.property.parcel_id} · ${detail.property.current_owner}` : ''}
        subtitle={
          detail
            ? `Survey ${detail.property.survey_number} · ${detail.property.village}, ${detail.property.district_name}`
            : ''
        }
      >
        {detail && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-1 p-1 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg">
              {(
                [
                  ['overview', 'Overview'],
                  ['documents', `Documents (${detail.documents.length})`],
                  ['history', `Ownership (${detail.ownership_history.length})`],
                  ['mutations', `Mutations (${detail.mutations.length})`],
                  ['audit', `Audit (${detail.audit_logs.length})`],
                ] as const
              ).map(([tabKey, tabLabel]) => (
                <button
                  key={tabKey}
                  onClick={() => setDetailTab(tabKey)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    detailTab === tabKey
                      ? 'bg-[#EAF0E9] text-[#173F32]'
                      : 'text-[#616D66] hover:text-[#242B27]'
                  }`}
                >
                  {tabLabel}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-xl p-4">
                  <div>
                    <span className="text-[#616D66]">Verification Status</span>
                    <div className="mt-1">
                      <VerificationStatusText status={detail.property.verification_status} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[#616D66]">Risk Evaluation</span>
                    <div className="mt-1">
                      <RiskScoreDisplay score={detail.property.risk_score} category={detail.property.risk_category} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[#616D66]">Current Owner</span>
                    <p className="font-semibold text-[#242B27] mt-0.5">{detail.property.current_owner}</p>
                  </div>
                  <div>
                    <span className="text-[#616D66]">Previous Owner</span>
                    <p className="font-medium text-[#242B27] mt-0.5">{detail.property.previous_owner || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[#616D66]">Land Area &amp; Type</span>
                    <p className="font-mono font-medium text-[#242B27] mt-0.5 tabular-nums">
                      {detail.property.land_area_display} · {detail.property.land_type}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#616D66]">Registration Date</span>
                    <p className="font-mono font-medium text-[#242B27] mt-0.5 tabular-nums">
                      {detail.property.registration_date}
                    </p>
                  </div>
                </div>

                {detail.risk_assessments[0] && (
                  <div className="border border-[#E4E7DF] rounded-xl p-4 space-y-2">
                    <h3 className="font-display text-xs font-semibold text-[#242B27]">Latest Risk Engine Summary</h3>
                    <p className="text-xs text-[#616D66] leading-relaxed">{detail.risk_assessments[0].ai_summary}</p>
                    <p className="text-xs font-medium text-[#173F32] pt-1">
                      Recommended Action: {detail.risk_assessments[0].recommended_action}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {(canVerifyDocuments || user?.role === 'Citizen / Landowner') && (
                    <button
                      onClick={() => navigate(`/workspace/documents?parcel=${encodeURIComponent(detail.property.parcel_id)}`)}
                      className="px-4 py-2 bg-[#173F32] text-white text-xs font-semibold rounded-lg hover:bg-[#113026] inline-flex items-center gap-2 cursor-pointer"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Analyze Supporting Document</span>
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/workspace/timeline?parcel=${encodeURIComponent(detail.property.parcel_id)}`)}
                    className="px-4 py-2 bg-white border border-[#E4E7DF] text-[#242B27] text-xs font-medium rounded-lg hover:bg-[#FAFAF6] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Ownership History</span>
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => openEditModal(detail.property)}
                      className="px-4 py-2 bg-white border border-[#E4E7DF] text-[#242B27] text-xs font-medium rounded-lg hover:bg-[#FAFAF6] inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Record</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'documents' && (
              <div className="space-y-3">
                {detail.documents.length === 0 ? (
                  <p className="text-xs text-[#616D66]">No documents analyzed for this parcel yet.</p>
                ) : (
                  detail.documents.map((doc) => (
                    <div key={doc.id} className="border border-[#E4E7DF] rounded-xl p-4 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-[#173F32]">{doc.doc_ref}</span>
                        <span className="text-[#616D66]">{doc.ai_provider}</span>
                      </div>
                      <p className="font-medium text-[#242B27]">{doc.filename}</p>
                      <p className="text-[#616D66]">
                        {doc.ocr_method} · Uploaded {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'history' && (
              <div className="space-y-4">
                {detail.ownership_history.map((ev) => (
                  <div key={ev.id} className="border border-[#E4E7DF] rounded-xl p-4 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#242B27]">{ev.change_type}</span>
                      <VerificationStatusText status={ev.approval_status} />
                    </div>
                    <p className="text-[#242B27]">
                      {ev.previous_owner} <span className="text-[#616D66]">→</span>{' '}
                      <span className="font-semibold">{ev.new_owner}</span>
                    </p>
                    <p className="text-[11px] text-[#616D66]">
                      Ref {ev.mutation_reference} · Date {ev.submitted_date} · Officer {ev.verification_officer}
                    </p>
                    {ev.notes && <p className="text-[#616D66] pt-1">{ev.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            {detailTab === 'mutations' && (
              <div className="space-y-3">
                {detail.mutations.length === 0 ? (
                  <p className="text-xs text-[#616D66]">No mutation requests on record.</p>
                ) : (
                  detail.mutations.map((m) => (
                    <div key={m.id} className="border border-[#E4E7DF] rounded-xl p-4 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-[#173F32]">{m.mutation_ref}</span>
                        <VerificationStatusText status={m.status} />
                      </div>
                      <p className="text-[#242B27]">
                        Proposed Owner: <span className="font-semibold">{m.proposed_owner}</span> ({m.change_type})
                      </p>
                      <p className="text-[#616D66]">Officer: {m.assigned_officer_name}</p>
                      {m.admin_notes && <p className="text-[#616D66]">{m.admin_notes}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'audit' && (
              <div className="space-y-3">
                {detail.audit_logs.map((a) => (
                  <div key={a.id} className="border border-[#E4E7DF] rounded-xl p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-[#242B27]">{a.action}</span>
                      <span className="font-mono text-[11px] text-[#173F32]">{a.event_id}</span>
                    </div>
                    <p className="text-[11px] text-[#616D66]">
                      Actor: {a.actor_name} ({a.actor_role}) · {new Date(a.created_at).toLocaleString()}
                    </p>
                    <p className="font-mono text-[10px] text-[#616D66] truncate">
                      Ledger Hash: {a.current_ledger_hash}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SlideDrawer>

      {/* Add / Edit Property Modal */}
      <ModalDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingProperty ? `Edit Property ${editingProperty.parcel_id}` : 'Register Synthetic Demo Property'}
        subtitle="Changes are persisted to SQLite and recorded in the SHA-256 audit ledger."
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Parcel ID</label>
              <input
                required
                disabled={Boolean(editingProperty)}
                value={formState.parcel_id}
                onChange={(e) => setFormState({ ...formState, parcel_id: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Survey Number</label>
              <input
                required
                value={formState.survey_number}
                onChange={(e) => setFormState({ ...formState, survey_number: e.target.value })}
                placeholder="e.g. SY-408/C"
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">District</label>
              <select
                disabled={Boolean(editingProperty)}
                value={formState.district_name}
                onChange={(e) => setFormState({ ...formState, district_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg disabled:opacity-60"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Tehsil</label>
              <input
                required
                value={formState.tehsil}
                onChange={(e) => setFormState({ ...formState, tehsil: e.target.value })}
                placeholder="e.g. Haveli"
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Village</label>
              <input
                required
                value={formState.village}
                onChange={(e) => setFormState({ ...formState, village: e.target.value })}
                placeholder="e.g. Khedgaon"
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Land Area (sq.m)</label>
              <input
                type="number"
                min={50}
                required
                value={formState.land_area_sq_m}
                onChange={(e) => setFormState({ ...formState, land_area_sq_m: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Current Owner</label>
              <input
                required
                value={formState.current_owner}
                onChange={(e) => setFormState({ ...formState, current_owner: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Previous Owner</label>
              <input
                value={formState.previous_owner}
                onChange={(e) => setFormState({ ...formState, previous_owner: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Land Type</label>
              <select
                value={formState.land_type}
                onChange={(e) => setFormState({ ...formState, land_type: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              >
                <option value="Residential">Residential</option>
                <option value="Residential Plot">Residential Plot</option>
                <option value="Agricultural">Agricultural</option>
                <option value="Commercial">Commercial</option>
                <option value="Mixed Commercial">Mixed Commercial</option>
                <option value="Industrial">Industrial</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[#242B27] mb-1">Verification Status</label>
              <select
                value={formState.verification_status}
                onChange={(e) => setFormState({ ...formState, verification_status: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg"
              >
                <option value="Verified">Verified</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Flagged">Flagged</option>
                <option value="Under Investigation">Under Investigation</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E4E7DF] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 border border-[#E4E7DF] rounded-lg text-[#242B27] hover:bg-[#FAFAF6] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#173F32] text-white font-semibold rounded-lg hover:bg-[#113026] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : editingProperty ? 'Save Changes' : 'Create Property'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
