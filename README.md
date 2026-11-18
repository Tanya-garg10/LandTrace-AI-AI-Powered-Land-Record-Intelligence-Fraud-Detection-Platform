# LandTrace AI — AI-Powered Land Record Intelligence & Fraud Detection Platform

> **"Know Every Change. Verify Every Record. Protect Every Property."**

[![Node](https://img.shields.io/badge/node-%E2%89%A522.18-brightgreen.svg)](https://nodejs.org)
[![Bun](https://img.shields.io/badge/bun-1.x-f9f1e1.svg)](https://bun.sh)
[![Gemini](https://img.shields.io/badge/AI-Gemini%204%20Hydrogen-886fbf.svg)](https://ai.google.dev)

LandTrace AI is a full-stack enterprise GovTech platform for transparent property record traceability. It combines multimodal Gemini AI document verification, explainable deterministic risk scoring, GIS parcel visualization, mutation workflow governance, role-based access control, and SHA-256 tamper-evident audit logging into a single deployable application.

> **Important Scope Disclaimer:** All records seeded in this application are synthetic demo data. AI document analysis and risk scores serve strictly as advisory decision-support tools for human verification officers and do not constitute legal proof of ownership or direct access to official government databases.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Demo Accounts](#demo-accounts)
- [Flagship Demo Workflow](#flagship-demo-workflow-lt-par-1004)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment-render)
- [Known Limitations](#known-limitations)

---

## Features

### Core Modules

1. **Executive Overview Dashboard** — Live database KPIs, 4 Recharts visualizations (district verification, ownership transfer activity, risk distribution, mutation pipeline), high-risk alerts, recent verification reports, and audit activity.
2. **Land Intelligence GIS Map** — Interactive Leaflet + OpenStreetMap view rendering synthetic parcel boundaries, status-coded markers, parcel search, district/village/risk filters, and parcel inspection.
3. **Property Record Management** — Searchable, filterable, paginated registry table with Add/Edit modals and a multi-tab Property Detail Drawer.
4. **Gemini AI Document Intelligence Lab** — Drag-and-drop uploader (`PDF`, `JPG`, `JPEG`, `PNG`, `TXT`) with live preview, Gemini 4 Hydrogen structured JSON extraction (`@google/genai`), deterministic local parser fallback, side-by-side DB comparison, automatic mutation flagging, and report generation.
5. **AI Risk Intelligence Engine** — Reproducible 0–100 scoring across owner mismatches, duplicate survey numbers, area variance, missing supporting documents, conflicting mutations, and rapid ownership churn.
6. **Ownership History Timeline** — Append-only chronological transfer timeline that never overwrites historical ownership records.
7. **Mutation Management** — End-to-end transfer workflow (`Submitted` → `Under Review` → `Documents Required` → `Approved` / `Rejected` / `Flagged for Investigation`) with officer assignment, notes, and status history.
8. **Tamper-Evident Audit Ledger** — Application-level SHA-256 hash-chain linking every record modification to its predecessor, with a real-time integrity verification engine.
9. **Verification Reports** — Structured comparison dossiers with preview modal, PDF export (`jsPDF`), and CSV export.
10. **Administrative Control Center** — District analytics, officer activity tracking, pending investigations, and document verification queues with RBAC enforcement.

### Cross-Cutting Capabilities

- **4 Role-Based Workspaces** — Citizen/Landowner, Revenue Officer, Document Verification Officer, and System Administrator, each with a purpose-built dashboard.
- **JWT Authentication** — `bcryptjs` password hashing, 12-hour signed session tokens, role-scoped API authorization.
- **Zero-Config Demo** — SQLite database auto-seeds 25 synthetic properties, 16 ownership events, 10 documents/reports, and 4 user accounts on first run.
- **Graceful AI Degradation** — Works fully offline via the deterministic local parser; Gemini extraction activates automatically when `GEMINI_API_KEY` is set.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7 |
| Visualization | Leaflet + OpenStreetMap, Recharts, Motion |
| Backend | Node.js + Express 4, `tsx` dev runtime |
| Database | SQLite via `better-sqlite3` (file-based, auto-seeded) |
| AI | Google `@google/genai` SDK — `gemini-4-hydrogen` structured extraction |
| Security | JWT (`jsonwebtoken`), `bcryptjs`, RBAC middleware |
| Documents | `multer` uploads, `pdf-parse`, `jsPDF` + `jspdf-autotable` exports |
| Testing | Node.js built-in test runner via `tsx --test` |
| Deployment | Render (`render.yaml` blueprint) |

---

## Project Structure

```
landtrace/
├── server/                  # Express backend
│   ├── app.ts               # API routes, middleware wiring, Vite dev integration
│   ├── db.ts                # SQLite connection + schema
│   ├── seed.ts              # Synthetic demo data seeder (25 properties, 4 users)
│   ├── middleware/auth.ts   # JWT sign/verify + RBAC guards
│   └── services/
│       ├── aiDocumentService.ts  # Gemini extraction + deterministic fallback parser
│       ├── auditService.ts       # SHA-256 hash-chain ledger
│       └── riskService.ts        # Deterministic 0–100 risk scoring
├── src/                     # React SPA
│   ├── pages/               # Route pages (Dashboard, Map, Properties, Documents…)
│   ├── pages/dashboards/    # Per-role dashboards (Admin, Citizen, Revenue, Verification)
│   ├── components/          # AppShell, SlideDrawer, Toast, StatusText, BrandMark
│   ├── context/AuthContext.tsx
│   └── lib/                 # API client, PDF export helpers
├── tests/api.test.ts        # Backend & API test suite
├── sample_data/             # Demo deed documents for the AI Lab
├── docs/API.md              # REST API reference
├── server.ts                # Entry point (dev: tsx, prod: node ≥22.18)
├── render.yaml              # Render deployment blueprint
└── .env.example             # Environment variable template
```

---

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) (or Node.js ≥ 22.18) — npm also works.

```bash
# 1. Install dependencies
bun install          # or: npm install

# 2. Configure environment (optional — sensible dev defaults apply)
cp .env.example .env # Windows: copy .env.example .env

# 3. Start the full-stack dev server (Express API + Vite SPA on :3000)
bun run dev          # or: npm run dev
```

Open **http://localhost:3000** and sign in with one of the [demo accounts](#demo-accounts) below — every role has a 1-click card on the login screen.

### Other Commands

```bash
bun test             # Run backend & API test suite (tsx --test)
bun run lint         # TypeScript typecheck (tsc --noEmit)
bun run build        # Production Vite build → dist/
bun start            # Production server (node server.ts)
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for server-side `@google/genai` (`gemini-4-hydrogen`) extraction. Falls back cleanly to deterministic local parsing if unset or left as `MY_GEMINI_API_KEY`. | — |
| `JWT_SECRET` | Secret key used to sign JWT session tokens. | `landtrace-dev-secret-change-in-production` |
| `PORT` | HTTP port for the Express + Vite server. | `3000` |
| `DATABASE_PATH` | File path for the SQLite database. | `./landtrace.db` |
| `CORS_ORIGIN` | Allowed CORS origin in production. | `*` |
| `APP_URL` | Public URL where the applet is hosted. | `http://localhost:3000` |

---

## Demo Accounts

> Local evaluation only — these credentials are seeded demo accounts, never use them in production.

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Citizen / Landowner** | `citizen@landtrace.demo` | `Citizen@123` | View own linked parcels, ownership timeline, submit mutation requests |
| **Revenue Officer** | `revenue@landtrace.demo` | `Revenue@123` | Mutation circle oversight, assigned parcel review, status updates |
| **Document Verification Officer** | `officer@landtrace.demo` | `Officer@123` | Property edits, document AI analysis, mutation updates, ownership events |
| **System Administrator** | `admin@landtrace.demo` | `Admin@123` | Full governance, property CRUD, mutation approvals, risk scans, exports |

---

## Flagship Demo Workflow (`LT-PAR-1004`)

The seeded parcel `LT-PAR-1004` is a deliberately crafted fraud scenario — a sale deed whose claimant and area don't match the registry record.

1. Sign in as **Administrator** or **Document Verification Officer** (1-click cards on the Login screen).
2. Open **Document AI Lab** (`/documents`) from the sidebar.
3. Click **Run Demo Mismatch Workflow (LT-PAR-1004)** — or download `sample_data/demo_mismatch_deed_LT-PAR-1004.txt` and drag-and-drop it into the uploader.
4. Watch LandTrace AI extract the claimant name (`Rameshwar P. Deshpande`) and area (`2,950 sq.m`), detect the mismatch against registered owner `Rajeshwari Kulkarni` (`2,450 sq.m`), elevate the Risk Score, flag mutation `MUT-2026-401`, generate a Verification Report, and append a SHA-256 hash-chain block to the Audit Ledger.

A clean counterpart deed is available at `sample_data/clean_sale_deed_LT-PAR-1001.txt` for contrast.

---

## API Documentation

The backend exposes a REST API under `/api/*` — authentication, properties, documents, mutations, risk, reports, audit, and admin endpoints. See the full reference in **[docs/API.md](docs/API.md)**. A health check is available at `GET /api/health`.

---

## Testing

```bash
bun test    # tsx --test tests/api.test.ts
```

The suite boots the Express app against a seeded test database and covers auth flows (valid/invalid logins per role), property endpoints, and API authorization.

---

## Deployment (Render)

A Render blueprint is provided in [`render.yaml`](render.yaml):

| Setting | Value |
|---|---|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Plan | Free (web service) |

Set `GEMINI_API_KEY` and `JWT_SECRET` in the Render dashboard (**Environment** tab) — `JWT_SECRET` is auto-generated by the blueprint.

---

## Known Limitations

- **SQLite storage** — `better-sqlite3` seeded with 25 synthetic properties for frictionless zero-config evaluation. High-concurrency production use requires swapping the DB driver/connection layer for hosted PostgreSQL.
- **Ephemeral filesystem on Render free tier** — `landtrace.db` and `uploads/` reset on every redeploy/restart. Attach a persistent disk or migrate to a hosted database for durability. (`uploads/` is gitignored; only `sample_data/` demo documents are committed.)
- **Application-level audit chain** — The SHA-256 hash-chain detects application/payload modifications and broken links, but is not a public blockchain and cannot defend against privileged OS/database superuser manipulation.
- **Offline AI fallback** — Scanned-image OCR relies on Gemini multimodal vision when `GEMINI_API_KEY` is configured; without a key, the deterministic local parser handles text/PDF text layers only.

---

<p align="center">Built with React, Express, SQLite, Leaflet, Recharts & Gemini AI.</p>
