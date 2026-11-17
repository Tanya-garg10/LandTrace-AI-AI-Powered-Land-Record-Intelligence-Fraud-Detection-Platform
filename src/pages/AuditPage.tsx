import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Link2, Lock, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { AuditLogEntry, LedgerVerificationReport } from '../types';
import { useToast } from '../components/Toast';

export function AuditPage() {
  const { notify } = useToast();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [verification, setVerification] = useState<LedgerVerificationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [parcelSearch, setParcelSearch] = useState('');

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const qs = parcelSearch.trim() ? `?parcel_id=${encodeURIComponent(parcelSearch.trim())}` : '';
      const [ledgerRes, verifyRes] = await Promise.all([
        apiRequest<{ entries: AuditLogEntry[] }>(`/api/audit/ledger${qs}`),
        apiRequest<LedgerVerificationReport>('/api/audit/verify'),
      ]);
      setEntries(ledgerRes.entries);
      setVerification(verifyRes);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load integrity ledger.', 'error');
    } finally {
      setLoading(false);
    }
  }, [parcelSearch, notify]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const runIntegrityCheck = async () => {
    setVerifying(true);
    try {
      const res = await apiRequest<LedgerVerificationReport>('/api/audit/verify');
      setVerification(res);
      notify(
        res.status === 'VERIFIED'
          ? `Integrity verified: ${res.verified_entries} of ${res.total_entries} SHA-256 chain links intact.`
          : `Integrity inconsistency detected across ${res.broken_links} entry link(s).`,
        res.status === 'VERIFIED' ? 'success' : 'error'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Integrity verification failed.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#242B27]">
            Integrity Ledger
          </h1>
          <p className="text-xs text-[#616D66] mt-0.5">
            Application-level SHA-256 hash-chain linking every property, mutation, and verification event
          </p>
        </div>
        <button
          onClick={() => void runIntegrityCheck()}
          disabled={verifying}
          className="px-4 py-2.5 bg-[#173F32] hover:bg-[#113026] disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{verifying ? 'Verifying SHA-256 Chain...' : 'Verify Ledger Integrity'}</span>
        </button>
      </div>

      {/* Integrity Verification Summary */}
      {verification && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E4E7DF] rounded-xl p-5">
            <span className="text-xs text-[#616D66]">Integrity Status</span>
            <div className="mt-2 flex items-center gap-2">
              {verification.status === 'VERIFIED' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-[#398568]" />
                  <span className="font-display text-lg font-bold text-[#398568]">Verified</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5 text-[#D95B55]" />
                  <span className="font-display text-lg font-bold text-[#D95B55]">Inconsistency Detected</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#E4E7DF] rounded-xl p-5">
            <span className="text-xs text-[#616D66]">Entries Checked</span>
            <p className="font-display text-2xl font-semibold text-[#242B27] mt-2 tabular-nums">
              {verification.total_entries}
            </p>
          </div>

          <div className="bg-white border border-[#E4E7DF] rounded-xl p-5">
            <span className="text-xs text-[#616D66]">Chain Links Verified</span>
            <p className="font-display text-2xl font-semibold text-[#398568] mt-2 tabular-nums">
              {verification.verified_entries}
            </p>
          </div>

          <div className="bg-white border border-[#E4E7DF] rounded-xl p-5">
            <span className="text-xs text-[#616D66]">Detected Inconsistencies</span>
            <p
              className={`font-display text-2xl font-semibold mt-2 tabular-nums ${
                verification.broken_links === 0 ? 'text-[#242B27]' : 'text-[#D95B55]'
              }`}
            >
              {verification.broken_links}
            </p>
          </div>
        </div>
      )}

      {/* Filter + Honest Scope Note */}
      <div className="bg-white border border-[#E4E7DF] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-[#616D66] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={parcelSearch}
            onChange={(e) => setParcelSearch(e.target.value)}
            placeholder="Filter chain by Parcel ID..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAFAF6] border border-[#E4E7DF] rounded-lg focus:outline-none focus:border-[#173F32]"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#616D66]">
          <Lock className="w-3.5 h-3.5 text-[#173F32] shrink-0" />
          <span>
            Application-level SHA-256 hash-chain (not a public blockchain; detects payload edits and broken links).
          </span>
        </div>
      </div>

      {/* Connected Vertical Hash-Chain Visualization */}
      {loading ? (
        <div className="h-64 bg-white border border-[#E4E7DF] rounded-xl animate-pulse" />
      ) : (
        <div className="relative pl-8 space-y-5 before:content-[''] before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-0.5 before:bg-[#C8DBD3]">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="relative">
              {/* Connected Chain Node */}
              <div
                className="absolute -left-8 top-5 w-8 h-8 rounded-full bg-white border-2 border-[#398568] flex items-center justify-center shadow-sm"
                title={`Block #${entries.length - idx}`}
              >
                <Link2 className="w-3.5 h-3.5 text-[#173F32]" />
              </div>

              <div className="bg-white border border-[#E4E7DF] hover:border-[#398568]/50 rounded-xl p-5 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EFF2EC]">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#173F32]">{entry.event_id}</span>
                    <span className="text-[#616D66]">·</span>
                    <span className="font-mono font-semibold text-[#242B27]">{entry.parcel_id}</span>
                    <span className="text-[#616D66]">·</span>
                    <span className="font-semibold text-[#242B27]">{entry.action}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="inline-flex items-center gap-1 text-[#398568] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Chain Verified
                    </span>
                    <span className="font-mono text-[11px] text-[#616D66] tabular-nums">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#616D66] block">
                      Actor
                    </span>
                    <p className="font-medium text-[#242B27] mt-0.5">
                      {entry.actor_name} · <span className="text-[#616D66]">{entry.actor_role}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#616D66] block">
                      Previous Ledger Hash
                    </span>
                    <p className="font-mono text-[11px] text-[#616D66] mt-0.5 truncate">
                      {entry.previous_ledger_hash}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#616D66] block">
                      New SHA-256 Digest
                    </span>
                    <p className="font-mono text-[11px] font-semibold text-[#173F32] mt-0.5 truncate">
                      {entry.current_ledger_hash}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
