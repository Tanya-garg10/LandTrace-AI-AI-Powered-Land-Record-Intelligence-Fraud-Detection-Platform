import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { RiskAssessment } from '../types';
import { RiskScoreDisplay, VerificationStatusText } from '../components/StatusText';
import { useToast } from '../components/Toast';

interface RiskIndicator {
  code: string;
  label: string;
  severity: string;
  weight: number;
}

interface RiskEvidence {
  indicator: string;
  detail: string;
}

export function RiskPage() {
  const { canWrite } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [scanningParcel, setScanningParcel] = useState<string | null>(null);

  const loadAssessments = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ assessments: RiskAssessment[] }>('/api/risk/assessments');
      setAssessments(res.assessments);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load risk assessments.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssessments();
  }, []);

  const rescanParcel = async (parcelId: string) => {
    setScanningParcel(parcelId);
    try {
      const res = await apiRequest<{ assessment: { risk_score: number; risk_category: string } }>(
        `/api/risk/evaluate/${encodeURIComponent(parcelId)}`,
        { method: 'POST' }
      );
      notify(`Re-evaluated ${parcelId}: Risk ${res.assessment.risk_score}/100 (${res.assessment.risk_category}).`);
      await loadAssessments();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Risk scan failed.', 'error');
    } finally {
      setScanningParcel(null);
    }
  };

  const counts = useMemo(() => {
    const c = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const a of assessments) {
      c[a.risk_category] = (c[a.risk_category] || 0) + 1;
    }
    return c;
  }, [assessments]);

  const chartData = [
    { category: 'Critical (80–100)', count: counts.Critical, color: '#D95B55' },
    { category: 'High (60–79)', count: counts.High, color: '#E67E45' },
    { category: 'Medium (30–59)', count: counts.Medium, color: '#E5A13A' },
    { category: 'Low (0–29)', count: counts.Low, color: '#398568' },
  ];

  // Aggregate district-level average risk scores for Risk Trends visualization
  const districtRiskTrends = useMemo(() => {
    const map = new Map<string, { district: string; totalScore: number; count: number; flagged: number }>();
    for (const a of assessments) {
      const key = a.district_name || 'Unknown';
      const current = map.get(key) || { district: key.split(' ')[0], totalScore: 0, count: 0, flagged: 0 };
      current.totalScore += a.risk_score;
      current.count += 1;
      if (a.risk_score >= 60) current.flagged += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).map((d) => ({
      district: d.district,
      avgScore: Math.round(d.totalScore / Math.max(1, d.count)),
      elevated: d.flagged,
    }));
  }, [assessments]);

  // Aggregate recurring issue categories across all evaluated parcels
  const issueCategories = useMemo(() => {
    const tally = new Map<string, { code: string; label: string; count: number; totalWeight: number }>();
    for (const a of assessments) {
      let indicators: RiskIndicator[] = [];
      try {
        indicators = JSON.parse(a.indicators_json || '[]') as RiskIndicator[];
      } catch {
        indicators = [];
      }
      for (const ind of indicators) {
        const entry = tally.get(ind.code) || {
          code: ind.code,
          label: ind.label,
          count: 0,
          totalWeight: 0,
        };
        entry.count += 1;
        entry.totalWeight += ind.weight;
        tally.set(ind.code, entry);
      }
    }
    return Array.from(tally.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [assessments]);

  const criticalAlerts = useMemo(
    () => assessments.filter((a) => a.risk_score >= 60).sort((a, b) => b.risk_score - a.risk_score).slice(0, 5),
    [assessments]
  );

  const filtered = useMemo(() => {
    return assessments.filter((a) => {
      if (categoryFilter !== 'All' && a.risk_category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !a.parcel_id.toLowerCase().includes(q) &&
          !(a.current_owner || '').toLowerCase().includes(q) &&
          !(a.district_name || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [assessments, categoryFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27]">
            Risk Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Identify inconsistencies before they become bigger problems.
          </p>
        </div>
        <span className="text-[11px] font-medium text-[#616D66] whitespace-nowrap">
          Advisory Scoring · Human Verification Required
        </span>
      </div>

      {/* Risk Bands + Distribution & District Risk Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
          {(
            [
              ['Critical', '80–100', counts.Critical, 'text-[#D95B55]', 'bg-[#D95B55]'],
              ['High', '60–79', counts.High, 'text-[#E67E45]', 'bg-[#E67E45]'],
              ['Medium', '30–59', counts.Medium, 'text-[#C5831B]', 'bg-[#E5A13A]'],
              ['Low', '0–29', counts.Low, 'text-[#398568]', 'bg-[#398568]'],
            ] as const
          ).map(([label, range, count, tone, dot]) => (
            <button
              key={label}
              onClick={() => setCategoryFilter((prev) => (prev === label ? 'All' : label))}
              className={`bg-white border rounded-xl p-4 text-left transition-colors cursor-pointer ${
                categoryFilter === label
                  ? 'border-[#173F32] bg-[#EAF0E9]/45'
                  : 'border-[#E4E7DF] hover:border-[#398568]/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#616D66]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  {label}
                </span>
                <span className="font-mono text-[11px]">{range}</span>
              </div>
              <p className={`font-display text-2xl font-semibold tabular-nums mt-2.5 ${tone}`}>{count}</p>
              <p className="text-[11px] text-[#616D66] mt-1">Evaluated parcels</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-4 bg-white border border-[#E4E7DF] rounded-xl p-5">
          <h2 className="font-display text-xs font-semibold text-[#242B27] mb-1">Risk Score Band Distribution</h2>
          <p className="text-[11px] text-[#616D66] mb-3">Parcel count across deterministic risk tiers</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFF2EC" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 10, fill: '#616D66' }}
                  tickFormatter={(v: string) => v.split(' ')[0]}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E4E7DF', fontSize: 12 }} />
                <Bar dataKey="count" name="Parcels" radius={[4, 4, 0, 0]} barSize={32}>
                  {chartData.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-[#E4E7DF] rounded-xl p-5">
          <h2 className="font-display text-xs font-semibold text-[#242B27] mb-1">District Risk Intensity</h2>
          <p className="text-[11px] text-[#616D66] mb-3">Average risk score across synthetic districts</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={districtRiskTrends} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFF2EC" vertical={false} />
                <XAxis dataKey="district" tick={{ fontSize: 10, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E4E7DF', fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="avgScore"
                  name="Avg Risk Score"
                  stroke="#E67E45"
                  fill="#E67E45"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Alerts Panel + Detected Issue Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7DF] bg-[#FAFAF6] flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-[#242B27]">Critical &amp; High Priority Alerts</h2>
              <p className="text-[11px] text-[#616D66] mt-0.5">
                Parcels with elevated anomaly scores requiring manual officer scrutiny
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-[#D95B55] tabular-nums">
              {criticalAlerts.length} priority
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-[#E4E7DF] text-[11px] font-semibold text-[#616D66]">
                  <th className="py-2.5 px-4">Parcel</th>
                  <th className="py-2.5 px-4">Owner &amp; District</th>
                  <th className="py-2.5 px-4">Risk Score</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF2EC] text-xs">
                {criticalAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#616D66]">
                      No high or critical risk alerts currently open.
                    </td>
                  </tr>
                ) : (
                  criticalAlerts.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAFAF6]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#173F32] whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(item.parcel_id)}`)}
                          className="hover:underline cursor-pointer"
                        >
                          {item.parcel_id}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#242B27]">{item.current_owner}</p>
                        <p className="text-[11px] text-[#616D66]">
                          {item.survey_number} · {item.district_name}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <RiskScoreDisplay score={item.risk_score} category={item.risk_category} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(item.parcel_id)}`)}
                          className="text-xs font-medium text-[#173F32] hover:underline cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#E4E7DF] bg-[#FAFAF6]">
            <h2 className="font-display text-sm font-semibold text-[#242B27]">Detected Issue Categories</h2>
            <p className="text-[11px] text-[#616D66] mt-0.5">
              Most frequent inconsistencies across evaluated property records
            </p>
          </div>
          <div className="p-5 space-y-3 flex-1">
            {issueCategories.length === 0 ? (
              <p className="text-xs text-[#616D66]">No anomaly categories triggered in current dataset.</p>
            ) : (
              issueCategories.map((cat) => (
                <div key={cat.code} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#E5A13A] shrink-0" />
                    <span className="font-medium text-[#242B27] truncate">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums text-[11px]">
                    <span className="text-[#616D66]">{cat.count} parcels</span>
                    <span className="font-semibold text-[#D95B55]">
                      +{Math.round(cat.totalWeight / Math.max(1, cat.count))} avg pts
                    </span>
                  </div>
                </div>
              ))
            )}

            <div className="pt-3 mt-3 border-t border-[#EFF2EC] text-[11px] text-[#616D66] space-y-1">
              <p className="font-semibold text-[#242B27] inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#398568]" />
                Investigation Guidance
              </p>
              <p className="leading-relaxed">
                Elevated risk scores flag potential record inconsistencies for human review and never serve as standalone
                proof of misconduct or ownership invalidity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by parcel ID, owner, district..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg overflow-x-auto max-w-full">
          {['All', 'Critical', 'High', 'Medium', 'Low'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                categoryFilter === cat ? 'bg-[#EAF0E9] text-[#173F32]' : 'text-[#616D66] hover:text-[#242B27]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Explainable Risk Assessment Cards */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-white border border-[#E4E7DF] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const indicators = JSON.parse(item.indicators_json || '[]') as RiskIndicator[];
            const evidence = JSON.parse(item.evidence_json || '[]') as RiskEvidence[];
            return (
              <div key={item.id} className="bg-white border border-[#E4E7DF] rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EFF2EC]">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(item.parcel_id)}`)}
                      className="font-mono font-semibold text-[#173F32] hover:underline cursor-pointer"
                    >
                      {item.parcel_id}
                    </button>
                    <span className="text-[#616D66]">·</span>
                    <span className="font-medium text-[#242B27]">{item.current_owner}</span>
                    <span className="text-[#616D66]">·</span>
                    <span className="text-[#616D66]">
                      Survey {item.survey_number} ({item.district_name})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    <VerificationStatusText status={item.verification_status || 'Pending Review'} />
                    <RiskScoreDisplay score={item.risk_score} category={item.risk_category} />
                    {canWrite && (
                      <button
                        onClick={() => void rescanParcel(item.parcel_id)}
                        disabled={scanningParcel === item.parcel_id}
                        className="px-3 py-1.5 bg-[#FAFAF6] hover:bg-[#EAF0E9] border border-[#E4E7DF] rounded-lg text-xs font-medium text-[#242B27] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${scanningParcel === item.parcel_id ? 'animate-spin' : ''}`} />
                        <span>Re-scan</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <p className="font-semibold text-[#242B27] flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#173F32]" />
                      <span>Detected Indicators &amp; Weights</span>
                    </p>
                    {indicators.length === 0 ? (
                      <p className="text-[#616D66]">No anomaly indicators triggered; baseline score only.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {indicators.map((ind, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between bg-[#FAFAF6] border border-[#EFF2EC] px-3 py-1.5 rounded-lg"
                          >
                            <span className="font-medium text-[#242B27]">{ind.label}</span>
                            <span className="font-mono text-[11px] text-[#D95B55] tabular-nums">+{ind.weight} pts</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-[#242B27]">Evidence &amp; Recommended Officer Action</p>
                    {evidence.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-[#616D66]">
                        {evidence.map((ev, idx) => (
                          <li key={idx}>
                            <span className="font-medium text-[#242B27]">{ev.indicator}:</span> {ev.detail}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#616D66]">{item.ai_summary}</p>
                    )}
                    <p className="text-[#173F32] font-medium pt-1">
                      Recommendation: {item.recommended_action}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
