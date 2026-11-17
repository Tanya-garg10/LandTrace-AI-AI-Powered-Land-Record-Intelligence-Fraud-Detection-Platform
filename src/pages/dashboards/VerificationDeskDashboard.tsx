import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileUp,
  Flag,
  HelpCircle,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { RiskScoreDisplay, VerificationStatusText } from '../../components/StatusText';
import { useToast } from '../../components/Toast';
import { apiRequest } from '../../lib/api';
import type { FieldComparison, VerificationReport } from '../../types';

export interface VerificationQueueItem extends VerificationReport {
  extracted_text?: string;
}

export interface VerificationOverviewData {
  role: string;
  kpis: {
    documents_analyzed: number;
    pending_human_reviews: number;
    mismatch_alerts: number;
    approved_reviews: number;
  };
  verification_queue: VerificationQueueItem[];
}

export function VerificationDeskDashboard({
  data,
  onRefresh,
}: {
  data: VerificationOverviewData;
  onRefresh: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [selectedRef, setSelectedRef] = useState<string>(data.verification_queue[0]?.report_ref || '');
  const [zoom, setZoom] = useState<number>(100);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeItem =
    data.verification_queue.find((q) => q.report_ref === selectedRef) || data.verification_queue[0] || null;

  const comparisons: FieldComparison[] = activeItem ? JSON.parse(activeItem.comparison_json || '[]') : [];
  const extractedFields: Record<string, string> = activeItem ? JSON.parse(activeItem.extracted_fields_json || '{}') : {};
  const missingFields: string[] = activeItem ? JSON.parse(activeItem.missing_fields_json || '[]') : [];

  const handleDecision = async (decision: 'Approve Review' | 'Request Clarification' | 'Flag for Investigation') => {
    if (!activeItem) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ audit_event_id: string }>('/api/verification/decision', {
        method: 'POST',
        body: JSON.stringify({
          report_ref: activeItem.report_ref,
          decision,
          notes: decisionNotes.trim() || `Officer decision recorded: ${decision}`,
        }),
      });
      notify(`${activeItem.report_ref} marked "${decision}" (${res.audit_event_id}).`, 'success');
      setDecisionNotes('');
      await onRefresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save review decision.', 'error');
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
            Document Verification Officer
          </p>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27] mt-0.5">
            Document Intelligence &amp; Verification Desk
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Compare uploaded deeds side-by-side against Gemini OCR extractions and issue human review determinations.
          </p>
        </div>

        <button
          onClick={() => navigate('/workspace/documents')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#173F32] hover:bg-[#113026] text-white text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span>Upload &amp; Analyze New Deed</span>
        </button>
      </div>

      {/* 4 Verification KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Documents Analyzed', value: data.kpis.documents_analyzed, note: 'OCR & Gemini structured scans', accent: '#173F32' },
          { label: 'Pending Human Reviews', value: data.kpis.pending_human_reviews, note: 'Awaiting officer decision', accent: '#C5831B' },
          { label: 'Mismatch Alerts', value: data.kpis.mismatch_alerts, note: 'Risk score >= 45 detected', accent: '#D95B55' },
          { label: 'Approved Reviews', value: data.kpis.approved_reviews, note: 'Cleared by verification desk', accent: '#398568' },
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

      {/* Queue Selector Strip */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-3 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-semibold text-[#616D66] px-2 whitespace-nowrap">Review Queue:</span>
        {data.verification_queue.map((item) => {
          const active = activeItem?.report_ref === item.report_ref;
          return (
            <button
              key={item.report_ref}
              onClick={() => setSelectedRef(item.report_ref)}
              className={`px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? 'bg-[#173F32] border-[#173F32] text-white font-semibold'
                  : 'bg-[#FAFAF6] border-[#E4E7DF] text-[#242B27] hover:border-[#398568]'
              }`}
            >
              <span className="font-mono">{item.parcel_id}</span>
              <span className="mx-1.5 opacity-60">·</span>
              <span className="tabular-nums">Risk {item.risk_score}</span>
              {item.human_decision === 'Pending Review' && (
                <span className={`ml-1.5 text-[10px] ${active ? 'text-[#C4A36A]' : 'text-[#C5831B]'}`}>(Pending)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Signature Split-Screen Verification Desk */}
      {activeItem && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT: Document Preview + OCR Highlights */}
          <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E4E7DF] bg-[#FAFAF6] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-[#242B27] truncate">
                  {activeItem.filename || `${activeItem.doc_ref || 'DOC'}.txt`}
                </p>
                <p className="text-[11px] text-[#616D66] font-mono">
                  {activeItem.doc_ref} · {activeItem.ocr_method || 'Gemini OCR'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setZoom((z) => Math.max(80, z - 10))}
                  className="p-1.5 rounded-md border border-[#E4E7DF] bg-white text-[#242B27] hover:bg-[#FAFAF6] cursor-pointer"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] text-[#616D66] w-10 text-center tabular-nums">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(140, z + 10))}
                  className="p-1.5 rounded-md border border-[#E4E7DF] bg-white text-[#242B27] hover:bg-[#FAFAF6] cursor-pointer"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-5 bg-[#F4F6F1] overflow-auto max-h-[520px]">
              <div
                className="bg-white border border-[#E4E7DF] rounded-lg p-5 shadow-xs font-mono text-[#242B27] whitespace-pre-wrap leading-relaxed"
                style={{ fontSize: `${Math.round((12 * zoom) / 100)}px` }}
              >
                {activeItem.extracted_text ||
                  `DOCUMENT INSTRUMENT: ${activeItem.doc_ref}\nPARCEL ID: ${activeItem.parcel_id}\nSURVEY NUMBER: ${activeItem.survey_number}\nEXTRACTED OWNER: ${extractedFields.owner_name || activeItem.current_owner}\nLAND EXTENT: ${extractedFields.land_area || activeItem.land_area_display}\nREGISTRATION DATE: ${extractedFields.registration_date || activeItem.registration_date}\n\n[Synthetic OCR Highlighted Extract — Open Document Intelligence page to upload full PDF or image scans.]`}
              </div>
            </div>
          </div>

          {/* RIGHT: Gemini AI Analysis, Comparison & Human Review Actions */}
          <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E4E7DF] bg-[#FAFAF6] flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-[#242B27]">
                  Gemini AI Extraction &amp; Field Comparison
                </h2>
                <p className="text-[11px] text-[#616D66]">
                  Report {activeItem.report_ref} · Confidence: {extractedFields.confidence_level || 'High'}
                </p>
              </div>
              <RiskScoreDisplay score={activeItem.risk_score} category={activeItem.risk_category} />
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* Field-by-field comparison table */}
              <div className="border border-[#E4E7DF] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAFAF6] border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Extracted</th>
                      <th className="py-2 px-3">Registry</th>
                      <th className="py-2 px-3">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFF2EC]">
                    {comparisons.map((c) => {
                      const isMismatch = c.status === 'Mismatched';
                      const isMissing = c.status === 'Missing';
                      return (
                        <tr
                          key={c.field}
                          className={
                            isMismatch ? 'bg-[#FDF4F4]' : isMissing ? 'bg-[#FEF9EE]' : 'bg-[#EAF0E9]/20'
                          }
                        >
                          <td className="py-2 px-3 font-medium text-[#242B27]">{c.label}</td>
                          <td className={`py-2 px-3 font-medium ${isMismatch ? 'text-[#B83B35]' : 'text-[#242B27]'}`}>
                            {c.extracted_value}
                          </td>
                          <td className="py-2 px-3 text-[#616D66]">{c.database_value}</td>
                          <td className="py-2 px-3">
                            <VerificationStatusText status={c.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {missingFields.length > 0 && (
                <div className="p-3 rounded-lg bg-[#FEF9EE] border border-[#F5DFB5] text-xs text-[#9A630E]">
                  <strong>Missing Fields Detected:</strong> {missingFields.join(', ')}
                </div>
              )}

              {/* AI Explanation */}
              <div className="p-3.5 rounded-xl bg-[#FAFAF6] border border-[#E4E7DF] space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#242B27] flex items-center gap-1.5">
                    {activeItem.risk_score >= 45 ? (
                      <ShieldAlert className="w-4 h-4 text-[#D95B55]" />
                    ) : (
                      <FileCheck2 className="w-4 h-4 text-[#398568]" />
                    )}
                    <span>Preliminary AI Explanation</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#173F32] font-semibold">
                    Current Decision: {activeItem.human_decision || 'Pending Review'}
                  </span>
                </div>
                <p className="text-[#525E57] leading-relaxed">{activeItem.ai_explanation}</p>
              </div>

              {/* Human Review Actions */}
              <div className="pt-2 border-t border-[#EFF2EC] space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#242B27] mb-1">
                    Officer Review Notes (Logged to SHA-256 Audit Trail)
                  </label>
                  <input
                    type="text"
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Record verification rationale or clarification request..."
                    className="w-full px-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void handleDecision('Approve Review')}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#173F32] hover:bg-[#113026] disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Review</span>
                  </button>
                  <button
                    onClick={() => void handleDecision('Request Clarification')}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FEF9EE] border border-[#E5A13A] hover:bg-[#FDEFC8] disabled:opacity-50 text-[#9A630E] text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Request Clarification</span>
                  </button>
                  <button
                    onClick={() => void handleDecision('Flag for Investigation')}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FDF4F4] border border-[#D95B55] hover:bg-[#FADCDC] disabled:opacity-50 text-[#B83B35] text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Flag for Investigation</span>
                  </button>
                </div>

                <div className="flex items-start gap-2 text-[11px] text-[#616D66] pt-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#C4A36A] shrink-0 mt-0.5" />
                  <span>
                    AI comparison results are preliminary decision-support indicators only and are not legally conclusive proof of ownership or fraud.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
