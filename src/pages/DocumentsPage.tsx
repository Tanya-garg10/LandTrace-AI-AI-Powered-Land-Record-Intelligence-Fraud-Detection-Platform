import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  FileUp,
  Play,
  ShieldAlert,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, downloadWithAuth } from '../lib/api';
import { exportVerificationReportPdf } from '../lib/pdfExport';
import type { DocumentAnalysisResponse, DocumentRecord, Property, VerificationReport } from '../types';
import { RiskScoreDisplay, VerificationStatusText } from '../components/StatusText';
import { useToast } from '../components/Toast';

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.txt'];

function highlightTextLines(text: string, terms: string[]): React.ReactNode {
  const cleanTerms = terms.map((t) => t.trim()).filter((t) => t.length >= 3);
  if (!cleanTerms.length) return text;
  const escaped = cleanTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    const matched = cleanTerms.some((t) => t.toLowerCase() === part.toLowerCase());
    if (matched) {
      return (
        <mark key={idx} className="bg-[#EAF0E9] text-[#173F32] font-semibold px-1 rounded">
          {part}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function DocumentsPage() {
  const { user, canWrite, canVerifyDocuments } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [properties, setProperties] = useState<Property[]>([]);
  const [recentDocs, setRecentDocs] = useState<DocumentRecord[]>([]);
  const [selectedParcel, setSelectedParcel] = useState(searchParams.get('parcel') || 'LT-PAR-1004');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewText, setPreviewText] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  const [zoomPct, setZoomPct] = useState(100);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerMode, setViewerMode] = useState<'preview' | 'highlights'>('preview');

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<DocumentAnalysisResponse | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<string>('');
  const [deciding, setDeciding] = useState(false);

  const canUploadDoc = canWrite || user?.role === 'Citizen / Landowner';

  const loadInitial = async () => {
    try {
      const propQuery = user?.role === 'Citizen / Landowner' ? '/api/properties?limit=100&scope=mine' : '/api/properties?limit=100';
      const [propsRes, docsRes] = await Promise.all([
        apiRequest<{ properties: Property[] }>(propQuery),
        apiRequest<{ documents: DocumentRecord[] }>('/api/documents'),
      ]);
      setProperties(propsRes.properties);
      if (propsRes.properties.length > 0 && !searchParams.get('parcel')) {
        setSelectedParcel((prev) =>
          propsRes.properties.some((p) => p.parcel_id === prev) ? prev : propsRes.properties[0].parcel_id
        );
      }
      setRecentDocs(docsRes.documents);
    } catch {
      // ignore initial error
    }
  };

  useEffect(() => {
    void loadInitial();
  }, [user?.role]);

  const handleFileSelect = (chosen: File | null) => {
    if (!chosen) return;
    const lower = chosen.name.toLowerCase();
    const valid = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
    if (!valid) {
      notify('Unsupported file format. Upload PDF, JPG, JPEG, PNG, or TXT.', 'error');
      return;
    }
    if (chosen.size > 12 * 1024 * 1024) {
      notify('File exceeds 12 MB limit.', 'error');
      return;
    }
    setFile(chosen);
    setPreviewText('');
    setViewerMode('preview');
    setViewerPage(1);
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (chosen.type.startsWith('image/') || chosen.type === 'application/pdf') {
      setPreviewUrl(URL.createObjectURL(chosen));
    } else {
      setPreviewUrl('');
      chosen.text().then((t) => setPreviewText(t.slice(0, 3500))).catch(() => undefined);
    }
  };

  const resetUpload = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewText('');
    setResult(null);
    setZoomPct(100);
  };

  const runAnalysis = async (samplePreset?: string, overrideParcel?: string) => {
    const targetParcel = overrideParcel || selectedParcel;
    if (!targetParcel) {
      notify('Please select a target property parcel.', 'error');
      return;
    }
    if (!samplePreset && !file) {
      notify('Please upload a property document or run a sample scenario.', 'error');
      return;
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('parcel_id', targetParcel);
      if (samplePreset) {
        formData.append('sample_preset', samplePreset);
        setSelectedParcel(targetParcel);
      } else if (file) {
        formData.append('file', file);
      }

      const data = await apiRequest<DocumentAnalysisResponse>('/api/documents/analyze', {
        method: 'POST',
        body: formData,
      });

      setResult(data);
      setDecisionStatus('');
      setViewerMode('highlights');
      await loadInitial();
      notify(
        data.mismatched_fields.length > 0
          ? `Analysis complete: ${data.mismatched_fields.length} discrepancy detected & logged.`
          : 'Document verified cleanly against existing registry record.'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Document analysis failed.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleHumanDecision = async (
    decision: 'Approve Review' | 'Request Clarification' | 'Flag for Investigation'
  ) => {
    if (!result) return;
    setDeciding(true);
    try {
      const res = await apiRequest<{ audit_event_id: string }>('/api/verification/decision', {
        method: 'POST',
        body: JSON.stringify({
          report_ref: result.report_ref,
          decision,
          notes: `Officer review recorded on ${result.report_ref}: ${decision}`,
        }),
      });
      setDecisionStatus(decision);
      notify(`Verification decision "${decision}" recorded (${res.audit_event_id}).`);
      await loadInitial();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to record verification decision.', 'error');
    } finally {
      setDeciding(false);
    }
  };

  const handleExportPdf = async (reportRef: string) => {
    try {
      const res = await apiRequest<{ report: VerificationReport }>(`/api/reports/${encodeURIComponent(reportRef)}`);
      exportVerificationReportPdf(res.report);
    } catch {
      notify('Unable to generate PDF report.', 'error');
    }
  };

  const highlightTerms = useMemo(() => {
    if (!result) return [];
    const f = result.extracted_fields;
    return [f.owner_name, f.previous_owner, f.parcel_id, f.survey_number, f.land_area, f.registration_date, f.document_reference];
  }, [result]);

  const ownerMismatch = result?.mismatched_fields.find((m) => m.field === 'owner_name');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#242B27]">
            AI Document Verification
          </h1>
          <p className="text-xs text-[#616D66] mt-0.5">
            Split-screen document inspection and Gemini structured comparison · Demo data only
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/sample-documents/demo-mismatch-lt-par-1004"
            className="px-3 py-2 bg-white border border-[#E4E7DF] hover:bg-[#FAFAF6] text-xs font-medium text-[#242B27] rounded-lg inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample Deed</span>
          </a>
          {canUploadDoc && (
            <button
              onClick={() => void runAnalysis('demo-mismatch-lt-par-1004', 'LT-PAR-1004')}
              disabled={analyzing}
              className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Demo Mismatch (LT-PAR-1004)</span>
            </button>
          )}
        </div>
      </div>

      {/* Signature Split-Screen Intelligence Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT PANEL: Document Viewer */}
        <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl flex flex-col overflow-hidden">
          {/* Viewer Toolbar */}
          <div className="px-4 py-3 border-b border-[#E4E7DF] bg-[#FAFAF6] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-white border border-[#E4E7DF] rounded-lg text-xs">
              <button
                onClick={() => setViewerMode('preview')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  viewerMode === 'preview' ? 'bg-[#EAF0E9] text-[#173F32]' : 'text-[#616D66]'
                }`}
              >
                Document Preview
              </button>
              <button
                onClick={() => setViewerMode('highlights')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  viewerMode === 'highlights' ? 'bg-[#EAF0E9] text-[#173F32]' : 'text-[#616D66]'
                }`}
              >
                Extracted Text Highlights
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-[#616D66]">
              <button
                onClick={() => setZoomPct((z) => Math.max(70, z - 15))}
                className="p-1.5 bg-white border border-[#E4E7DF] rounded-md hover:bg-[#EAF0E9]/50 cursor-pointer"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] w-10 text-center tabular-nums">{zoomPct}%</span>
              <button
                onClick={() => setZoomPct((z) => Math.min(160, z + 15))}
                className="p-1.5 bg-white border border-[#E4E7DF] rounded-md hover:bg-[#EAF0E9]/50 cursor-pointer"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="mx-1 text-[#D2D8CE]">|</span>
              <button
                onClick={() => setViewerPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-white border border-[#E4E7DF] rounded-md hover:bg-[#EAF0E9]/50 cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] tabular-nums">Pg {viewerPage}</span>
              <button
                onClick={() => setViewerPage((p) => p + 1)}
                className="p-1.5 bg-white border border-[#E4E7DF] rounded-md hover:bg-[#EAF0E9]/50 cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Target Parcel + Upload Control */}
          <div className="p-4 border-b border-[#EFF2EC] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex-1">
              <select
                value={selectedParcel}
                onChange={(e) => setSelectedParcel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
                aria-label="Select target property record"
              >
                {properties.map((p) => (
                  <option key={p.parcel_id} value={p.parcel_id}>
                    {p.parcel_id} · {p.current_owner} ({p.survey_number})
                  </option>
                ))}
              </select>
            </div>
            {(file || result) && (
              <button
                onClick={resetUpload}
                className="px-3 py-2 text-xs font-medium text-[#173F32] bg-[#EAF0E9] hover:bg-[#DCE7DC] rounded-lg whitespace-nowrap cursor-pointer"
              >
                Upload Another Document
              </button>
            )}
          </div>

          {/* Viewer Canvas */}
          <div className="flex-1 p-5 bg-[#FAFAF6] min-h-[420px] flex flex-col">
            {viewerMode === 'highlights' && result ? (
              <div className="bg-white border border-[#E4E7DF] rounded-xl p-5 flex-1 overflow-auto">
                <div className="flex items-center justify-between text-[11px] text-[#616D66] pb-3 mb-3 border-b border-[#EFF2EC]">
                  <span>OCR Method: {result.ocr_method}</span>
                  <span>Highlighted Entities: Owner, Parcel, Survey, Area, Date</span>
                </div>
                <pre
                  className="font-mono text-xs text-[#242B27] whitespace-pre-wrap leading-relaxed origin-top-left transition-transform"
                  style={{ fontSize: `${Math.round((12 * zoomPct) / 100)}px` }}
                >
                  {highlightTextLines(result.extracted_text, highlightTerms)}
                </pre>
              </div>
            ) : file || previewUrl || previewText ? (
              <div className="bg-white border border-[#E4E7DF] rounded-xl p-4 flex-1 overflow-auto flex flex-col items-center justify-center">
                {file?.type.startsWith('image/') && previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Uploaded land document"
                    style={{ transform: `scale(${zoomPct / 100})` }}
                    className="max-h-[400px] object-contain transition-transform"
                  />
                )}
                {file?.type === 'application/pdf' && previewUrl && (
                  <iframe src={`${previewUrl}#page=${viewerPage}`} title="PDF Document" className="w-full h-[420px]" />
                )}
                {previewText && (
                  <pre
                    className="w-full font-mono text-xs text-[#242B27] whitespace-pre-wrap leading-relaxed"
                    style={{ fontSize: `${Math.round((12 * zoomPct) / 100)}px` }}
                  >
                    {previewText}
                  </pre>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleFileSelect(e.dataTransfer.files?.[0] || null);
                }}
                className={`flex-1 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
                  dragActive ? 'border-[#173F32] bg-[#EAF0E9]/40' : 'border-[#CFD5C9] bg-white'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-[#EAF0E9] flex items-center justify-center mb-3">
                  <FileUp className="w-6 h-6 text-[#173F32]" />
                </div>
                <p className="font-display text-sm font-semibold text-[#242B27]">
                  Drop property deed, mutation scan, or extract
                </p>
                <p className="text-xs text-[#616D66] mt-1 max-w-xs">
                  Supports PDF, JPG, JPEG, PNG, and TXT instruments up to 12 MB
                </p>
                <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-medium rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Select Document</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.txt"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}
          </div>

          {canUploadDoc && file && (
            <div className="p-4 border-t border-[#E4E7DF] bg-white flex items-center justify-between gap-3">
              <span className="text-xs text-[#616D66] truncate">{file.name}</span>
              <button
                onClick={() => void runAnalysis()}
                disabled={analyzing}
                className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] disabled:opacity-50 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
              >
                {analyzing ? 'Analyzing with Gemini...' : 'Run Gemini Verification'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Gemini Document Intelligence */}
        <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E4E7DF] bg-[#FAFAF6] flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-[#242B27]">Gemini Document Intelligence</h2>
              <p className="text-[11px] text-[#616D66]">Structured extraction &amp; cross-record verification</p>
            </div>
            <span className="text-[11px] font-medium text-[#173F32]">
              {analyzing ? 'Processing document...' : result ? result.ai_provider : 'Ready'}
            </span>
          </div>

          {result ? (
            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
              {/* Structured Extracted Fields Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAFAF6] border border-[#E4E7DF] rounded-xl p-4">
                <div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#616D66] uppercase">Owner Name</span>
                  <p className="text-xs font-semibold text-[#242B27] mt-0.5">
                    {result.extracted_fields.owner_name || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#616D66] uppercase">Parcel ID</span>
                  <p className="font-mono text-xs font-semibold text-[#173F32] mt-0.5">
                    {result.extracted_fields.parcel_id || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#616D66] uppercase">Survey Number</span>
                  <p className="font-mono text-xs font-medium text-[#242B27] mt-0.5">
                    {result.extracted_fields.survey_number || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#616D66] uppercase">Land Area</span>
                  <p className="font-display text-xs font-semibold text-[#242B27] tabular-nums mt-0.5">
                    {result.extracted_fields.land_area || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#616D66] uppercase">Registration Date</span>
                  <p className="font-mono text-xs text-[#242B27] tabular-nums mt-0.5">
                    {result.extracted_fields.registration_date || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#616D66] uppercase">Risk Score</span>
                  <div className="mt-0.5">
                    <RiskScoreDisplay
                      score={result.risk_assessment.risk_score}
                      category={result.risk_assessment.risk_category}
                    />
                  </div>
                </div>
              </div>

              {/* Document-to-Record Comparison Table */}
              <div>
                <h3 className="text-xs font-semibold text-[#242B27] mb-2">Document-to-Record Comparison</h3>
                <div className="border border-[#E4E7DF] rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                        <th className="py-2.5 px-3">Field</th>
                        <th className="py-2.5 px-3">Uploaded Document</th>
                        <th className="py-2.5 px-3">Existing Record</th>
                        <th className="py-2.5 px-3">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFF2EC]">
                      {result.comparisons.map((c) => {
                        const isOwnerMismatch = c.field === 'owner_name' && c.status === 'Mismatched';
                        return (
                          <tr key={c.field} className={isOwnerMismatch ? 'bg-[#FDF4F4]' : ''}>
                            <td className="py-2.5 px-3 font-medium text-[#242B27]">{c.label}</td>
                            <td
                              className={`py-2.5 px-3 font-medium ${
                                isOwnerMismatch ? 'text-[#B83B35]' : 'text-[#242B27]'
                              }`}
                            >
                              {c.extracted_value}
                            </td>
                            <td className="py-2.5 px-3 text-[#616D66]">{c.database_value}</td>
                            <td className="py-2.5 px-3">
                              <VerificationStatusText status={c.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Distinctive AI Explanation Card */}
              <div
                className={`rounded-xl p-4 border space-y-2 ${
                  ownerMismatch || result.mismatched_fields.length > 0
                    ? 'bg-[#FDF4F4] border-[#F5C6C4]'
                    : 'bg-[#EAF0E9]/45 border-[#C8DBD3]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xs font-bold text-[#242B27] flex items-center gap-1.5">
                    {ownerMismatch || result.mismatched_fields.length > 0 ? (
                      <ShieldAlert className="w-4 h-4 text-[#D95B55]" />
                    ) : (
                      <FileCheck2 className="w-4 h-4 text-[#398568]" />
                    )}
                    <span>
                      {ownerMismatch
                        ? 'Potential Ownership Mismatch'
                        : result.mismatched_fields.length > 0
                        ? 'Potential Record Inconsistency Detected'
                        : 'Fields Consistent With Registry Record'}
                    </span>
                  </h3>
                  {result.flagged_mutation_ref && (
                    <button
                      onClick={() => navigate(`/workspace/mutations?ref=${encodeURIComponent(result.flagged_mutation_ref!)}`)}
                      className="font-mono text-[11px] font-semibold text-[#D95B55] hover:underline cursor-pointer"
                    >
                      {result.flagged_mutation_ref} Flagged
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#242B27] leading-relaxed">
                  {ownerMismatch
                    ? 'Uploaded document contains a different owner name from the existing property record. Further manual verification is recommended.'
                    : result.extracted_fields.explanation}
                </p>
              </div>

              {/* Human Review Actions (Document Verification Officer & System Admin) */}
              {canVerifyDocuments && (
                <div className="p-4 rounded-xl bg-[#FAFAF6] border border-[#E4E7DF] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#242B27]">Officer Human Review Determination</span>
                    {decisionStatus && (
                      <span className="font-mono font-semibold text-[#173F32]">Recorded: {decisionStatus}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void handleHumanDecision('Approve Review')}
                      disabled={deciding}
                      className="px-3 py-1.5 bg-[#173F32] hover:bg-[#113026] disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Approve Review
                    </button>
                    <button
                      onClick={() => void handleHumanDecision('Request Clarification')}
                      disabled={deciding}
                      className="px-3 py-1.5 bg-[#FEF9EE] border border-[#E5A13A] hover:bg-[#FDEFC8] disabled:opacity-50 text-[#9A630E] text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Request Clarification
                    </button>
                    <button
                      onClick={() => void handleHumanDecision('Flag for Investigation')}
                      disabled={deciding}
                      className="px-3 py-1.5 bg-[#FDF4F4] border border-[#D95B55] hover:bg-[#FADCDC] disabled:opacity-50 text-[#B83B35] text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Flag for Investigation
                    </button>
                  </div>
                  <p className="text-[11px] text-[#616D66]">
                    Preliminary AI findings assist human inspection and are not legally conclusive.
                  </p>
                </div>
              )}

              {/* Summary Indicators + Generate Report */}
              <div className="pt-3 border-t border-[#EFF2EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#616D66] tabular-nums">
                  <span>
                    Confidence: <strong className="text-[#242B27]">{result.extracted_fields.confidence_level}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Matched: <strong className="text-[#398568]">{result.matched_fields.length}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Mismatched: <strong className="text-[#D95B55]">{result.mismatched_fields.length}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Missing: <strong className="text-[#C5831B]">{result.missing_fields.length}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => void downloadWithAuth(`/api/reports/${result.report_ref}/csv`, `${result.report_ref}.csv`)}
                    className="px-3 py-2 bg-white border border-[#E4E7DF] hover:bg-[#FAFAF6] text-xs font-medium text-[#242B27] rounded-lg cursor-pointer"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => void handleExportPdf(result.report_ref)}
                    className="px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-11 h-11 rounded-xl bg-[#EAF0E9] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#173F32]" />
              </div>
              <h3 className="font-display text-sm font-semibold text-[#242B27]">
                Ready for Gemini Structured Comparison
              </h3>
              <p className="text-xs text-[#616D66] max-w-sm leading-relaxed">
                Upload a property deed on the left or run the <strong className="text-[#242B27]">LT-PAR-1004</strong>{' '}
                demo mismatch workflow to inspect extracted fields, comparisons, risk scoring, and audit events.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-[11px] text-[#616D66]">
                <AlertTriangle className="w-3.5 h-3.5 text-[#C4A36A]" />
                <span>Advisory intelligence only — demo records do not establish legal title.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Analyzed Documents Strip */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E4E7DF] flex items-center justify-between">
          <h3 className="font-display text-xs font-semibold text-[#242B27]">Recent Document Verifications</h3>
          <span className="text-[11px] text-[#616D66] tabular-nums">{recentDocs.length} documents</span>
        </div>
        <div className="divide-y divide-[#EFF2EC] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {recentDocs.slice(0, 6).map((d) => (
            <div key={d.id} className="p-4 flex items-center justify-between gap-3 text-xs border-r border-[#EFF2EC]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-[#173F32]">{d.doc_ref}</span>
                  <span className="text-[#616D66]">·</span>
                  <span className="font-mono text-[#242B27]">{d.parcel_id}</span>
                </div>
                <p className="text-[#616D66] truncate mt-0.5">{d.filename}</p>
              </div>
              <button
                onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(d.parcel_id)}`)}
                className="text-xs font-medium text-[#173F32] hover:underline shrink-0 cursor-pointer"
              >
                Inspect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
