import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldCheck, SlidersHorizontal, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { apiRequest } from '../lib/api';
import { RiskScoreDisplay, VerificationStatusText } from '../components/StatusText';

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar_url: string;
  is_active: number;
  audit_actions: number;
  assigned_mutations?: number;
}

interface AdminAnalytics {
  district_stats: Array<{
    district: string;
    code: string;
    state: string;
    total_villages: number;
    property_count: number;
    avg_risk_score: number;
    verified_count: number;
    flagged_count: number;
  }>;
  officer_activity: AdminUserRow[];
  pending_investigations: Array<{
    id: number;
    mutation_ref: string;
    parcel_id: string;
    proposed_owner: string;
    status: string;
    assigned_officer_name: string;
    district_name: string;
    risk_score: number;
    risk_category: string;
  }>;
  document_queue: Array<{
    id: number;
    doc_ref: string;
    parcel_id: string;
    filename: string;
    ai_provider: string;
    ocr_method: string;
    current_owner: string;
    risk_score: number;
    risk_category: string;
  }>;
  system_config?: {
    environment: string;
    database_engine: string;
    ai_pipeline: string;
    hash_algorithm: string;
    self_registration_role: string;
    legal_disclaimer: string;
  };
}

export function AdminPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await apiRequest<AdminAnalytics>('/api/admin/analytics');
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const handleToggleUserStatus = async (target: AdminUserRow) => {
    setTogglingId(target.id);
    try {
      const nextActive = target.is_active === 0;
      await apiRequest(`/api/admin/users/${target.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextActive }),
      });
      notify(`${target.name} ${nextActive ? 'activated' : 'deactivated'}.`, 'success');
      await loadAnalytics();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update user status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading || !data) {
    return <div className="h-80 bg-white border border-[#E4E7DF] rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#242B27]">
            User Governance &amp; System Settings
          </h1>
          <p className="text-xs sm:text-sm text-[#616D66] mt-0.5">
            Signed in as {user?.role} · User account access control, district analytics &amp; investigation queues
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-[#173F32] font-semibold">
          <ShieldCheck className="w-4 h-4 text-[#398568]" />
          <span>Strict 4-Role RBAC Active</span>
        </div>
      </div>

      {/* User & Role Management Table */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4E7DF] bg-[#FAFAF6] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#242B27]">User &amp; Role Directory</h2>
            <p className="text-[11px] text-[#616D66]">
              Self-registration is locked to Citizen / Landowner. Privileged officer roles are centrally provisioned.
            </p>
          </div>
          <span className="font-mono text-xs text-[#616D66] tabular-nums">{data.officer_activity.length} accounts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E4E7DF] bg-[#FAFAF6] text-[11px] font-semibold text-[#616D66]">
                <th className="py-3 px-5">User</th>
                <th className="py-3 px-4">Role &amp; Department</th>
                <th className="py-3 px-4">Activity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFF2EC]">
              {data.officer_activity.map((o) => {
                const isSelf = o.id === user?.id;
                const active = o.is_active !== 0;
                return (
                  <tr key={o.id} className="hover:bg-[#FAFAF6]">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={o.avatar_url || '/src/assets/images/avatar_citizen_landowner_1794898755585.jpg'}
                          alt={o.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-lg object-cover border border-[#E4E7DF] shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-[#242B27]">{o.name}</p>
                          <p className="font-mono text-[11px] text-[#616D66]">{o.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#173F32]">{o.role}</p>
                      <p className="text-[11px] text-[#616D66]">{o.department}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-[#616D66]">
                      {o.audit_actions} audit events · {o.assigned_mutations || 0} mutations
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`font-semibold ${active ? 'text-[#398568]' : 'text-[#D95B55]'}`}>
                        {active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {isSelf ? (
                        <span className="text-[11px] text-[#616D66] font-mono">Current Session</span>
                      ) : (
                        <button
                          onClick={() => void handleToggleUserStatus(o)}
                          disabled={togglingId === o.id}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                            active
                              ? 'border-[#F5C6C4] text-[#D95B55] hover:bg-[#FDF2F2]'
                              : 'border-[#C8DBD3] text-[#173F32] hover:bg-[#EAF0E9]'
                          }`}
                        >
                          {active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          <span>{active ? 'Suspend' : 'Activate'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* District-wise Analytics Chart + Platform Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E4E7DF] rounded-xl p-6">
          <h2 className="font-display text-sm font-semibold text-[#242B27] mb-1">District-Wise Risk &amp; Verification</h2>
          <p className="text-xs text-[#616D66] mb-4">Average risk score vs. verified parcels across synthetic districts</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.district_stats} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFF2EC" vertical={false} />
                <XAxis dataKey="district" tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#616D66' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E4E7DF', fontSize: 12 }} />
                <Bar dataKey="avg_risk_score" name="Avg Risk Score" fill="#C4A36A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="verified_count" name="Verified Parcels" fill="#398568" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#E4E7DF] bg-[#FAFAF6] flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#173F32]" />
            <h2 className="font-display text-sm font-semibold text-[#242B27]">Platform Configuration</h2>
          </div>
          {data.system_config && (
            <dl className="p-5 space-y-3 text-xs flex-1">
              {[
                ['Runtime Environment', data.system_config.environment],
                ['Database Layer', data.system_config.database_engine],
                ['AI Extraction Engine', data.system_config.ai_pipeline],
                ['Audit Cryptography', data.system_config.hash_algorithm],
                ['Self-Registration Policy', data.system_config.self_registration_role],
              ].map(([k, v]) => (
                <div key={k} className="pb-2.5 border-b border-[#EFF2EC] last:border-b-0">
                  <dt className="text-[11px] text-[#616D66]">{k}</dt>
                  <dd className="font-medium text-[#242B27] mt-0.5">{v}</dd>
                </div>
              ))}
              <p className="text-[11px] text-[#616D66] pt-1 leading-relaxed">{data.system_config.legal_disclaimer}</p>
            </dl>
          )}
        </div>
      </div>

      {/* Pending Investigation Cases + Document Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7DF] bg-[#FAFAF6] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#242B27]">Pending Investigation &amp; Review Queue</h2>
            <span className="font-mono text-xs text-[#616D66] tabular-nums">
              {data.pending_investigations.length} cases
            </span>
          </div>
          <div className="divide-y divide-[#EFF2EC] max-h-80 overflow-y-auto">
            {data.pending_investigations.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/workspace/mutations?ref=${encodeURIComponent(item.mutation_ref)}`)}
                className="w-full text-left px-5 py-3.5 hover:bg-[#FAFAF6] flex items-center justify-between gap-3 text-xs cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[#173F32]">{item.mutation_ref}</span>
                    <span className="text-[#616D66]">·</span>
                    <span className="font-mono text-[#242B27]">{item.parcel_id}</span>
                  </div>
                  <p className="text-[#242B27] mt-0.5 truncate">
                    Claimant: {item.proposed_owner} ({item.district_name})
                  </p>
                  <p className="text-[11px] text-[#616D66]">Assigned: {item.assigned_officer_name}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <VerificationStatusText status={item.status} />
                  <RiskScoreDisplay score={item.risk_score} category={item.risk_category} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7DF] bg-[#FAFAF6] flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#242B27]">Document Verification Queue</h2>
            <button
              onClick={() => navigate('/workspace/documents')}
              className="text-xs font-medium text-[#173F32] hover:underline cursor-pointer"
            >
              Open AI Verification
            </button>
          </div>
          <div className="divide-y divide-[#EFF2EC] max-h-80 overflow-y-auto">
            {data.document_queue.map((doc) => (
              <button
                key={doc.id}
                onClick={() => navigate(`/workspace/properties?parcel=${encodeURIComponent(doc.parcel_id)}`)}
                className="w-full text-left px-5 py-3.5 hover:bg-[#FAFAF6] flex items-center justify-between gap-3 text-xs cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[#173F32]">{doc.doc_ref}</span>
                    <span className="text-[#616D66]">·</span>
                    <span className="font-mono text-[#242B27]">{doc.parcel_id}</span>
                  </div>
                  <p className="font-medium text-[#242B27] truncate mt-0.5">{doc.filename}</p>
                  <p className="text-[11px] text-[#616D66] truncate">
                    {doc.ai_provider} · {doc.ocr_method}
                  </p>
                </div>
                <RiskScoreDisplay score={doc.risk_score} category={doc.risk_category} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
