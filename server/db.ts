import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export type UserRole =
  | 'Citizen / Landowner'
  | 'Revenue Officer'
  | 'Document Verification Officer'
  | 'System Administrator';

export interface DbUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  department: string;
  avatar_url: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const defaultDbPath = path.resolve(process.cwd(), 'landtrace.db');

export function createDatabase(dbPath: string = process.env.DATABASE_PATH || defaultDbPath): Database.Database {
  const dir = path.dirname(dbPath);
  if (dbPath !== ':memory:' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function runMigrations(db: Database.Database): void {
  // Detect legacy 3-role schema on disk and cleanly upgrade to the 4-role schema
  const existingUsersTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get() as { sql: string } | undefined;

  if (existingUsersTable && !existingUsersTable.sql.includes('Citizen / Landowner')) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      DROP TABLE IF EXISTS notifications;
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS verification_reports;
      DROP TABLE IF EXISTS risk_assessments;
      DROP TABLE IF EXISTS mutation_requests;
      DROP TABLE IF EXISTS documents;
      DROP TABLE IF EXISTS ownership_history;
      DROP TABLE IF EXISTS properties;
      DROP TABLE IF EXISTS districts;
      DROP TABLE IF EXISTS users;
    `);
    db.pragma('foreign_keys = ON');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Citizen / Landowner', 'Revenue Officer', 'Document Verification Officer', 'System Administrator')),
      department TEXT NOT NULL DEFAULT 'Land Records Directorate',
      avatar_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      total_villages INTEGER NOT NULL DEFAULT 12,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parcel_id TEXT NOT NULL UNIQUE,
      survey_number TEXT NOT NULL,
      district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
      district_name TEXT NOT NULL,
      village TEXT NOT NULL,
      tehsil TEXT NOT NULL,
      land_area_sq_m REAL NOT NULL,
      land_area_display TEXT NOT NULL,
      land_type TEXT NOT NULL,
      current_owner TEXT NOT NULL,
      previous_owner TEXT NOT NULL DEFAULT '',
      registration_date TEXT NOT NULL,
      verification_status TEXT NOT NULL CHECK(verification_status IN ('Verified', 'Pending Review', 'Flagged', 'Under Investigation')),
      risk_score INTEGER NOT NULL DEFAULT 10,
      risk_category TEXT NOT NULL CHECK(risk_category IN ('Low', 'Medium', 'High', 'Critical')),
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      boundary_geojson TEXT NOT NULL,
      owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_officer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ownership_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      parcel_id TEXT NOT NULL,
      previous_owner TEXT NOT NULL,
      new_owner TEXT NOT NULL,
      change_type TEXT NOT NULL,
      mutation_reference TEXT NOT NULL,
      submitted_date TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      supporting_document TEXT NOT NULL DEFAULT '',
      verification_officer TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_ref TEXT NOT NULL UNIQUE,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      parcel_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL DEFAULT '',
      extracted_text TEXT NOT NULL DEFAULT '',
      ocr_method TEXT NOT NULL DEFAULT 'Gemini Multimodal OCR',
      ai_provider TEXT NOT NULL DEFAULT 'Gemini 4 Hydrogen',
      extracted_json TEXT NOT NULL DEFAULT '{}',
      analysis_status TEXT NOT NULL DEFAULT 'Completed',
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mutation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_ref TEXT NOT NULL UNIQUE,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      parcel_id TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      proposed_owner TEXT NOT NULL,
      current_owner_snapshot TEXT NOT NULL,
      change_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN (
        'Submitted',
        'Under Review',
        'Documents Required',
        'Approved',
        'Rejected',
        'Flagged for Investigation'
      )),
      assigned_officer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_officer_name TEXT NOT NULL DEFAULT 'Unassigned',
      supporting_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
      supporting_doc_ref TEXT NOT NULL DEFAULT '',
      admin_notes TEXT NOT NULL DEFAULT '',
      status_history_json TEXT NOT NULL DEFAULT '[]',
      is_suspicious INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS risk_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      parcel_id TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      risk_category TEXT NOT NULL CHECK(risk_category IN ('Low', 'Medium', 'High', 'Critical')),
      indicators_json TEXT NOT NULL DEFAULT '[]',
      evidence_json TEXT NOT NULL DEFAULT '[]',
      recommended_action TEXT NOT NULL,
      ai_summary TEXT NOT NULL DEFAULT '',
      evaluated_by TEXT NOT NULL DEFAULT 'Risk Intelligence Engine',
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS verification_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_ref TEXT NOT NULL UNIQUE,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      parcel_id TEXT NOT NULL,
      document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
      risk_assessment_id INTEGER REFERENCES risk_assessments(id) ON DELETE SET NULL,
      extracted_fields_json TEXT NOT NULL DEFAULT '{}',
      comparison_json TEXT NOT NULL DEFAULT '[]',
      missing_fields_json TEXT NOT NULL DEFAULT '[]',
      inconsistencies_json TEXT NOT NULL DEFAULT '[]',
      risk_score INTEGER NOT NULL DEFAULT 0,
      risk_category TEXT NOT NULL DEFAULT 'Low',
      ai_explanation TEXT NOT NULL DEFAULT '',
      recommended_steps_json TEXT NOT NULL DEFAULT '[]',
      audit_entry_id TEXT NOT NULL DEFAULT '',
      generated_by TEXT NOT NULL DEFAULT 'System',
      human_decision TEXT NOT NULL DEFAULT 'Pending Review',
      decision_notes TEXT NOT NULL DEFAULT '',
      decided_by TEXT NOT NULL DEFAULT '',
      decided_at TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      parcel_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_record_hash TEXT NOT NULL,
      new_record_hash TEXT NOT NULL,
      previous_ledger_hash TEXT NOT NULL,
      current_ledger_hash TEXT NOT NULL,
      payload_snapshot_json TEXT NOT NULL DEFAULT '{}',
      actor_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      parcel_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_properties_parcel_id ON properties(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_properties_survey ON properties(survey_number);
    CREATE INDEX IF NOT EXISTS idx_properties_district ON properties(district_name);
    CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(verification_status);
    CREATE INDEX IF NOT EXISTS idx_properties_risk ON properties(risk_category);
    CREATE INDEX IF NOT EXISTS idx_properties_owner_user ON properties(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_properties_assigned_officer ON properties(assigned_officer_id);
    CREATE INDEX IF NOT EXISTS idx_ownership_parcel ON ownership_history(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_mutations_parcel ON mutation_requests(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_mutations_status ON mutation_requests(status);
    CREATE INDEX IF NOT EXISTS idx_documents_parcel ON documents(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_reports_parcel ON verification_reports(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_risk_parcel ON risk_assessments(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_audit_parcel ON audit_logs(parcel_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
  `);
}

let sharedDb: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!sharedDb) {
    sharedDb = createDatabase();
  }
  return sharedDb;
}
