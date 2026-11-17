import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hashRecord(record: unknown): string {
  if (!record) return sha256('EMPTY_RECORD');
  const normalized = JSON.stringify(record, Object.keys(record as Record<string, unknown>).sort());
  return sha256(normalized);
}

export interface AuditEntryInput {
  parcelId: string;
  entityType: string;
  entityId: string;
  action: string;
  previousRecord: unknown;
  newRecord: unknown;
  actorId: number;
  actorName: string;
  actorRole: string;
  timestamp?: string;
}

export interface AuditLogRow {
  id: number;
  event_id: string;
  parcel_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  previous_record_hash: string;
  new_record_hash: string;
  previous_ledger_hash: string;
  current_ledger_hash: string;
  payload_snapshot_json: string;
  actor_id: number;
  actor_name: string;
  actor_role: string;
  created_at: string;
}

export function computeLedgerEntryHash(params: {
  event_id: string;
  parcel_id: string;
  action: string;
  previous_record_hash: string;
  new_record_hash: string;
  previous_ledger_hash: string;
  actor_id: number;
  created_at: string;
}): string {
  const canonical = [
    params.event_id,
    params.parcel_id,
    params.action,
    params.previous_record_hash,
    params.new_record_hash,
    params.previous_ledger_hash,
    String(params.actor_id),
    params.created_at,
  ].join('|');
  return sha256(canonical);
}

export function appendAuditEntry(db: Database.Database, input: AuditEntryInput): AuditLogRow {
  const latest = db
    .prepare('SELECT id, current_ledger_hash FROM audit_logs ORDER BY id DESC LIMIT 1')
    .get() as { id: number; current_ledger_hash: string } | undefined;

  const previousLedgerHash = latest ? latest.current_ledger_hash : GENESIS_HASH;
  const previousRecordHash = input.previousRecord ? hashRecord(input.previousRecord) : sha256('NONE');
  const newRecordHash = input.newRecord ? hashRecord(input.newRecord) : sha256('NONE');
  const timestamp = input.timestamp || new Date().toISOString();
  const seq = (latest?.id ?? 0) + 1;
  const eventId = `EVT-${String(seq).padStart(5, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const currentLedgerHash = computeLedgerEntryHash({
    event_id: eventId,
    parcel_id: input.parcelId,
    action: input.action,
    previous_record_hash: previousRecordHash,
    new_record_hash: newRecordHash,
    previous_ledger_hash: previousLedgerHash,
    actor_id: input.actorId,
    created_at: timestamp,
  });

  const snapshot = JSON.stringify({
    entity_type: input.entityType,
    entity_id: input.entityId,
    summary: input.action,
  });

  const info = db
    .prepare(
      `INSERT INTO audit_logs (
        event_id, parcel_id, entity_type, entity_id, action,
        previous_record_hash, new_record_hash, previous_ledger_hash, current_ledger_hash,
        payload_snapshot_json, actor_id, actor_name, actor_role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      eventId,
      input.parcelId,
      input.entityType,
      input.entityId,
      input.action,
      previousRecordHash,
      newRecordHash,
      previousLedgerHash,
      currentLedgerHash,
      snapshot,
      input.actorId,
      input.actorName,
      input.actorRole,
      timestamp
    );

  return db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(info.lastInsertRowid) as AuditLogRow;
}

export interface IntegrityIssue {
  entry_id: number;
  event_id: string;
  parcel_id: string;
  issue_type: 'HASH_MISMATCH' | 'BROKEN_PREVIOUS_LINK';
  expected_hash: string;
  actual_hash: string;
  message: string;
}

export interface LedgerVerificationReport {
  status: 'VERIFIED' | 'TAMPER_DETECTED';
  total_entries: number;
  verified_entries: number;
  broken_links: number;
  genesis_hash: string;
  latest_hash: string;
  checked_at: string;
  issues: IntegrityIssue[];
  disclaimer: string;
}

export function verifyAuditLedger(db: Database.Database): LedgerVerificationReport {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id ASC').all() as AuditLogRow[];
  const issues: IntegrityIssue[] = [];
  let verifiedCount = 0;
  let expectedPrevHash = GENESIS_HASH;

  for (const row of rows) {
    let rowValid = true;

    if (row.previous_ledger_hash !== expectedPrevHash) {
      rowValid = false;
      issues.push({
        entry_id: row.id,
        event_id: row.event_id,
        parcel_id: row.parcel_id,
        issue_type: 'BROKEN_PREVIOUS_LINK',
        expected_hash: expectedPrevHash,
        actual_hash: row.previous_ledger_hash,
        message: `Entry ${row.event_id} references previous hash ${row.previous_ledger_hash.slice(0, 12)}..., expected ${expectedPrevHash.slice(0, 12)}...`,
      });
    }

    const recomputed = computeLedgerEntryHash({
      event_id: row.event_id,
      parcel_id: row.parcel_id,
      action: row.action,
      previous_record_hash: row.previous_record_hash,
      new_record_hash: row.new_record_hash,
      previous_ledger_hash: row.previous_ledger_hash,
      actor_id: row.actor_id,
      created_at: row.created_at,
    });

    if (recomputed !== row.current_ledger_hash) {
      rowValid = false;
      issues.push({
        entry_id: row.id,
        event_id: row.event_id,
        parcel_id: row.parcel_id,
        issue_type: 'HASH_MISMATCH',
        expected_hash: recomputed,
        actual_hash: row.current_ledger_hash,
        message: `Recomputed SHA-256 digest for ${row.event_id} does not match stored ledger hash.`,
      });
    }

    if (rowValid) {
      verifiedCount += 1;
    }

    expectedPrevHash = row.current_ledger_hash;
  }

  return {
    status: issues.length === 0 ? 'VERIFIED' : 'TAMPER_DETECTED',
    total_entries: rows.length,
    verified_entries: verifiedCount,
    broken_links: issues.length,
    genesis_hash: GENESIS_HASH,
    latest_hash: rows.length > 0 ? rows[rows.length - 1].current_ledger_hash : GENESIS_HASH,
    checked_at: new Date().toISOString(),
    issues,
    disclaimer:
      'Application-level SHA-256 tamper-evident audit ledger. Detects application-layer payload tampering or broken link references; not a public blockchain and does not claim immunity against direct privileged database superuser manipulation.',
  };
}
