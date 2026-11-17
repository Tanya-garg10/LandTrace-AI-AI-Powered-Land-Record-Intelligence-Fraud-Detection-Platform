# LandTrace AI — REST API Reference

All protected routes require `Authorization: Bearer <jwt_token>`.

## Health & Authentication
- `GET /api/health` — Service health, DB connectivity, Gemini key configuration status.
- `POST /api/auth/login` — Body: `{ email, password }`. Returns `{ token, user }`.
- `POST /api/auth/logout` — Terminates active session token client-side.
- `GET /api/auth/me` — Returns authenticated user profile & role.

## Dashboard & Global Search
- `GET /api/dashboard/overview` — Computes live KPIs, district/risk/mutation charts, high-risk list, and recent audit activity.
- `GET /api/search?q=<query>` — Searches across parcels, mutations, and verification reports.
- `GET /api/districts` — Lists seeded districts and coordinates.

## Property Record Management
- `GET /api/properties?search=&district=&village=&status=&risk=&page=1&limit=10`
- `GET /api/properties/:id` — Returns full property dossier (documents, ownership history, mutations, risk assessments, reports, audit logs).
- `POST /api/properties` — *(Admin / Officer)* Creates property + initial ownership entry + audit log.
- `PUT /api/properties/:id` — *(Admin / Officer)* Updates property + re-evaluates risk + writes chained audit entry.

## Ownership History Timeline (Append-Only)
- `GET /api/properties/:id/timeline` — Chronological transfer history.
- `POST /api/properties/:id/ownership` — *(Admin / Officer)* Appends new ownership event without overwriting history.

## Gemini AI Document Intelligence
- `GET /api/documents` — Lists analyzed documents.
- `POST /api/documents/analyze` — *(Admin / Officer)* Multipart upload (`file`, `parcel_id`) or `sample_preset`. Extracts text/OCR, invokes Gemini 4 Hydrogen structured JSON (with deterministic fallback), compares against DB, computes risk, flags suspicious mutations, generates Verification Report, and writes SHA-256 audit entry.
- `GET /api/documents/:id/file` — Streams uploaded document or extracted text preview.

## Risk Intelligence Engine
- `GET /api/risk/assessments` — Latest risk evaluation per parcel.
- `POST /api/risk/evaluate/:parcelId` — *(Admin / Officer)* Re-runs deterministic risk rules and persists assessment.

## Mutation Management
- `GET /api/mutations?status=&search=` — Lists mutation requests and assigned officers.
- `POST /api/mutations` — *(Admin / Officer)* Submits new mutation request.
- `PATCH /api/mutations/:id` — *(Admin / Officer)* Updates status, assigns officer, adds notes, flags suspicious transfers.

## Tamper-Evident Audit Ledger
- `GET /api/audit/ledger?parcel_id=` — Lists SHA-256 chained audit blocks.
- `GET /api/audit/verify` — Recomputes every entry hash and validates `previous_ledger_hash` chain continuity.

## Verification Reports & Admin Analytics
- `GET /api/reports` — Lists generated verification reports.
- `GET /api/reports/:id` — Retrieves single report detail.
- `GET /api/reports/:id/csv` — Downloads CSV comparison report.
- `GET /api/admin/analytics` — District metrics, officer activity, pending investigations, document queue.
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`
