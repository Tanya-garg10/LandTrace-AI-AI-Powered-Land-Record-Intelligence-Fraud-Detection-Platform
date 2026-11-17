import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApiApp } from '../server/app.ts';
import { createDatabase } from '../server/db.ts';
import { seedDatabase } from '../server/seed.ts';
import { verifyAuditLedger } from '../server/services/auditService.ts';

describe('LandTrace AI Full-Stack 4-Role API & Core Services', () => {
  const db = createDatabase(':memory:');
  seedDatabase(db);
  const app = createApiApp(db);

  let server: http.Server;
  let baseUrl = '';
  let citizenToken = '';
  let revenueToken = '';
  let officerToken = '';
  let adminToken = '';

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });

  async function api(route: string, init: RequestInit = {}, token?: string) {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!(init.body instanceof FormData) && init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`${baseUrl}${route}`, { ...init, headers });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, data: json, headers: res.headers };
  }

  it('returns healthy status from /api/health', async () => {
    const res = await api('/api/health');
    assert.equal(res.status, 200);
    const body = res.data as { status: string; properties_count: number };
    assert.equal(body.status, 'ok');
    assert.equal(body.properties_count, 25);
  });

  it('authenticates all four RBAC roles and rejects invalid credentials', async () => {
    const bad = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@landtrace.demo', password: 'WrongPassword' }),
    });
    assert.equal(bad.status, 401);

    const citizenLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'citizen@landtrace.demo', password: 'Citizen@123' }),
    });
    assert.equal(citizenLogin.status, 200);
    assert.equal((citizenLogin.data as { user: { role: string } }).user.role, 'Citizen / Landowner');
    citizenToken = (citizenLogin.data as { token: string }).token;

    const revenueLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'revenue@landtrace.demo', password: 'Revenue@123' }),
    });
    assert.equal(revenueLogin.status, 200);
    assert.equal((revenueLogin.data as { user: { role: string } }).user.role, 'Revenue Officer');
    revenueToken = (revenueLogin.data as { token: string }).token;

    const officerLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'officer@landtrace.demo', password: 'Officer@123' }),
    });
    assert.equal(officerLogin.status, 200);
    assert.equal((officerLogin.data as { user: { role: string } }).user.role, 'Document Verification Officer');
    officerToken = (officerLogin.data as { token: string }).token;

    const adminLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@landtrace.demo', password: 'Admin@123' }),
    });
    assert.equal(adminLogin.status, 200);
    assert.equal((adminLogin.data as { user: { role: string } }).user.role, 'System Administrator');
    adminToken = (adminLogin.data as { token: string }).token;
  });

  it('restricts self-registration strictly to Citizen / Landowner regardless of requested role', async () => {
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Vikram Kulkarni',
        email: 'vikram.new@example.com',
        password: 'Password123',
        role: 'System Administrator',
      }),
    });
    assert.equal(reg.status, 201);
    const body = reg.data as { user: { role: string; email: string } };
    assert.equal(body.user.role, 'Citizen / Landowner');
    assert.equal(body.user.email, 'vikram.new@example.com');
  });

  it('enforces RBAC: Citizens & Verification Officers cannot create properties while Revenue Officer & Admin can', async () => {
    const citizenForbidden = await api(
      '/api/properties',
      {
        method: 'POST',
        body: JSON.stringify({
          parcel_id: 'LT-PAR-9998',
          survey_number: 'SY-998',
          district_name: 'Sahyadri Valley',
          village: 'Paudwadi',
          current_owner: 'Blocked Citizen Write',
        }),
      },
      citizenToken
    );
    assert.equal(citizenForbidden.status, 403);

    const officerForbidden = await api(
      '/api/properties',
      {
        method: 'POST',
        body: JSON.stringify({
          parcel_id: 'LT-PAR-9999',
          survey_number: 'SY-999',
          district_name: 'Sahyadri Valley',
          village: 'Paudwadi',
          current_owner: 'Blocked Officer Write',
        }),
      },
      officerToken
    );
    assert.equal(officerForbidden.status, 403);

    const created = await api(
      '/api/properties',
      {
        method: 'POST',
        body: JSON.stringify({
          parcel_id: 'LT-PAR-1099',
          survey_number: 'SY-990/Z',
          district_name: 'Sahyadri Valley',
          village: 'Paudwadi',
          tehsil: 'Mulshi',
          land_area_sq_m: 1800,
          current_owner: 'Siddharth Deshpande',
          previous_owner: 'Prior Trust',
        }),
      },
      revenueToken
    );
    assert.equal(created.status, 201);

    const updated = await api(
      '/api/properties/LT-PAR-1099',
      {
        method: 'PUT',
        body: JSON.stringify({ village: 'Paudwadi North', verification_status: 'Verified' }),
      },
      adminToken
    );
    assert.equal(updated.status, 200);
    assert.equal((updated.data as { property: { village: string } }).property.village, 'Paudwadi North');
  });

  it('scopes citizen mutations and allows citizens to submit mutations only for owned parcels', async () => {
    const blocked = await api(
      '/api/mutations',
      {
        method: 'POST',
        body: JSON.stringify({
          parcel_id: 'LT-PAR-1005',
          proposed_owner: 'Unauthorized Claimant',
          change_type: 'Sale Deed',
        }),
      },
      citizenToken
    );
    assert.equal(blocked.status, 403);

    const allowed = await api(
      '/api/mutations',
      {
        method: 'POST',
        body: JSON.stringify({
          parcel_id: 'LT-PAR-1001',
          proposed_owner: 'Meera Gokhale',
          change_type: 'Family Settlement',
          admin_notes: 'Citizen submitted family transfer request',
        }),
      },
      citizenToken
    );
    assert.equal(allowed.status, 201);
  });

  it('preserves prior records when appending ownership history events', async () => {
    const before = await api('/api/properties/LT-PAR-1004/timeline', {}, revenueToken);
    const beforeCount = (before.data as { events: unknown[] }).events.length;

    const appended = await api(
      '/api/properties/LT-PAR-1004/ownership',
      {
        method: 'POST',
        body: JSON.stringify({
          previous_owner: 'Rajeshwari Kulkarni',
          new_owner: 'Aarti Kulkarni',
          change_type: 'Family Settlement',
          approval_status: 'Under Scrutiny',
          notes: 'Test append-only historical preservation',
        }),
      },
      revenueToken
    );
    assert.equal(appended.status, 201);

    const after = await api('/api/properties/LT-PAR-1004/timeline', {}, adminToken);
    const afterCount = (after.data as { events: unknown[] }).events.length;
    assert.equal(afterCount, beforeCount + 1);
  });

  it('executes Document Intelligence mismatch analysis and Document Verification Officer human decision workflow', async () => {
    const samplePath = path.resolve(process.cwd(), 'sample_data', 'demo_mismatch_deed_LT-PAR-1004.txt');
    const fileBytes = fs.readFileSync(samplePath);

    const form = new FormData();
    form.append('parcel_id', 'LT-PAR-1004');
    form.append('file', new Blob([fileBytes], { type: 'text/plain' }), 'demo_mismatch_deed_LT-PAR-1004.txt');

    const res = await api('/api/documents/analyze', { method: 'POST', body: form }, officerToken);
    assert.equal(res.status, 200);

    const body = res.data as {
      report_ref: string;
      mismatched_fields: Array<{ field: string }>;
      risk_assessment: { risk_score: number; risk_category: string };
      flagged_mutation_ref: string | null;
      audit_event_id: string;
    };

    assert.ok(body.mismatched_fields.some((m) => m.field === 'owner_name'));
    assert.ok(body.risk_assessment.risk_score >= 60);
    assert.ok(body.flagged_mutation_ref);
    assert.ok(body.audit_event_id.startsWith('EVT-'));

    // Human review decision by Document Verification Officer
    const decisionRes = await api(
      '/api/verification/decision',
      {
        method: 'POST',
        body: JSON.stringify({
          report_ref: body.report_ref,
          decision: 'Flag for Investigation',
          notes: 'Owner mismatch confirmed by Verification Officer.',
        }),
      },
      officerToken
    );
    assert.equal(decisionRes.status, 200);
    assert.equal((decisionRes.data as { verification_status: string }).verification_status, 'Under Investigation');

    // Citizen cannot submit a verification decision
    const citizenDecision = await api(
      '/api/verification/decision',
      {
        method: 'POST',
        body: JSON.stringify({
          report_ref: body.report_ref,
          decision: 'Approve Review',
        }),
      },
      citizenToken
    );
    assert.equal(citizenDecision.status, 403);

    // Verify CSV export works for citizen owning LT-PAR-1004
    const csvRes = await api(`/api/reports/${body.report_ref}/csv`, {}, citizenToken);
    assert.equal(csvRes.status, 200);
    assert.ok(String(csvRes.data).includes(body.report_ref));
    assert.ok(String(csvRes.data).includes('LT-PAR-1004'));
  });

  it('evaluates deterministic risk for duplicate survey numbers', async () => {
    const res = await api('/api/risk/evaluate/LT-PAR-1005', { method: 'POST' }, adminToken);
    assert.equal(res.status, 200);
    const body = res.data as { assessment: { risk_score: number; indicators: Array<{ code: string }> } };
    assert.ok(body.assessment.indicators.some((i) => i.code === 'DUPLICATE_SURVEY_NUMBER'));
    assert.ok(body.assessment.risk_score >= 60);
  });

  it('returns distinct role-tailored dashboard payloads and enforces admin/audit RBAC', async () => {
    const citizenDash = await api('/api/dashboard/overview', {}, citizenToken);
    assert.equal(citizenDash.status, 200);
    const citizenBody = citizenDash.data as { role: string; my_properties: unknown[]; kpis: { my_properties: number } };
    assert.equal(citizenBody.role, 'Citizen / Landowner');
    assert.ok(citizenBody.my_properties.length >= 4);

    const revenueDash = await api('/api/dashboard/overview', {}, revenueToken);
    assert.equal(revenueDash.status, 200);
    const revenueBody = revenueDash.data as { role: string; assigned_properties: unknown[]; assigned_mutations: unknown[] };
    assert.equal(revenueBody.role, 'Revenue Officer');
    assert.ok(revenueBody.assigned_properties.length > 0);
    assert.ok(revenueBody.assigned_mutations.length > 0);

    const officerDash = await api('/api/dashboard/overview', {}, officerToken);
    assert.equal(officerDash.status, 200);
    const officerBody = officerDash.data as { role: string; verification_queue: unknown[] };
    assert.equal(officerBody.role, 'Document Verification Officer');
    assert.ok(officerBody.verification_queue.length > 0);

    const adminDash = await api('/api/dashboard/overview', {}, adminToken);
    assert.equal(adminDash.status, 200);
    const adminBody = adminDash.data as {
      role: string;
      charts: { district_summary: unknown[] };
      recent_activity: unknown[];
      audit_integrity: { status: string };
    };
    assert.equal(adminBody.role, 'System Administrator');
    assert.ok(adminBody.charts.district_summary.length > 0);
    assert.ok(adminBody.recent_activity.length > 0);
    assert.equal(adminBody.audit_integrity.status, 'VERIFIED');

    assert.equal((await api('/api/admin/analytics', {}, officerToken)).status, 403);
    assert.equal((await api('/api/admin/analytics', {}, revenueToken)).status, 403);
    assert.equal((await api('/api/admin/analytics', {}, citizenToken)).status, 403);
    assert.equal((await api('/api/admin/analytics', {}, adminToken)).status, 200);
    assert.equal((await api('/api/admin/users', {}, adminToken)).status, 200);
    assert.equal((await api('/api/audit/ledger', {}, officerToken)).status, 403);
  });

  it('verifies SHA-256 hash-chain integrity and detects simulated database tampering', async () => {
    const clean = await api('/api/audit/verify', {}, adminToken);
    assert.equal(clean.status, 200);
    assert.equal((clean.data as { status: string }).status, 'VERIFIED');

    db.prepare(`UPDATE audit_logs SET action = 'TAMPERED_ACTION' WHERE id = 2`).run();
    const tampered = verifyAuditLedger(db);
    assert.equal(tampered.status, 'TAMPER_DETECTED');
    assert.ok(tampered.broken_links >= 1);
  });
});
