# LandTrace AI — AI-Powered Land Record Intelligence & Fraud Detection Platform

> **"Know Every Change. Verify Every Record. Protect Every Property."**

LandTrace AI is a full-stack enterprise GovTech platform built for transparent property record traceability, multimodal Gemini AI document verification, explainable deterministic risk scoring, GIS parcel visualization, mutation workflow governance, and SHA-256 tamper-evident audit logging.

> **Important Scope Disclaimer:** All records seeded in this application are synthetic demo data. AI document analysis and risk scores serve strictly as advisory decision-support tools for human verification officers and do not constitute legal proof of ownership or direct access to official government databases.

---

## Core Modules

1. **Executive Overview Dashboard** — Live database KPIs, 4 Recharts visualizations (district verification, ownership transfer activity, risk distribution, mutation pipeline), high-risk alerts, recent verification reports, and audit activity.
2. **Land Intelligence GIS Map** — Interactive Leaflet + OpenStreetMap view rendering synthetic parcel boundaries, status-coded markers, parcel search, district/village/risk filters, and parcel inspection.
3. **Property Record Management** — Searchable, filterable, paginated registry table with Add/Edit modals and a multi-tab Property Detail Drawer.
4. **Gemini AI Document Intelligence Lab** — Drag-and-drop uploader (`PDF`, `JPG`, `JPEG`, `PNG`, `TXT`) with live preview, Gemini 4 Hydrogen structured JSON extraction (`@google/genai`), deterministic local parser fallback, side-by-side DB comparison, automatic mutation flagging, and report generation.
5. **AI Risk Intelligence Engine** — Reproducible 0–100 scoring across owner mismatches, duplicate survey numbers, area variance, missing supporting documents, conflicting mutations, and rapid ownership churn.
6. **Ownership History Timeline** — Append-only chronological transfer timeline that never overwrites historical ownership records.
7. **Mutation Management** — End-to-end transfer workflow (`Submitted`, `Under Review`, `Documents Required`, `Approved`, `Rejected`, `Flagged for Investigation`) with officer assignment, notes, and status history.
8. **Tamper-Evident Audit Ledger** — Application-level SHA-256 hash-chain linking every record modification to its predecessor, with a real-time integrity verification engine.
9. **Verification Reports** — Structured comparison dossiers with preview modal, PDF export (`jsPDF`), and CSV export.
10. **Administrative Control Center** — District analytics, officer activity tracking, pending investigations, and document verification queues with RBAC enforcement.

---

## Local Setup & Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (optional: copy .env.example to .env)
cp .env.example .env

# 3. Start full-stack dev server (Express API + Vite SPA on port 3000)
npm run dev

# 4. Run automated backend & API test suite
npm test

# 5. Typecheck & build for production
npm run lint
npm run build
npm start
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for server-side `@google/genai` (`gemini-4-hydrogen`) extraction. Falls back cleanly to deterministic local parsing if unset. | — |
| `JWT_SECRET` | Secret key used to sign JWT session tokens. | Dev fallback secret |
| `PORT` | HTTP port for Express + Vite server. | `3000` |
| `DATABASE_PATH` | File path for SQLite database. | `./landtrace.db` |
| `CORS_ORIGIN` | Allowed CORS origin in production. | `*` |

---

## Demo Login Credentials (Local Evaluation Only)

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Administrator** | `admin@landtrace.demo` | `Admin@123` | Full governance, property CRUD, mutation approvals, risk scans, exports |
| **Verification Officer** | `officer@landtrace.demo` | `Officer@123` | Property edits, document AI analysis, mutation updates, ownership events |
| **Auditor** | `auditor@landtrace.demo` | `Auditor@123` | Read-only inspection, SHA-256 hash-chain verification, PDF/CSV exports |

---

## Flagship Demo Workflow (`LT-PAR-1004`)

1. Sign in as **Administrator** or **Verification Officer** (1-click cards on Login screen).
2. Open **Document AI Lab** (`/documents`) from the sidebar.
3. Click **Run Demo Mismatch Workflow (LT-PAR-1004)** (or download `sample_data/demo_mismatch_deed_LT-PAR-1004.txt` and drag-and-drop it).
4. Observe LandTrace AI extract the claimant name (`Rameshwar P. Deshpande`) and area (`2,950 sq.m`), detect the mismatch against registered owner `Rajeshwari Kulkarni` (`2,450 sq.m`), elevate the Risk Score, flag mutation `MUT-2026-401`, generate a Verification Report, and append a SHA-256 hash-chain block to the Audit Ledger.

---

## Deployment (Render)

A Render blueprint is provided in `render.yaml`:
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Configure `GEMINI_API_KEY` and `JWT_SECRET` in Render Environment settings.

---

## Known Limitations

- Uses SQLite (`better-sqlite3`) seeded with 25 synthetic properties for frictionless zero-config local evaluation; switching to hosted PostgreSQL in high-concurrency production requires swapping the DB driver/connection layer.
- The SHA-256 Audit Ledger is an application-level tamper-evident chain; it detects application/payload modifications and broken links, but is not a public blockchain and cannot defend against privileged OS/database superuser manipulation.
- Document OCR for scanned images relies on Gemini multimodal vision when `GEMINI_API_KEY` is configured; when offline without an API key, the deterministic local parser handles text/PDF text layers.
