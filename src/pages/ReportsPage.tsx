import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Eye, FileSpreadsheet, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, downloadWithAuth } from '../lib/api';
import { exportVerificationReportPdf } from '../lib/pdfExport';
import type {
  AuditLogEntry,
  FieldComparison,
  MutationRequest,
  Property,
  RiskAssessment,
  VerificationReport,
} from '../types';
import { RiskScoreDisplay, VerificationStatusText } from '../components/StatusText';
import { ModalDialog } from '../components/SlideDrawer';
import { useToast } from '../components/Toast';

type ReportCategory = 'verification' | 'properties' | 'mutations' | 'risk' | 'audit';

function downloadCsvRows(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [category, setCategory] = useState<ReportCategory>('verification');
  const [reports, setReports] = useState<VerificationReport[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [mutations, setMutations] = useState<MutationRequest[]>([]);
  const [risks, setRisks] = useState<RiskAssessment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<VerificationReport | null>(null);

  const role = user?.role || 'Citizen / Landowner';

  const availableCategories = useMemo(() => {
    const tabs: Array<{ id: ReportCategory; label: string }> = [
      { id: 'verification', label: 'Verification Reports' },
      { id: 'properties', label: 'Property Reports' },
      { id: 'mutations', label: 'Mutation Reports' },
      ...(role !== 'Citizen / Landowner' ? ([{ id: 'risk', label: 'Risk Reports' }] as const) : []),
      ...(role === 'System Administrator' ? ([{ id: 'audit', label: 'Audit Reports' }] as const) : []),
    ];
    return tabs;
  }, [role]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const propEndpoint = role === 'Citizen / Landowner' ? '/api/properties?limit=100&scope=mine' : '/api/properties?limit=100';
      const [repRes, propRes, mutRes] = await Promise.all([
        apiRequest<{ reports: VerificationReport[] }>('/api/reports'),
        apiRequest<{ properties: Property[] }>(propEndpoint),
        apiRequest<{ mutations: MutationRequest[] }>('/api/mutations'),
      ]);
      setReports(repRes.reports);
      setProperties(propRes.properties);
      setMutations(mutRes.mutations);

      if (role !== 'Citizen / Landowner') {
        const riskRes = await apiRequest<{ assessments: RiskAssessment[] }>('/api/risk/assessments');
        setRisks(riskRes.assessments);
      }
      if (role === 'System Administrator') {
        const auditRes = await apiRequest<{ entries: AuditLogEntry[] }>('/api/audit/ledger?limit=50');
        setAuditLogs(auditRes.entries);
      }

      const refParam = searchParams.get('ref');
      if (refParam) {
        const match = repRes.reports.find((r) => r.report_ref === refParam);
        if (match) setPreview(match);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load reports.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, searchParams, role]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const q = search.trim().toLowerCase();

  const filteredReports = useMemo(
    () =>
      !q
        ? reports
        : reports.filter(
            (r) =>
              r.report_ref.toLowerCase().includes(q) ||
              r.parcel_id.toLowerCase().includes(q) ||
              (r.current_owner || '').toLowerCase().includes(q)
          ),
    [reports, q]
  );

  const filteredProperties = useMemo(
    () =>
      !q
        ? properties
        : properties.filter(
            (p) =>
              p.parcel_id.toLowerCase().includes(q) ||
              p.current_owner.toLowerCase().includes(q) ||
              p.district_name.toLowerCase().includes(q)
          ),
    [properties, q]
  );

  const filteredMutations = useMemo(
    () =>
      !q
        ? mutations
        : mutations.filter(
            (m) =>
              m.mutation_ref.toLowerCase().includes(q) ||
              m.parcel_id.toLowerCase().includes(q) ||
              m.proposed_owner.toLowerCase().includes(q)
          ),
    [mutations, q]
  );

  const filteredRisks = useMemo(
    () =>
      !q
        ? risks
        : risks.filter(
            (r) =>
              r.parcel_id.toLowerCase().includes(q) ||
              (r.current_owner || '').toLowerCase().includes(q) ||
              r.risk_category.toLowerCase().includes(q)
          ),
    [risks, q]
  );

  const filteredAudit = useMemo(
    () =>
      !q
        ? auditLogs
        : auditLogs.filter(
            (a) =>
              a.event_id.toLowerCase().includes(q) ||
              a.parcel_id.toLowerCase().includes(q) ||
              a.action.toLowerCase().includes(q)
          ),
    [auditLogs, q]
  );

  const handleExportCurrentCategoryCsv = () => {
    if (category === 'properties') {
      downloadCsvRows(
        'landtrace-property-summary.csv',
        ['Parcel ID', 'Survey Number', 'Owner', 'District', 'Area', 'Status', 'Risk Score', 'Risk Category'],
        filteredProperties.map((p) => [
          p.parcel_id,
          p.survey_number,
          p.current_owner,
          p.district_name,
          p.land_area_display,
          p.verification_status,
          p.risk_score,
          p.risk_category,
        ])
      );
      notify('Exported Property Summary CSV.');
    } else if (category === 'mutations') {
      downloadCsvRows(
        'landtrace-mutation-summary.csv',
        ['Mutation Ref', 'Parcel ID', 'Current Owner', 'Proposed Owner', 'Type', 'Status', 'Officer'],
        filteredMutations.map((m) => [
          m.mutation_ref,
          m.parcel_id,
          m.current_owner_snapshot,
          m.proposed_owner,
          m.change_type,
          m.status,
          m.assigned_officer_name,
        ])
      );
      notify('Exported Mutation Summary CSV.');
    } else if (category === 'risk') {
      downloadCsvRows(
        'landtrace-risk-summary.csv',
        ['Parcel ID', 'Owner', 'District', 'Risk Score', 'Category', 'Recommended Action'],
        filteredRisks.map((r) => [
          r.parcel_id,
          r.current_owner || '',
          r.district_name || '',
          r.risk_score,
          r.risk_category,
          r.recommended_action,
        ])
      );
      notify('Exported Risk Summary CSV.');
    } else if (category === 'audit') {
      downloadCsvRows(
        'landtrace-audit-summary.csv',
        ['Event ID', 'Parcel ID', 'Action', 'Actor', 'Role', 'Ledger Hash', 'Timestamp'],
        filteredAudit.map((a) => [
          a.event_id,
          a.parcel_id,
          a.action,
          a.actor_name,
          a.actor_role,
          a.current_ledger_hash,
          a.created_at,
        ])
      );
      notify('Exported Audit Ledger Summary CSV.');
    }
  };

  const previewComparisons = preview
    ? (JSON.parse(preview.comparison_json || '[]') as FieldComparison[])
    : [];
  const previewMissing = preview ? (JSON.parse(preview.missing_fields_json || '[]') as string[]) : [];
  const previewSteps = preview ? (JSON.parse(preview.recommended_steps_json || '[]') as string[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27]">
            Reports &amp; Intelligence Exports
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Structured verification dossiers, registry summaries &amp; compliance exports · PDF &amp; CSV
          </p>
        </div>
        {category !== 'verification' && (
          <button
            onClick={handleExportCurrentCategoryCsv}
            className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Category CSV</span>
          </button>
        )}
      </div>

      {/* Category Tabs + Search */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg">
          {availableCategories.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                category === tab.id ? 'bg-[#EAF0E9] text-[#173F32]' : 'text-[#616D66] hover:text-[#242B27]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter reports by parcel, ref, owner..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-white border border-[#E4E7DF] rounded-xl animate-pulse" />
      ) : (
        <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            {category === 'verification' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                    <th className="py-3 px-4">Report Ref</th>
                    <th className="py-3 px-4">Parcel &amp; Owner</th>
                    <th className="py-3 px-4">Source Document</th>
                    <th className="py-3 px-4">Risk Assessment</th>
                    <th className="py-3 px-4">Audit Event</th>
                    <th className="py-3 px-4 text-right">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFF2EC] text-xs">
                  {filteredReports.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FAFAF6]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#173F32] whitespace-nowrap">
                        <button
                          onClick={() => setPreview(r)}
                          className="hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          {r.report_ref}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono font-medium text-[#242B27]">{r.parcel_id}</p>
                        <p className="text-[11px] text-[#616D66]">{r.current_owner}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[#242B27]">{r.filename || 'Registry Evaluation'}</p>
                        <p className="text-[11px] text-[#616D66]">{r.ai_provider || 'Gemini 4 Hydrogen'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <RiskScoreDisplay score={r.risk_score} category={r.risk_category} />
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#616D66]">{r.audit_entry_id || '—'}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setPreview(r)}
                            className="px-2.5 py-1.5 border border-[#E4E7DF] rounded-lg hover:bg-white text-[#242B27] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            Preview
                          </button>
                          <button
                            onClick={() => exportVerificationReportPdf(r)}
                            className="px-2.5 py-1.5 bg-[#173F32] text-white rounded-lg hover:bg-[#113026] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </button>
                          <button
                            onClick={() => void downloadWithAuth(`/api/reports/${r.report_ref}/csv`, `${r.report_ref}.csv`)}
                            className="px-2.5 py-1.5 border border-[#E4E7DF] rounded-lg hover:bg-white text-[#242B27] cursor-pointer"
                          >
                            CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {category === 'properties' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                    <th className="py-3 px-4">Parcel ID</th>
                    <th className="py-3 px-4">Survey No.</th>
                    <th className="py-3 px-4">Current Owner</th>
                    <th className="py-3 px-4">District</th>
                    <th className="py-3 px-4 text-right">Area</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFF2EC] text-xs">
                  {filteredProperties.map((p) => (
                    <tr key={p.id} className="hover:bg-[#FAFAF6]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#173F32]">{p.parcel_id}</td>
                      <td className="py-3 px-4 font-mono text-[#242B27]">{p.survey_number}</td>
                      <td className="py-3 px-4 font-medium text-[#242B27]">{p.current_owner}</td>
                      <td className="py-3 px-4 text-[#616D66]">{p.district_name}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#242B27]">{p.land_area_display}</td>
                      <td className="py-3 px-4">
                        <VerificationStatusText status={p.verification_status} />
                      </td>
                      <td className="py-3 px-4">
                        <RiskScoreDisplay score={p.risk_score} category={p.risk_category} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {category === 'mutations' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                    <th className="py-3 px-4">Mutation Ref</th>
                    <th className="py-3 px-4">Parcel ID</th>
                    <th className="py-3 px-4">Transfer</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Officer</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFF2EC] text-xs">
                  {filteredMutations.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAFAF6]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#173F32]">{m.mutation_ref}</td>
                      <td className="py-3 px-4 font-mono text-[#242B27]">{m.parcel_id}</td>
                      <td className="py-3 px-4 text-[#242B27]">
                        {m.current_owner_snapshot} → <span className="font-semibold">{m.proposed_owner}</span>
                      </td>
                      <td className="py-3 px-4 text-[#616D66]">{m.change_type}</td>
                      <td className="py-3 px-4 text-[#242B27]">{m.assigned_officer_name}</td>
                      <td className="py-3 px-4">
                        <VerificationStatusText status={m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {category === 'risk' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                    <th className="py-3 px-4">Parcel ID</th>
                    <th className="py-3 px-4">Owner &amp; District</th>
                    <th className="py-3 px-4">Risk Score</th>
                    <th className="py-3 px-4">Recommended Officer Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFF2EC] text-xs">
                  {filteredRisks.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FAFAF6]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#173F32] whitespace-nowrap">{r.parcel_id}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#242B27]">{r.current_owner}</p>
                        <p className="text-[11px] text-[#616D66]">{r.district_name}</p>
                      </td>
                      <td className="py-3 px-4">
                        <RiskScoreDisplay score={r.risk_score} category={r.risk_category} />
                      </td>
                      <td className="py-3 px-4 text-[#616D66] max-w-md">{r.recommended_action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {category === 'audit' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                    <th className="py-3 px-4">Event ID</th>
                    <th className="py-3 px-4">Parcel</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Ledger Hash</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFF2EC] text-xs">
                  {filteredAudit.map((a) => (
                    <tr key={a.id} className="hover:bg-[#FAFAF6]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#173F32] whitespace-nowrap">{a.event_id}</td>
                      <td className="py-3 px-4 font-mono text-[#242B27] whitespace-nowrap">{a.parcel_id}</td>
                      <td className="py-3 px-4 text-[#242B27] font-medium">{a.action}</td>
                      <td className="py-3 px-4 text-[#616D66]">
                        {a.actor_name} · {a.actor_role}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#616D66]">
                        {a.current_ledger_hash.slice(0, 18)}...
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#616D66] tabular-nums whitespace-nowrap">
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Report Preview Modal */}
      <ModalDialog
        open={Boolean(preview)}
        onClose={() => {
          setPreview(null);
          if (searchParams.has('ref')) {
            const next = new URLSearchParams(searchParams);
            next.delete('ref');
            setSearchParams(next);
          }
        }}
        title={preview ? `Verification Report · ${preview.report_ref}` : ''}
        subtitle={preview ? `${preview.parcel_id} · ${preview.current_owner} · Audit Ref ${preview.audit_entry_id}` : ''}
        maxWidth="max-w-3xl"
      >
        {preview && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAFAF6] border border-[#E4E7DF] rounded-xl p-4">
              <div>
                <span className="text-[#616D66]">Parcel ID</span>
                <p className="font-mono font-semibold text-[#173F32] mt-0.5">{preview.parcel_id}</p>
              </div>
              <div>
                <span className="text-[#616D66]">Survey No.</span>
                <p className="font-mono font-medium text-[#242B27] mt-0.5">{preview.survey_number}</p>
              </div>
              <div>
                <span className="text-[#616D66]">District</span>
                <p className="font-medium text-[#242B27] mt-0.5">{preview.district_name}</p>
              </div>
              <div>
                <span className="text-[#616D66]">Risk Score</span>
                <div className="mt-1">
                  <RiskScoreDisplay score={preview.risk_score} category={preview.risk_category} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-display font-semibold text-[#242B27] mb-2">Field Comparison Summary</h3>
              <div className="border border-[#E4E7DF] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] text-[#616D66]">
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Registry DB</th>
                      <th className="py-2 px-3">Document</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFF2EC]">
                    {previewComparisons.map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium">{c.label}</td>
                        <td className="py-2 px-3">{c.database_value}</td>
                        <td className="py-2 px-3">{c.extracted_value}</td>
                        <td className="py-2 px-3">
                          <VerificationStatusText status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-[#FAFAF6] border border-[#E4E7DF] rounded-xl space-y-2">
              <h3 className="font-display font-semibold text-[#242B27]">AI Explanation</h3>
              <p className="text-[#616D66] leading-relaxed">{preview.ai_explanation}</p>
              {previewMissing.length > 0 && (
                <p className="text-[#C5831B]">Missing fields: {previewMissing.join(', ')}</p>
              )}
            </div>

            <div>
              <h3 className="font-display font-semibold text-[#242B27] mb-1.5">Recommended Verification Steps</h3>
              <ul className="list-decimal pl-4 space-y-1 text-[#616D66]">
                {previewSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t border-[#E4E7DF] flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-[#616D66]">
                Synthetic demo report · Advisory intelligence only, not legal proof of ownership.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void downloadWithAuth(`/api/reports/${preview.report_ref}/csv`, `${preview.report_ref}.csv`)}
                  className="px-3.5 py-2 border border-[#E4E7DF] rounded-lg hover:bg-[#FAFAF6] cursor-pointer"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => exportVerificationReportPdf(preview)}
                  className="px-3.5 py-2 bg-[#173F32] text-white font-semibold rounded-lg hover:bg-[#113026] cursor-pointer"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
