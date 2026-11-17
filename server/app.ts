import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import multer from 'multer';
import { requireAuth, requireRoles, signToken, type AuthenticatedRequest } from './middleware/auth.ts';
import { analyzeAndVerifyDocument, ensureSampleUploadsDir } from './services/aiDocumentService.ts';
import { appendAuditEntry, verifyAuditLedger } from './services/auditService.ts';
import { evaluatePropertyRisk } from './services/riskService.ts';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'text/plain',
]);

export function createApiApp(db: Database.Database): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
  });

  // ---------------------------------------------------------------------------
  // Health Check
  // ---------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    const propsCount = (db.prepare('SELECT COUNT(*) as cnt FROM properties').get() as { cnt: number }).cnt;
    const auditCount = (db.prepare('SELECT COUNT(*) as cnt FROM audit_logs').get() as { cnt: number }).cnt;
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    res.json({
      status: 'ok',
      service: 'LandTrace AI API',
      database: 'connected',
      properties_count: propsCount,
      audit_entries: auditCount,
      gemini_configured: geminiConfigured,
      timestamp: new Date().toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const user = db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND is_active = 1')
      .get(email.trim()) as
      | {
          id: number;
          name: string;
          email: string;
          password_hash: string;
          role: 'Citizen / Landowner' | 'Revenue Officer' | 'Document Verification Officer' | 'System Administrator';
          department: string;
          avatar_url: string;
        }
      | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials. Please check your email and password.' });
      return;
    }

    const authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatar_url: user.avatar_url,
    };
    const token = signToken(authUser);
    res.json({ token, user: authUser });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
    if (!name || !name.trim() || !email || !email.trim() || !password) {
      res.status(400).json({ error: 'Full name, email address, and password are required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email.trim());
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }

    // Security policy: self-registration ALWAYS provisions Citizen / Landowner only.
    const assignedRole = 'Citizen / Landowner' as const;
    const passwordHash = bcrypt.hashSync(password, 10);
    const avatarUrl = '/src/assets/images/avatar_citizen_landowner_1794898755585.jpg';

    const info = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, department, avatar_url)
         VALUES (?, ?, ?, ?, 'Registered Property Holder · Self-Service', ?)`
      )
      .run(name.trim(), email.trim().toLowerCase(), passwordHash, assignedRole, avatarUrl);

    const newUserId = Number(info.lastInsertRowid);
    const authUser = {
      id: newUserId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: assignedRole,
      department: 'Registered Property Holder · Self-Service',
      avatar_url: avatarUrl,
    };

    db.prepare(
      `INSERT INTO notifications (user_id, parcel_id, title, message, severity)
       VALUES (?, '', 'Welcome to LandTrace AI', 'Your Citizen / Landowner workspace is active. You can register parcel lookup requests, submit mutation applications, and download verification reports.', 'info')`
    ).run(newUserId);

    appendAuditEntry(db, {
      parcelId: 'SYSTEM',
      entityType: 'UserAccount',
      entityId: `USR-${newUserId}`,
      action: 'CITIZEN_ACCOUNT_REGISTERED',
      previousRecord: null,
      newRecord: { id: newUserId, email: authUser.email, role: assignedRole },
      actorId: newUserId,
      actorName: authUser.name,
      actorRole: assignedRole,
    });

    const token = signToken(authUser);
    res.status(201).json({ token, user: authUser });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Please enter a valid registered email address.' });
      return;
    }
    res.json({
      ok: true,
      message: `If ${email.trim()} is registered in this demo environment, password reset instructions have been queued. For controlled role testing, use the listed demo credentials.`,
    });
  });

  app.post('/api/auth/logout', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const freshUser = db
      .prepare('SELECT id, name, email, role, department, avatar_url FROM users WHERE id = ? AND is_active = 1')
      .get(req.user!.id);
    if (!freshUser) {
      res.status(401).json({ error: 'Account is inactive or no longer exists. Please sign in again.' });
      return;
    }
    res.json({ user: freshUser });
  });

  // ---------------------------------------------------------------------------
  // Sample Documents Download
  // ---------------------------------------------------------------------------
  app.get('/api/sample-documents/:slug', (req, res) => {
    const allowed: Record<string, string> = {
      'demo-mismatch-lt-par-1004': 'demo_mismatch_deed_LT-PAR-1004.txt',
      'clean-sale-lt-par-1001': 'clean_sale_deed_LT-PAR-1001.txt',
    };
    const filename = allowed[req.params.slug];
    if (!filename) {
      res.status(404).json({ error: 'Sample document not found.' });
      return;
    }
    const fullPath = path.resolve(process.cwd(), 'sample_data', filename);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Sample file missing on disk.' });
      return;
    }
    res.download(fullPath, filename);
  });

  // ---------------------------------------------------------------------------
  // Global Search
  // ---------------------------------------------------------------------------
  app.get('/api/search', requireAuth, (req: AuthenticatedRequest, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ properties: [], mutations: [], reports: [] });
      return;
    }
    const like = `%${q}%`;
    const isCitizen = req.user!.role === 'Citizen / Landowner';

    const properties = isCitizen
      ? db
          .prepare(
            `SELECT id, parcel_id, survey_number, current_owner, district_name, village, verification_status, risk_score, risk_category
             FROM properties
             WHERE (owner_user_id = ? OR lower(current_owner) = lower(?))
               AND (parcel_id LIKE ? OR survey_number LIKE ? OR current_owner LIKE ? OR village LIKE ? OR district_name LIKE ?)
             LIMIT 6`
          )
          .all(req.user!.id, req.user!.name, like, like, like, like, like)
      : db
          .prepare(
            `SELECT id, parcel_id, survey_number, current_owner, district_name, village, verification_status, risk_score, risk_category
             FROM properties
             WHERE parcel_id LIKE ? OR survey_number LIKE ? OR current_owner LIKE ? OR village LIKE ? OR district_name LIKE ?
             LIMIT 6`
          )
          .all(like, like, like, like, like);

    const mutations = isCitizen
      ? db
          .prepare(
            `SELECT m.id, m.mutation_ref, m.parcel_id, m.proposed_owner, m.status, m.change_type
             FROM mutation_requests m
             JOIN properties p ON p.id = m.property_id
             WHERE (p.owner_user_id = ? OR lower(m.applicant_name) = lower(?))
               AND (m.mutation_ref LIKE ? OR m.parcel_id LIKE ? OR m.proposed_owner LIKE ? OR m.applicant_name LIKE ?)
             LIMIT 5`
          )
          .all(req.user!.id, req.user!.name, like, like, like, like)
      : db
          .prepare(
            `SELECT id, mutation_ref, parcel_id, proposed_owner, status, change_type
             FROM mutation_requests
             WHERE mutation_ref LIKE ? OR parcel_id LIKE ? OR proposed_owner LIKE ? OR applicant_name LIKE ?
             LIMIT 5`
          )
          .all(like, like, like, like);

    const reports = isCitizen
      ? db
          .prepare(
            `SELECT r.id, r.report_ref, r.parcel_id, r.risk_score, r.risk_category, r.created_at
             FROM verification_reports r
             JOIN properties p ON p.id = r.property_id
             WHERE (p.owner_user_id = ? OR lower(p.current_owner) = lower(?))
               AND (r.report_ref LIKE ? OR r.parcel_id LIKE ?)
             LIMIT 5`
          )
          .all(req.user!.id, req.user!.name, like, like)
      : db
          .prepare(
            `SELECT id, report_ref, parcel_id, risk_score, risk_category, created_at
             FROM verification_reports
             WHERE report_ref LIKE ? OR parcel_id LIKE ?
             LIMIT 5`
          )
          .all(like, like);
    res.json({ properties, mutations, reports });
  });

  // ---------------------------------------------------------------------------
  // Dashboard Overview (Live DB Metrics)
  // ---------------------------------------------------------------------------
  app.get('/api/dashboard/overview', requireAuth, (req: AuthenticatedRequest, res) => {
    const role = req.user!.role;
    const userId = req.user!.id;
    const userName = req.user!.name;

    if (role === 'Citizen / Landowner') {
      const myProperties = db
        .prepare(
          `SELECT * FROM properties
           WHERE owner_user_id = ? OR lower(current_owner) = lower(?)
           ORDER BY id ASC`
        )
        .all(userId, userName) as Array<Record<string, unknown>>;

      const myMutations = db
        .prepare(
          `SELECT m.*, p.district_name, p.village, p.survey_number, p.risk_score, p.risk_category
           FROM mutation_requests m
           JOIN properties p ON p.id = m.property_id
           WHERE p.owner_user_id = ? OR lower(m.applicant_name) = lower(?)
           ORDER BY m.id DESC`
        )
        .all(userId, userName) as Array<Record<string, unknown>>;

      const myReports = db
        .prepare(
          `SELECT r.id, r.report_ref, r.parcel_id, r.risk_score, r.risk_category, r.ai_explanation, r.human_decision, r.created_at,
                  p.current_owner, p.district_name, p.survey_number
           FROM verification_reports r
           JOIN properties p ON p.id = r.property_id
           WHERE p.owner_user_id = ? OR lower(p.current_owner) = lower(?)
           ORDER BY r.id DESC`
        )
        .all(userId, userName);

      const myHistory = db
        .prepare(
          `SELECT o.*
           FROM ownership_history o
           JOIN properties p ON p.id = o.property_id
           WHERE p.owner_user_id = ? OR lower(p.current_owner) = lower(?)
           ORDER BY o.submitted_date DESC, o.id DESC
           LIMIT 8`
        )
        .all(userId, userName);

      const myNotifications = db
        .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 6`)
        .all(userId);

      const verifiedCount = myProperties.filter((p) => p.verification_status === 'Verified').length;
      const pendingApps = myMutations.filter((m) =>
        ['Submitted', 'Under Review', 'Documents Required', 'Flagged for Investigation'].includes(String(m.status))
      ).length;

      res.json({
        role,
        kpis: {
          my_properties: myProperties.length,
          verified_records: verifiedCount,
          pending_applications: pendingApps,
          recent_updates: myNotifications.length + myHistory.length,
          reports_count: myReports.length,
        },
        my_properties: myProperties,
        my_mutations: myMutations,
        my_reports: myReports,
        recent_ownership_updates: myHistory,
        recent_notifications: myNotifications,
      });
      return;
    }

    if (role === 'Revenue Officer') {
      const assignedProperties = db
        .prepare(
          `SELECT * FROM properties
           WHERE assigned_officer_id = ? OR verification_status IN ('Pending Review', 'Flagged', 'Under Investigation')
           ORDER BY risk_score DESC, id ASC
           LIMIT 10`
        )
        .all(userId) as Array<Record<string, unknown>>;

      const mutationQueue = db
        .prepare(
          `SELECT m.*, p.district_name, p.village, p.survey_number, p.risk_score, p.risk_category, p.current_owner
           FROM mutation_requests m
           JOIN properties p ON p.id = m.property_id
           WHERE m.status IN ('Submitted', 'Under Review', 'Documents Required', 'Flagged for Investigation')
           ORDER BY CASE WHEN m.assigned_officer_id = ? THEN 0 ELSE 1 END, m.is_suspicious DESC, m.id DESC
           LIMIT 10`
        )
        .all(userId);

      const recentOwnershipChanges = db
        .prepare(
          `SELECT o.*, p.district_name, p.village
           FROM ownership_history o
           JOIN properties p ON p.id = o.property_id
           ORDER BY o.submitted_date DESC, o.id DESC
           LIMIT 8`
        )
        .all();

      const mutationBreakdown = db
        .prepare('SELECT status as name, COUNT(*) as count FROM mutation_requests GROUP BY status')
        .all();

      const verificationBreakdown = db
        .prepare('SELECT verification_status as name, COUNT(*) as count FROM properties GROUP BY verification_status')
        .all();

      const assignedCount = (
        db.prepare('SELECT COUNT(*) as cnt FROM properties WHERE assigned_officer_id = ?').get(userId) as { cnt: number }
      ).cnt;
      const pendingMutations = (
        db
          .prepare("SELECT COUNT(*) as cnt FROM mutation_requests WHERE status IN ('Submitted', 'Under Review', 'Documents Required')")
          .get() as { cnt: number }
      ).cnt;
      const requiringReview = (
        db
          .prepare("SELECT COUNT(*) as cnt FROM properties WHERE verification_status IN ('Pending Review', 'Flagged', 'Under Investigation')")
          .get() as { cnt: number }
      ).cnt;
      const ownershipChangesCount = (db.prepare('SELECT COUNT(*) as cnt FROM ownership_history').get() as { cnt: number }).cnt;

      res.json({
        role,
        kpis: {
          assigned_properties: assignedCount,
          pending_mutations: pendingMutations,
          records_requiring_review: requiringReview,
          recent_ownership_changes: ownershipChangesCount,
        },
        charts: {
          mutation_breakdown: mutationBreakdown,
          verification_breakdown: verificationBreakdown,
        },
        assigned_properties: assignedProperties,
        assigned_mutations: mutationQueue,
        recent_ownership_changes: recentOwnershipChanges,
      });
      return;
    }

    if (role === 'Document Verification Officer') {
      const verificationQueue = db
        .prepare(
          `SELECT r.*, p.survey_number, p.district_name, p.village, p.tehsil, p.land_area_display, p.current_owner, p.previous_owner, p.registration_date, p.verification_status,
                  d.filename, d.doc_ref, d.ai_provider, d.ocr_method, d.extracted_text
           FROM verification_reports r
           JOIN properties p ON p.id = r.property_id
           LEFT JOIN documents d ON d.id = r.document_id
           ORDER BY CASE WHEN r.human_decision = 'Pending Review' THEN 0 ELSE 1 END, r.risk_score DESC, r.id DESC
           LIMIT 12`
        )
        .all();

      const documentsAnalyzed = (db.prepare('SELECT COUNT(*) as cnt FROM documents').get() as { cnt: number }).cnt;
      const pendingReviews = (
        db.prepare("SELECT COUNT(*) as cnt FROM verification_reports WHERE human_decision = 'Pending Review'").get() as { cnt: number }
      ).cnt;
      const mismatchAlerts = (
        db.prepare("SELECT COUNT(*) as cnt FROM verification_reports WHERE risk_score >= 45").get() as { cnt: number }
      ).cnt;
      const approvedReviews = (
        db.prepare("SELECT COUNT(*) as cnt FROM verification_reports WHERE human_decision = 'Approve Review'").get() as { cnt: number }
      ).cnt;

      const verificationBreakdown = db
        .prepare('SELECT verification_status as name, COUNT(*) as count FROM properties GROUP BY verification_status')
        .all();
      const riskDistribution = db
        .prepare('SELECT risk_category as name, COUNT(*) as count FROM properties GROUP BY risk_category')
        .all();

      res.json({
        role,
        kpis: {
          documents_analyzed: documentsAnalyzed,
          pending_human_reviews: pendingReviews,
          mismatch_alerts: mismatchAlerts,
          approved_reviews: approvedReviews,
        },
        charts: {
          verification_breakdown: verificationBreakdown,
          risk_distribution: riskDistribution,
        },
        verification_queue: verificationQueue,
      });
      return;
    }

    // System Administrator
    const totalProperties = (db.prepare('SELECT COUNT(*) as cnt FROM properties').get() as { cnt: number }).cnt;
    const verifiedRecords = (
      db.prepare("SELECT COUNT(*) as cnt FROM properties WHERE verification_status = 'Verified'").get() as { cnt: number }
    ).cnt;
    const pendingReviews = (
      db
        .prepare("SELECT COUNT(*) as cnt FROM mutation_requests WHERE status IN ('Submitted', 'Under Review', 'Documents Required')")
        .get() as { cnt: number }
    ).cnt;
    const flaggedRecords = (
      db
        .prepare("SELECT COUNT(*) as cnt FROM properties WHERE verification_status IN ('Flagged', 'Under Investigation') OR risk_category IN ('High', 'Critical')")
        .get() as { cnt: number }
    ).cnt;
    const documentsAnalyzed = (db.prepare('SELECT COUNT(*) as cnt FROM documents').get() as { cnt: number }).cnt;
    const reportsCount = (db.prepare('SELECT COUNT(*) as cnt FROM verification_reports').get() as { cnt: number }).cnt;
    const activeUsersCount = (db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1').get() as { cnt: number }).cnt;

    const verificationBreakdown = db
      .prepare('SELECT verification_status as name, COUNT(*) as count FROM properties GROUP BY verification_status')
      .all();
    const riskDistribution = db
      .prepare('SELECT risk_category as name, COUNT(*) as count FROM properties GROUP BY risk_category')
      .all();
    const mutationBreakdown = db
      .prepare('SELECT status as name, COUNT(*) as count FROM mutation_requests GROUP BY status')
      .all();
    const districtSummary = db
      .prepare(
        `SELECT district_name as district,
                COUNT(*) as total,
                SUM(CASE WHEN verification_status = 'Verified' THEN 1 ELSE 0 END) as verified,
                SUM(CASE WHEN risk_category IN ('High', 'Critical') THEN 1 ELSE 0 END) as high_risk
         FROM properties
         GROUP BY district_name`
      )
      .all();
    const ownershipActivity = db
      .prepare(
        `SELECT substr(submitted_date, 1, 4) as period,
                COUNT(*) as transfers,
                SUM(CASE WHEN approval_status = 'Approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN approval_status IN ('Disputed', 'Under Scrutiny') THEN 1 ELSE 0 END) as scrutinized
         FROM ownership_history
         GROUP BY substr(submitted_date, 1, 4)
         ORDER BY period ASC`
      )
      .all();
    const highRiskRecords = db
      .prepare(
        `SELECT parcel_id, survey_number, district_name, village, current_owner, verification_status, risk_score, risk_category
         FROM properties
         WHERE risk_score >= 60 OR verification_status IN ('Flagged', 'Under Investigation')
         ORDER BY risk_score DESC
         LIMIT 6`
      )
      .all();
    const recentReports = db
      .prepare(
        `SELECT r.id, r.report_ref, r.parcel_id, r.risk_score, r.risk_category, r.ai_explanation, r.human_decision, r.created_at,
                p.current_owner, p.district_name
         FROM verification_reports r
         JOIN properties p ON p.id = r.property_id
         ORDER BY r.id DESC
         LIMIT 5`
      )
      .all();
    const recentAudit = db
      .prepare(
        `SELECT event_id, parcel_id, action, actor_name, actor_role, current_ledger_hash, created_at
         FROM audit_logs
         ORDER BY id DESC
         LIMIT 8`
      )
      .all();
    const auditReport = verifyAuditLedger(db);

    res.json({
      role,
      kpis: {
        total_properties: totalProperties,
        verified_records: verifiedRecords,
        pending_mutations: pendingReviews,
        flagged_records: flaggedRecords,
        documents_analyzed: documentsAnalyzed,
        reports_count: reportsCount,
        system_activity: auditReport.total_entries,
        active_users: activeUsersCount,
      },
      charts: {
        verification_breakdown: verificationBreakdown,
        risk_distribution: riskDistribution,
        mutation_breakdown: mutationBreakdown,
        district_summary: districtSummary,
        ownership_activity: ownershipActivity,
      },
      high_risk_records: highRiskRecords,
      recent_reports: recentReports,
      recent_activity: recentAudit,
      audit_integrity: {
        status: auditReport.status,
        total_entries: auditReport.total_entries,
        verified_entries: auditReport.verified_entries,
        broken_links: auditReport.broken_links,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Districts
  // ---------------------------------------------------------------------------
  app.get('/api/districts', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT * FROM districts ORDER BY name ASC').all();
    res.json({ districts: rows });
  });

  // ---------------------------------------------------------------------------
  // Properties CRUD & Details
  // ---------------------------------------------------------------------------
  app.get('/api/properties', requireAuth, (req: AuthenticatedRequest, res) => {
    const search = String(req.query.search || '').trim();
    const district = String(req.query.district || '').trim();
    const village = String(req.query.village || '').trim();
    const status = String(req.query.status || '').trim();
    const risk = String(req.query.risk || '').trim();
    const scope = String(req.query.scope || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 12)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];

    if (scope === 'mine') {
      where.push('(owner_user_id = ? OR lower(current_owner) = lower(?))');
      params.push(req.user!.id, req.user!.name);
    } else if (scope === 'assigned') {
      where.push('(assigned_officer_id = ? OR verification_status IN ("Pending Review", "Flagged", "Under Investigation"))');
      params.push(req.user!.id);
    }

    if (search) {
      where.push('(parcel_id LIKE ? OR survey_number LIKE ? OR current_owner LIKE ? OR village LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (district && district !== 'All') {
      where.push('district_name = ?');
      params.push(district);
    }
    if (village && village !== 'All') {
      where.push('village = ?');
      params.push(village);
    }
    if (status && status !== 'All') {
      where.push('verification_status = ?');
      params.push(status);
    }
    if (risk && risk !== 'All') {
      where.push('risk_category = ?');
      params.push(risk);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM properties ${whereClause}`).get(...params) as { cnt: number }).cnt;
    const rows = db
      .prepare(`SELECT * FROM properties ${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);

    res.json({
      properties: rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  });

  app.get('/api/properties/:id', requireAuth, (req, res) => {
    const key = req.params.id;
    const property = db
      .prepare('SELECT * FROM properties WHERE parcel_id = ? OR id = ?')
      .get(key, Number(key) || -1) as { id: number; parcel_id: string } | undefined;

    if (!property) {
      res.status(404).json({ error: 'Property record not found.' });
      return;
    }

    const ownershipHistory = db
      .prepare('SELECT * FROM ownership_history WHERE property_id = ? ORDER BY submitted_date ASC, id ASC')
      .all(property.id);
    const documents = db
      .prepare('SELECT * FROM documents WHERE property_id = ? ORDER BY id DESC')
      .all(property.id);
    const mutations = db
      .prepare('SELECT * FROM mutation_requests WHERE property_id = ? ORDER BY id DESC')
      .all(property.id);
    const riskAssessments = db
      .prepare('SELECT * FROM risk_assessments WHERE property_id = ? ORDER BY id DESC')
      .all(property.id);
    const reports = db
      .prepare('SELECT * FROM verification_reports WHERE property_id = ? ORDER BY id DESC')
      .all(property.id);
    const auditLogs = db
      .prepare('SELECT * FROM audit_logs WHERE parcel_id = ? ORDER BY id DESC')
      .all(property.parcel_id);

    res.json({
      property,
      ownership_history: ownershipHistory,
      documents,
      mutations,
      risk_assessments: riskAssessments,
      reports,
      audit_logs: auditLogs,
    });
  });

  app.post('/api/properties', requireAuth, requireRoles('System Administrator', 'Revenue Officer'), (req: AuthenticatedRequest, res) => {
    const body = req.body as {
      parcel_id?: string;
      survey_number?: string;
      district_name?: string;
      village?: string;
      tehsil?: string;
      land_area_sq_m?: number;
      land_type?: string;
      current_owner?: string;
      previous_owner?: string;
      registration_date?: string;
      verification_status?: string;
    };

    if (!body.parcel_id || !body.survey_number || !body.district_name || !body.village || !body.current_owner) {
      res.status(400).json({ error: 'Parcel ID, Survey Number, District, Village, and Current Owner are required.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM properties WHERE parcel_id = ?').get(body.parcel_id.trim());
    if (existing) {
      res.status(409).json({ error: `Parcel ID ${body.parcel_id} already exists.` });
      return;
    }

    const district = db.prepare('SELECT * FROM districts WHERE name = ?').get(body.district_name) as
      | { id: number; name: string; center_lat: number; center_lng: number }
      | undefined;

    if (!district) {
      res.status(400).json({ error: `District "${body.district_name}" not found.` });
      return;
    }

    const sqM = Number(body.land_area_sq_m || 2000);
    const areaDisplay = `${sqM.toLocaleString('en-US')} sq.m`;
    const offsetLat = (Math.random() - 0.5) * 0.03;
    const offsetLng = (Math.random() - 0.5) * 0.03;
    const lat = Number((district.center_lat + offsetLat).toFixed(5));
    const lng = Number((district.center_lng + offsetLng).toFixed(5));
    const size = 0.002;
    const geoJson = JSON.stringify({
      type: 'Polygon',
      coordinates: [[[lng - size, lat - size], [lng + size, lat - size], [lng + size, lat + size], [lng - size, lat + size], [lng - size, lat - size]]],
    });
    const status = body.verification_status || 'Pending Review';

    const info = db
      .prepare(
        `INSERT INTO properties (
          parcel_id, survey_number, district_id, district_name, village, tehsil,
          land_area_sq_m, land_area_display, land_type, current_owner, previous_owner,
          registration_date, verification_status, risk_score, risk_category,
          latitude, longitude, boundary_geojson, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, 'Low', ?, ?, ?, 1)`
      )
      .run(
        body.parcel_id.trim().toUpperCase(),
        body.survey_number.trim(),
        district.id,
        district.name,
        body.village.trim(),
        (body.tehsil || 'Central Tehsil').trim(),
        sqM,
        areaDisplay,
        body.land_type || 'Residential',
        body.current_owner.trim(),
        (body.previous_owner || 'Prior Allotment').trim(),
        body.registration_date || new Date().toISOString().slice(0, 10),
        status,
        lat,
        lng,
        geoJson
      );

    const created = db.prepare('SELECT * FROM properties WHERE id = ?').get(info.lastInsertRowid) as {
      id: number;
      parcel_id: string;
      previous_owner: string;
      current_owner: string;
      registration_date: string;
    };

    // Initial append-only ownership event
    db.prepare(
      `INSERT INTO ownership_history (
        property_id, parcel_id, previous_owner, new_owner, change_type,
        mutation_reference, submitted_date, approval_status, supporting_document, verification_officer, notes, is_demo
      ) VALUES (?, ?, ?, ?, 'Initial Registry Entry', ?, ?, 'Approved', 'INITIAL-ENTRY', ?, 'Property created in registry.', 1)`
    ).run(
      created.id,
      created.parcel_id,
      created.previous_owner || 'Prior Allotment',
      created.current_owner,
      `INIT-${created.parcel_id}`,
      created.registration_date,
      req.user!.name
    );

    const risk = evaluatePropertyRisk(db, created.parcel_id, undefined, req.user!.name);
    appendAuditEntry(db, {
      parcelId: created.parcel_id,
      entityType: 'Property',
      entityId: created.parcel_id,
      action: 'PROPERTY_CREATED',
      previousRecord: null,
      newRecord: created,
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
    });

    const refreshed = db.prepare('SELECT * FROM properties WHERE id = ?').get(created.id);
    res.status(201).json({ property: refreshed, risk });
  });

  app.put('/api/properties/:id', requireAuth, requireRoles('System Administrator', 'Revenue Officer'), (req: AuthenticatedRequest, res) => {
    const key = req.params.id;
    const prev = db
      .prepare('SELECT * FROM properties WHERE parcel_id = ? OR id = ?')
      .get(key, Number(key) || -1) as Record<string, unknown> | undefined;

    if (!prev) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }

    const body = req.body as Partial<{
      survey_number: string;
      village: string;
      tehsil: string;
      land_area_sq_m: number;
      land_type: string;
      current_owner: string;
      previous_owner: string;
      registration_date: string;
      verification_status: string;
    }>;

    const sqM = body.land_area_sq_m !== undefined ? Number(body.land_area_sq_m) : Number(prev.land_area_sq_m);
    const areaDisplay = `${sqM.toLocaleString('en-US')} sq.m`;

    db.prepare(
      `UPDATE properties SET
        survey_number = ?,
        village = ?,
        tehsil = ?,
        land_area_sq_m = ?,
        land_area_display = ?,
        land_type = ?,
        current_owner = ?,
        previous_owner = ?,
        registration_date = ?,
        verification_status = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      body.survey_number ?? prev.survey_number,
      body.village ?? prev.village,
      body.tehsil ?? prev.tehsil,
      sqM,
      areaDisplay,
      body.land_type ?? prev.land_type,
      body.current_owner ?? prev.current_owner,
      body.previous_owner ?? prev.previous_owner,
      body.registration_date ?? prev.registration_date,
      body.verification_status ?? prev.verification_status,
      prev.id
    );

    const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(prev.id) as Record<string, unknown>;
    evaluatePropertyRisk(db, String(prev.parcel_id), undefined, req.user!.name);
    appendAuditEntry(db, {
      parcelId: String(prev.parcel_id),
      entityType: 'Property',
      entityId: String(prev.parcel_id),
      action: 'PROPERTY_UPDATED',
      previousRecord: prev,
      newRecord: updated,
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
    });

    const refreshed = db.prepare('SELECT * FROM properties WHERE id = ?').get(prev.id);
    res.json({ property: refreshed });
  });

  // ---------------------------------------------------------------------------
  // Ownership History Timeline (Append-Only)
  // ---------------------------------------------------------------------------
  app.get('/api/properties/:id/timeline', requireAuth, (req, res) => {
    const key = req.params.id;
    const property = db
      .prepare('SELECT * FROM properties WHERE parcel_id = ? OR id = ?')
      .get(key, Number(key) || -1) as { id: number; parcel_id: string } | undefined;
    if (!property) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }
    const events = db
      .prepare('SELECT * FROM ownership_history WHERE property_id = ? ORDER BY submitted_date ASC, id ASC')
      .all(property.id);
    res.json({ property, events });
  });

  app.post('/api/properties/:id/ownership', requireAuth, requireRoles('System Administrator', 'Revenue Officer'), (req: AuthenticatedRequest, res) => {
    const key = req.params.id;
    const property = db
      .prepare('SELECT * FROM properties WHERE parcel_id = ? OR id = ?')
      .get(key, Number(key) || -1) as { id: number; parcel_id: string; current_owner: string } | undefined;
    if (!property) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }

    const body = req.body as {
      previous_owner?: string;
      new_owner?: string;
      change_type?: string;
      mutation_reference?: string;
      submitted_date?: string;
      approval_status?: string;
      supporting_document?: string;
      notes?: string;
    };

    if (!body.new_owner || !body.change_type) {
      res.status(400).json({ error: 'New Owner and Change Type are required.' });
      return;
    }

    const mutRef = body.mutation_reference || `MUT-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const prevOwner = body.previous_owner || property.current_owner;
    const subDate = body.submitted_date || new Date().toISOString().slice(0, 10);
    const approvalStatus = body.approval_status || 'Approved';

    const info = db
      .prepare(
        `INSERT INTO ownership_history (
          property_id, parcel_id, previous_owner, new_owner, change_type,
          mutation_reference, submitted_date, approval_status, supporting_document, verification_officer, notes, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        property.id,
        property.parcel_id,
        prevOwner,
        body.new_owner.trim(),
        body.change_type,
        mutRef,
        subDate,
        approvalStatus,
        body.supporting_document || 'OFFICER-RECORDED',
        req.user!.name,
        body.notes || ''
      );

    // If approved, update current_owner & previous_owner on property without erasing prior history!
    if (approvalStatus === 'Approved') {
      db.prepare(`UPDATE properties SET previous_owner = ?, current_owner = ?, updated_at = datetime('now') WHERE id = ?`).run(
        prevOwner,
        body.new_owner.trim(),
        property.id
      );
    }

    const event = db.prepare('SELECT * FROM ownership_history WHERE id = ?').get(info.lastInsertRowid);
    evaluatePropertyRisk(db, property.parcel_id, undefined, req.user!.name);
    appendAuditEntry(db, {
      parcelId: property.parcel_id,
      entityType: 'OwnershipHistory',
      entityId: mutRef,
      action: `OWNERSHIP_EVENT_APPENDED (${body.change_type})`,
      previousRecord: { current_owner: property.current_owner },
      newRecord: event,
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
    });

    res.status(201).json({ event });
  });

  // ---------------------------------------------------------------------------
  // Mutation Requests Workflow
  // ---------------------------------------------------------------------------
  app.get('/api/mutations', requireAuth, (req: AuthenticatedRequest, res) => {
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();
    const where: string[] = [];
    const params: unknown[] = [];

    if (req.user!.role === 'Citizen / Landowner') {
      where.push('(p.owner_user_id = ? OR lower(m.applicant_name) = lower(?))');
      params.push(req.user!.id, req.user!.name);
    }

    if (status && status !== 'All') {
      where.push('m.status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(m.mutation_ref LIKE ? OR m.parcel_id LIKE ? OR m.proposed_owner LIKE ? OR m.applicant_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT m.*, p.district_name, p.village, p.survey_number, p.risk_score, p.risk_category
         FROM mutation_requests m
         JOIN properties p ON p.id = m.property_id
         ${whereClause}
         ORDER BY m.id DESC`
      )
      .all(...params);

    const officers = db
      .prepare(
        "SELECT id, name, role, avatar_url FROM users WHERE role IN ('System Administrator', 'Revenue Officer', 'Document Verification Officer') AND is_active = 1"
      )
      .all();

    res.json({ mutations: rows, officers });
  });

  app.post('/api/mutations', requireAuth, requireRoles('System Administrator', 'Revenue Officer', 'Citizen / Landowner'), (req: AuthenticatedRequest, res) => {
    const body = req.body as {
      parcel_id?: string;
      applicant_name?: string;
      proposed_owner?: string;
      change_type?: string;
      supporting_doc_ref?: string;
      admin_notes?: string;
    };

    if (!body.parcel_id || !body.proposed_owner || !body.change_type) {
      res.status(400).json({ error: 'Parcel ID, Proposed Owner, and Change Type are required.' });
      return;
    }

    const property = db.prepare('SELECT * FROM properties WHERE parcel_id = ?').get(body.parcel_id) as
      | { id: number; parcel_id: string; current_owner: string; owner_user_id: number | null; assigned_officer_id: number | null }
      | undefined;
    if (!property) {
      res.status(404).json({ error: `Parcel ${body.parcel_id} not found.` });
      return;
    }

    if (req.user!.role === 'Citizen / Landowner') {
      const ownsParcel =
        property.owner_user_id === req.user!.id || property.current_owner.toLowerCase() === req.user!.name.toLowerCase();
      if (!ownsParcel) {
        res.status(403).json({ error: 'Citizens can only submit mutation requests for properties registered in their workspace.' });
        return;
      }
    }

    let assignedOfficerId = req.user!.id;
    let assignedOfficerName = req.user!.name;
    if (req.user!.role === 'Citizen / Landowner') {
      const revOfficer = db
        .prepare("SELECT id, name FROM users WHERE role = 'Revenue Officer' AND is_active = 1 ORDER BY id ASC LIMIT 1")
        .get() as { id: number; name: string } | undefined;
      assignedOfficerId = property.assigned_officer_id || revOfficer?.id || req.user!.id;
      assignedOfficerName = revOfficer?.name || 'Rajeshwar Verma';
    }

    const mutRef = `MUT-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const history = [
      {
        status: 'Submitted',
        changed_by: req.user!.name,
        note: body.admin_notes || 'Mutation request submitted.',
        timestamp: new Date().toISOString(),
      },
    ];

    const info = db
      .prepare(
        `INSERT INTO mutation_requests (
          mutation_ref, property_id, parcel_id, applicant_name, proposed_owner, current_owner_snapshot,
          change_type, status, assigned_officer_id, assigned_officer_name, supporting_doc_ref,
          admin_notes, status_history_json, is_suspicious, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?, ?, 0, 1)`
      )
      .run(
        mutRef,
        property.id,
        property.parcel_id,
        req.user!.role === 'Citizen / Landowner' ? req.user!.name : (body.applicant_name || body.proposed_owner).trim(),
        body.proposed_owner.trim(),
        property.current_owner,
        body.change_type,
        assignedOfficerId,
        assignedOfficerName,
        body.supporting_doc_ref || '',
        body.admin_notes || '',
        JSON.stringify(history)
      );

    if (req.user!.role === 'Citizen / Landowner' && assignedOfficerId !== req.user!.id) {
      db.prepare(
        `INSERT INTO notifications (user_id, parcel_id, title, message, severity)
         VALUES (?, ?, ?, ?, 'info')`
      ).run(
        assignedOfficerId,
        property.parcel_id,
        `New Citizen Mutation: ${mutRef}`,
        `${req.user!.name} submitted a ${body.change_type} mutation request on ${property.parcel_id}.`
      );
    }

    const created = db.prepare('SELECT * FROM mutation_requests WHERE id = ?').get(info.lastInsertRowid);
    appendAuditEntry(db, {
      parcelId: property.parcel_id,
      entityType: 'MutationRequest',
      entityId: mutRef,
      action: 'MUTATION_CREATED',
      previousRecord: null,
      newRecord: created,
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
    });

    res.status(201).json({ mutation: created });
  });

  app.patch('/api/mutations/:id', requireAuth, requireRoles('System Administrator', 'Revenue Officer', 'Document Verification Officer'), (req: AuthenticatedRequest, res) => {
    const key = req.params.id;
    const prev = db
      .prepare('SELECT * FROM mutation_requests WHERE mutation_ref = ? OR id = ?')
      .get(key, Number(key) || -1) as
      | {
          id: number;
          mutation_ref: string;
          property_id: number;
          parcel_id: string;
          proposed_owner: string;
          current_owner_snapshot: string;
          change_type: string;
          status: string;
          assigned_officer_id: number | null;
          assigned_officer_name: string;
          supporting_doc_ref: string;
          admin_notes: string;
          status_history_json: string;
          is_suspicious: number;
        }
      | undefined;

    if (!prev) {
      res.status(404).json({ error: 'Mutation request not found.' });
      return;
    }

    const body = req.body as Partial<{
      status: string;
      assigned_officer_id: number;
      admin_notes: string;
      is_suspicious: boolean;
    }>;

    let officerName = prev.assigned_officer_name;
    let officerId = prev.assigned_officer_id;
    if (body.assigned_officer_id) {
      const officer = db.prepare('SELECT id, name FROM users WHERE id = ?').get(body.assigned_officer_id) as
        | { id: number; name: string }
        | undefined;
      if (officer) {
        officerId = officer.id;
        officerName = officer.name;
      }
    }

    const nextStatus = body.status || prev.status;
    const nextSuspicious =
      body.is_suspicious !== undefined
        ? body.is_suspicious
          ? 1
          : 0
        : nextStatus === 'Flagged for Investigation'
        ? 1
        : prev.is_suspicious;

    const history = JSON.parse(prev.status_history_json || '[]') as Array<Record<string, unknown>>;
    if (body.status || body.admin_notes || body.is_suspicious !== undefined) {
      history.push({
        status: nextStatus,
        changed_by: req.user!.name,
        note: body.admin_notes || `Updated status to ${nextStatus}`,
        timestamp: new Date().toISOString(),
      });
    }

    db.prepare(
      `UPDATE mutation_requests SET
        status = ?,
        assigned_officer_id = ?,
        assigned_officer_name = ?,
        admin_notes = ?,
        status_history_json = ?,
        is_suspicious = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nextStatus,
      officerId,
      officerName,
      body.admin_notes ?? prev.admin_notes,
      JSON.stringify(history),
      nextSuspicious,
      prev.id
    );

    // If Approved, append to ownership history (never overwrite!) and update property owner
    if (nextStatus === 'Approved' && prev.status !== 'Approved') {
      db.prepare(
        `INSERT INTO ownership_history (
          property_id, parcel_id, previous_owner, new_owner, change_type,
          mutation_reference, submitted_date, approval_status, supporting_document, verification_officer, notes, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved', ?, ?, ?, 1)`
      ).run(
        prev.property_id,
        prev.parcel_id,
        prev.current_owner_snapshot,
        prev.proposed_owner,
        prev.change_type,
        prev.mutation_ref,
        new Date().toISOString().slice(0, 10),
        prev.supporting_doc_ref || 'MUTATION-APPROVAL',
        req.user!.name,
        body.admin_notes || 'Approved via Mutation Management workflow.'
      );
      db.prepare(
        `UPDATE properties SET previous_owner = ?, current_owner = ?, verification_status = 'Verified', updated_at = datetime('now') WHERE id = ?`
      ).run(prev.current_owner_snapshot, prev.proposed_owner, prev.property_id);
    } else if (nextStatus === 'Flagged for Investigation') {
      db.prepare(`UPDATE properties SET verification_status = 'Under Investigation', updated_at = datetime('now') WHERE id = ?`).run(
        prev.property_id
      );
    }

    const updated = db.prepare('SELECT * FROM mutation_requests WHERE id = ?').get(prev.id);
    evaluatePropertyRisk(db, prev.parcel_id, undefined, req.user!.name);
    appendAuditEntry(db, {
      parcelId: prev.parcel_id,
      entityType: 'MutationRequest',
      entityId: prev.mutation_ref,
      action: `MUTATION_UPDATED (${prev.status} -> ${nextStatus})`,
      previousRecord: prev,
      newRecord: updated,
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
    });

    if (nextStatus === 'Flagged for Investigation') {
      db.prepare(`INSERT INTO notifications (user_id, parcel_id, title, message, severity) VALUES (?, ?, ?, ?, 'critical')`).run(
        req.user!.id,
        prev.parcel_id,
        `Mutation Flagged: ${prev.mutation_ref}`,
        `${prev.mutation_ref} on ${prev.parcel_id} was flagged for investigation by ${req.user!.name}.`
      );
    }

    res.json({ mutation: updated });
  });

  // ---------------------------------------------------------------------------
  // Document Intelligence & Gemini AI Verification
  // ---------------------------------------------------------------------------
  app.get('/api/documents', requireAuth, (req: AuthenticatedRequest, res) => {
    const isCitizen = req.user!.role === 'Citizen / Landowner';
    const docs = isCitizen
      ? db
          .prepare(
            `SELECT d.*, p.current_owner, p.district_name, p.survey_number
             FROM documents d
             JOIN properties p ON p.id = d.property_id
             WHERE p.owner_user_id = ? OR d.uploaded_by = ?
             ORDER BY d.id DESC`
          )
          .all(req.user!.id, req.user!.id)
      : db
          .prepare(
            `SELECT d.*, p.current_owner, p.district_name, p.survey_number
             FROM documents d
             JOIN properties p ON p.id = d.property_id
             ORDER BY d.id DESC`
          )
          .all();
    res.json({ documents: docs });
  });

  app.get('/api/documents/:id/file', requireAuth, (req, res) => {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ? OR doc_ref = ?').get(Number(req.params.id) || -1, req.params.id) as
      | { filename: string; mime_type: string; storage_path: string; extracted_text: string }
      | undefined;

    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    if (doc.storage_path && fs.existsSync(doc.storage_path)) {
      res.setHeader('Content-Type', doc.mime_type);
      res.sendFile(doc.storage_path);
      return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(doc.extracted_text || `Synthetic Demo Document Preview: ${doc.filename}`);
  });

  app.post(
    '/api/documents/analyze',
    requireAuth,
    requireRoles('System Administrator', 'Document Verification Officer', 'Revenue Officer', 'Citizen / Landowner'),
    upload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const parcelId = String(req.body?.parcel_id || '').trim();
        const samplePreset = String(req.body?.sample_preset || '').trim();

        if (!parcelId) {
          res.status(400).json({ error: 'Target parcel_id is required.' });
          return;
        }

        if (req.user!.role === 'Citizen / Landowner') {
          const prop = db.prepare('SELECT owner_user_id, current_owner FROM properties WHERE parcel_id = ?').get(parcelId) as
            | { owner_user_id: number | null; current_owner: string }
            | undefined;
          if (!prop || (prop.owner_user_id !== req.user!.id && prop.current_owner.toLowerCase() !== req.user!.name.toLowerCase())) {
            res.status(403).json({ error: 'Citizens can only upload verification documents for parcels registered in their workspace.' });
            return;
          }
        }

        let filename = '';
        let mimeType = '';
        let buffer: Buffer;

        if (req.file) {
          if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
            res.status(400).json({ error: `Unsupported file type "${req.file.mimetype}". Upload PDF, JPG, JPEG, PNG, or TXT.` });
            return;
          }
          filename = req.file.originalname;
          mimeType = req.file.mimetype;
          buffer = req.file.buffer;
        } else if (samplePreset) {
          const sampleMap: Record<string, string> = {
            'demo-mismatch-lt-par-1004': 'demo_mismatch_deed_LT-PAR-1004.txt',
            'clean-sale-lt-par-1001': 'clean_sale_deed_LT-PAR-1001.txt',
          };
          const sampleFile = sampleMap[samplePreset];
          if (!sampleFile) {
            res.status(400).json({ error: 'Unknown sample preset.' });
            return;
          }
          const fullPath = path.resolve(process.cwd(), 'sample_data', sampleFile);
          filename = sampleFile;
          mimeType = 'text/plain';
          buffer = fs.readFileSync(fullPath);
        } else {
          res.status(400).json({ error: 'Please upload a document file (PDF, JPG, PNG) or load a sample document.' });
          return;
        }

        const uploadsDir = ensureSampleUploadsDir();
        const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storagePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(storagePath, buffer);

        const result = await analyzeAndVerifyDocument({
          db,
          parcelId,
          filename,
          mimeType,
          buffer,
          storagePath,
          actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
        });

        res.json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Document analysis failed.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.post(
    '/api/verification/decision',
    requireAuth,
    requireRoles('Document Verification Officer', 'System Administrator'),
    (req: AuthenticatedRequest, res) => {
      const body = req.body as {
        report_ref?: string;
        report_id?: number;
        decision?: 'Approve Review' | 'Request Clarification' | 'Flag for Investigation';
        notes?: string;
      };

      const allowedDecisions = new Set(['Approve Review', 'Request Clarification', 'Flag for Investigation']);
      if (!body.decision || !allowedDecisions.has(body.decision)) {
        res.status(400).json({ error: 'Decision must be Approve Review, Request Clarification, or Flag for Investigation.' });
        return;
      }

      const key = body.report_ref || String(body.report_id || '');
      const report = db
        .prepare('SELECT * FROM verification_reports WHERE report_ref = ? OR id = ?')
        .get(key, Number(body.report_id) || -1) as
        | { id: number; report_ref: string; property_id: number; parcel_id: string; human_decision: string }
        | undefined;

      if (!report) {
        res.status(404).json({ error: 'Verification report not found.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const notes = (body.notes || '').trim();
      db.prepare(
        `UPDATE verification_reports
         SET human_decision = ?, decision_notes = ?, decided_by = ?, decided_at = ?
         WHERE id = ?`
      ).run(body.decision, notes, req.user!.name, nowIso, report.id);

      const nextVerificationStatus =
        body.decision === 'Approve Review'
          ? 'Verified'
          : body.decision === 'Request Clarification'
          ? 'Pending Review'
          : 'Under Investigation';

      db.prepare(`UPDATE properties SET verification_status = ?, updated_at = datetime('now') WHERE id = ?`).run(
        nextVerificationStatus,
        report.property_id
      );

      // Update any open mutation request if clarification or investigation is required
      const openMut = db
        .prepare(
          `SELECT * FROM mutation_requests
           WHERE property_id = ? AND status NOT IN ('Approved', 'Rejected')
           ORDER BY id DESC LIMIT 1`
        )
        .get(report.property_id) as { id: number; mutation_ref: string; status_history_json: string } | undefined;

      if (openMut) {
        const nextMutStatus =
          body.decision === 'Approve Review'
            ? 'Under Review'
            : body.decision === 'Request Clarification'
            ? 'Documents Required'
            : 'Flagged for Investigation';
        const history = JSON.parse(openMut.status_history_json || '[]') as Array<Record<string, unknown>>;
        history.push({
          status: nextMutStatus,
          changed_by: req.user!.name,
          note: notes || `Verification Officer decision: ${body.decision}`,
          timestamp: nowIso,
        });
        db.prepare(
          `UPDATE mutation_requests
           SET status = ?, is_suspicious = CASE WHEN ? = 'Flagged for Investigation' THEN 1 ELSE is_suspicious END,
               admin_notes = ?, status_history_json = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).run(nextMutStatus, nextMutStatus, notes || `Officer Decision: ${body.decision}`, JSON.stringify(history), openMut.id);
      }

      evaluatePropertyRisk(db, report.parcel_id, undefined, req.user!.name);

      const audit = appendAuditEntry(db, {
        parcelId: report.parcel_id,
        entityType: 'VerificationReport',
        entityId: report.report_ref,
        action: `HUMAN_VERIFICATION_DECISION (${body.decision})`,
        previousRecord: { human_decision: report.human_decision },
        newRecord: { human_decision: body.decision, notes, verification_status: nextVerificationStatus },
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
      });

      const severity = body.decision === 'Flag for Investigation' ? 'critical' : body.decision === 'Request Clarification' ? 'warning' : 'info';
      db.prepare(`INSERT INTO notifications (user_id, parcel_id, title, message, severity) VALUES (?, ?, ?, ?, ?)`).run(
        req.user!.id,
        report.parcel_id,
        `Verification Decision: ${body.decision}`,
        `${report.report_ref} on ${report.parcel_id} marked as "${body.decision}" by ${req.user!.name}.`,
        severity
      );

      const updatedReport = db
        .prepare(
          `SELECT r.*, p.survey_number, p.district_name, p.village, p.tehsil, p.land_area_display, p.current_owner, p.verification_status,
                  d.filename, d.doc_ref, d.ai_provider, d.ocr_method
           FROM verification_reports r
           JOIN properties p ON p.id = r.property_id
           LEFT JOIN documents d ON d.id = r.document_id
           WHERE r.id = ?`
        )
        .get(report.id);

      res.json({
        report: updatedReport,
        verification_status: nextVerificationStatus,
        audit_event_id: audit.event_id,
      });
    }
  );

  // ---------------------------------------------------------------------------
  // Risk Intelligence Engine
  // ---------------------------------------------------------------------------
  app.get('/api/risk/assessments', requireAuth, (_req, res) => {
    const assessments = db
      .prepare(
        `SELECT r.*, p.current_owner, p.district_name, p.village, p.survey_number, p.verification_status
         FROM risk_assessments r
         JOIN properties p ON p.id = r.property_id
         WHERE r.id IN (SELECT MAX(id) FROM risk_assessments GROUP BY parcel_id)
         ORDER BY r.risk_score DESC`
      )
      .all();
    res.json({ assessments });
  });

  app.post('/api/risk/evaluate/:parcelId', requireAuth, requireRoles('System Administrator', 'Revenue Officer', 'Document Verification Officer'), (req: AuthenticatedRequest, res) => {
    try {
      const parcelId = req.params.parcelId;
      const result = evaluatePropertyRisk(db, parcelId, undefined, req.user!.name);
      appendAuditEntry(db, {
        parcelId,
        entityType: 'RiskAssessment',
        entityId: parcelId,
        action: `RISK_RESCAN_COMPLETED (${result.risk_score}/100 ${result.risk_category})`,
        previousRecord: null,
        newRecord: { risk_score: result.risk_score, risk_category: result.risk_category },
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
      });
      res.json({ assessment: result });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Evaluation failed.' });
    }
  });

  // ---------------------------------------------------------------------------
  // Verification Reports & CSV Export
  // ---------------------------------------------------------------------------
  app.get('/api/reports', requireAuth, (req: AuthenticatedRequest, res) => {
    const isCitizen = req.user!.role === 'Citizen / Landowner';
    const reports = isCitizen
      ? db
          .prepare(
            `SELECT r.*, p.survey_number, p.district_name, p.village, p.tehsil, p.land_area_display, p.current_owner, p.verification_status,
                    d.filename, d.doc_ref, d.ai_provider, d.ocr_method
             FROM verification_reports r
             JOIN properties p ON p.id = r.property_id
             LEFT JOIN documents d ON d.id = r.document_id
             WHERE p.owner_user_id = ? OR lower(p.current_owner) = lower(?)
             ORDER BY r.id DESC`
          )
          .all(req.user!.id, req.user!.name)
      : db
          .prepare(
            `SELECT r.*, p.survey_number, p.district_name, p.village, p.tehsil, p.land_area_display, p.current_owner, p.verification_status,
                    d.filename, d.doc_ref, d.ai_provider, d.ocr_method
             FROM verification_reports r
             JOIN properties p ON p.id = r.property_id
             LEFT JOIN documents d ON d.id = r.document_id
             ORDER BY r.id DESC`
          )
          .all();
    res.json({ reports });
  });

  app.get('/api/reports/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const key = req.params.id;
    const report = db
      .prepare(
        `SELECT r.*, p.owner_user_id, p.survey_number, p.district_name, p.village, p.tehsil, p.land_area_display, p.current_owner, p.previous_owner, p.registration_date, p.verification_status,
                d.filename, d.doc_ref, d.ai_provider, d.ocr_method
         FROM verification_reports r
         JOIN properties p ON p.id = r.property_id
         LEFT JOIN documents d ON d.id = r.document_id
         WHERE r.report_ref = ? OR r.id = ?`
      )
      .get(key, Number(key) || -1) as { owner_user_id?: number | null; current_owner?: string } | undefined;

    if (!report) {
      res.status(404).json({ error: 'Verification report not found.' });
      return;
    }
    if (
      req.user!.role === 'Citizen / Landowner' &&
      report.owner_user_id !== req.user!.id &&
      (report.current_owner || '').toLowerCase() !== req.user!.name.toLowerCase()
    ) {
      res.status(403).json({ error: 'Access denied for this verification report.' });
      return;
    }
    res.json({ report });
  });

  app.get('/api/reports/:id/csv', requireAuth, (req, res) => {
    const key = req.params.id;
    const report = db
      .prepare(
        `SELECT r.*, p.survey_number, p.district_name, p.village, p.current_owner, p.land_area_display, d.filename, d.doc_ref
         FROM verification_reports r
         JOIN properties p ON p.id = r.property_id
         LEFT JOIN documents d ON d.id = r.document_id
         WHERE r.report_ref = ? OR r.id = ?`
      )
      .get(key, Number(key) || -1) as Record<string, unknown> | undefined;

    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const comparisons = JSON.parse(String(report.comparison_json || '[]')) as Array<{
      label: string;
      database_value: string;
      extracted_value: string;
      status: string;
      note: string;
    }>;

    const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [
      ['Report Reference', 'Parcel ID', 'Survey Number', 'District', 'Current Owner', 'Risk Score', 'Risk Category', 'Audit Entry', 'Generated At'].map(escapeCsv).join(','),
      [
        report.report_ref,
        report.parcel_id,
        report.survey_number,
        report.district_name,
        report.current_owner,
        report.risk_score,
        report.risk_category,
        report.audit_entry_id,
        report.created_at,
      ]
        .map(escapeCsv)
        .join(','),
      '',
      ['Field', 'Database Record', 'Document Extracted', 'Match Status', 'Observation'].map(escapeCsv).join(','),
      ...comparisons.map((c) => [c.label, c.database_value, c.extracted_value, c.status, c.note].map(escapeCsv).join(',')),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${report.report_ref}.csv"`);
    res.send(lines.join('\n'));
  });

  // ---------------------------------------------------------------------------
  // Tamper-Evident Audit Ledger
  // ---------------------------------------------------------------------------
  app.get('/api/audit/ledger', requireAuth, requireRoles('System Administrator'), (req, res) => {
    const parcel = String(req.query.parcel_id || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 60)));
    const rows = parcel
      ? db.prepare('SELECT * FROM audit_logs WHERE parcel_id LIKE ? ORDER BY id DESC LIMIT ?').all(`%${parcel}%`, limit)
      : db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
    res.json({ entries: rows });
  });

  app.get('/api/audit/verify', requireAuth, requireRoles('System Administrator'), (_req, res) => {
    const report = verifyAuditLedger(db);
    res.json(report);
  });

  // ---------------------------------------------------------------------------
  // Admin Control Center Analytics & User Management
  // ---------------------------------------------------------------------------
  app.get('/api/admin/analytics', requireAuth, requireRoles('System Administrator'), (_req, res) => {
    const districtStats = db
      .prepare(
        `SELECT d.name as district, d.code, d.state, d.total_villages,
                COUNT(p.id) as property_count,
                ROUND(AVG(p.risk_score), 1) as avg_risk_score,
                SUM(CASE WHEN p.verification_status = 'Verified' THEN 1 ELSE 0 END) as verified_count,
                SUM(CASE WHEN p.risk_category IN ('High', 'Critical') THEN 1 ELSE 0 END) as flagged_count
         FROM districts d
         LEFT JOIN properties p ON p.district_id = d.id
         GROUP BY d.id
         ORDER BY property_count DESC`
      )
      .all();

    const officerActivity = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.department, u.avatar_url, u.is_active, u.created_at,
                (SELECT COUNT(*) FROM mutation_requests m WHERE m.assigned_officer_name = u.name) as assigned_mutations,
                (SELECT COUNT(*) FROM audit_logs a WHERE a.actor_id = u.id) as audit_actions
         FROM users u
         ORDER BY u.id ASC`
      )
      .all();

    const pendingInvestigations = db
      .prepare(
        `SELECT m.*, p.district_name, p.survey_number, p.risk_score, p.risk_category
         FROM mutation_requests m
         JOIN properties p ON p.id = m.property_id
         WHERE m.status IN ('Flagged for Investigation', 'Under Review', 'Documents Required')
         ORDER BY p.risk_score DESC, m.id DESC`
      )
      .all();

    const documentQueue = db
      .prepare(
        `SELECT d.id, d.doc_ref, d.parcel_id, d.filename, d.ai_provider, d.ocr_method, d.created_at,
                p.current_owner, p.risk_score, p.risk_category
         FROM documents d
         JOIN properties p ON p.id = d.property_id
         ORDER BY d.id DESC
         LIMIT 8`
      )
      .all();

    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    const systemConfig = {
      environment: 'Synthetic Demo Sandbox',
      database_engine: 'SQLite WAL (PostgreSQL-compatible schema)',
      ai_pipeline: geminiConfigured ? 'Gemini 4 Hydrogen (Live Key Active)' : 'Gemini Structured Extractor + Deterministic Fallback',
      hash_algorithm: 'SHA-256 Append-Only Chain',
      self_registration_role: 'Citizen / Landowner (Strict)',
      legal_disclaimer: 'Preliminary verification intelligence only. No official government database connectivity.',
    };

    res.json({
      district_stats: districtStats,
      officer_activity: officerActivity,
      pending_investigations: pendingInvestigations,
      document_queue: documentQueue,
      system_config: systemConfig,
    });
  });

  app.get('/api/admin/users', requireAuth, requireRoles('System Administrator'), (_req, res) => {
    const users = db
      .prepare(
        `SELECT id, name, email, role, department, avatar_url, is_active, created_at,
                (SELECT COUNT(*) FROM audit_logs a WHERE a.actor_id = users.id) as audit_actions
         FROM users ORDER BY id ASC`
      )
      .all();
    res.json({ users });
  });

  app.patch('/api/admin/users/:id/status', requireAuth, requireRoles('System Administrator'), (req: AuthenticatedRequest, res) => {
    const targetId = Number(req.params.id);
    const { is_active } = req.body as { is_active?: boolean };
    if (!Number.isFinite(targetId) || typeof is_active !== 'boolean') {
      res.status(400).json({ error: 'Valid user ID and boolean is_active flag are required.' });
      return;
    }
    if (targetId === req.user!.id && !is_active) {
      res.status(400).json({ error: 'Cannot deactivate your own active administrator session.' });
      return;
    }
    const target = db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(targetId) as
      | { id: number; name: string; email: string; role: string; is_active: number }
      | undefined;
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    db.prepare(`UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(is_active ? 1 : 0, targetId);
    appendAuditEntry(db, {
      parcelId: 'SYSTEM',
      entityType: 'UserAccount',
      entityId: `USR-${targetId}`,
      action: is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      previousRecord: { is_active: Boolean(target.is_active) },
      newRecord: { is_active },
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
    });

    const updated = db
      .prepare('SELECT id, name, email, role, department, avatar_url, is_active, created_at FROM users WHERE id = ?')
      .get(targetId);
    res.json({ user: updated });
  });

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const isAdmin = req.user!.role === 'System Administrator';
    const rows = isAdmin
      ? db.prepare('SELECT * FROM notifications ORDER BY is_read ASC, id DESC LIMIT 20').all()
      : db
          .prepare('SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY is_read ASC, id DESC LIMIT 20')
          .all(req.user!.id);
    const unreadCount = isAdmin
      ? (db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0').get() as { cnt: number }).cnt
      : (
          db
            .prepare('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0 AND (user_id = ? OR user_id IS NULL)')
            .get(req.user!.id) as { cnt: number }
        ).cnt;
    res.json({ notifications: rows, unread_count: unreadCount });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.patch('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.user!.role === 'System Administrator') {
      db.prepare('UPDATE notifications SET is_read = 1').run();
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL').run(req.user!.id);
    }
    res.json({ ok: true });
  });

  return app;
}
