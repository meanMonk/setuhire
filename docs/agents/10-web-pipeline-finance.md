# 10 — WEB-PIPELINE-FINANCE (Wave 2, parallel)

Fill in stub pages + API helper. Touch ONLY:
- `src/pages/Interviews/ListPage.tsx`
- `src/pages/Contracts/ListPage.tsx`
- `src/pages/Finance/ListPage.tsx`
- `src/api/pipeline.ts`

Use `api/client.ts` and `components/ui.tsx`. No new deps.

## Interviews (PRD §3.11)
- GET `/api/v1/interviews` → toggle **List view / Calendar view** (calendar can be a simple month grid using native Date — no extra lib).
- Columns: Candidate, Job, Client, Round, Interviewer, Scheduled Date/Time, Status. Filter: status + date range.
- Click row → inline expand for feedback notes. "+ Schedule Interview" → small form (match_id, round, interviewer, scheduled_at) → POST `/api/v1/interviews`.

## Contracts (PRD §3.12)
- GET `/api/v1/contracts` → table: Candidate, Client, Vendor (if any), Contract Type, Rate, Start, End, Status. **Expiring within 30 days visually flagged** (use `GET /api/v1/contracts/expiring?days=30` to mark rows; red badge).
- Document upload/download: file input → uploads via MinIO (backend helper); set `document_url` on POST/PATCH `/api/v1/contracts`. If a dedicated upload endpoint exists, use it; else show "no document" and link the `document_url`.
- Click row → detail view with full terms (side panel is fine).

## Finance (PRD §3.13)
- GET `/api/v1/finance/summary` → top cards: Total Revenue (this month), Total Commission Earned, Pending Receivables, Pending Vendor Payouts.
- GET `/api/v1/finance/records` → table: Candidate, Client, Job, Employment Type, Client Billing (TSC), Vendor Payout, Commission, Billing Status, Period. Filters: client, vendor, month.
- **Export CSV** button → `GET /api/v1/finance/export?format=csv` → download (create a hidden `<a href>` with `credentials: include` or fetch → Blob download).

## Rules
- Loading/error states. INR formatting. Keep styling to existing classes.

## Verify
```bash
cd packages/web/setuhireweb && pnpm typecheck && pnpm dev
# Interviews → seeded rows (scheduled this week), toggle calendar
# Contracts → seeded contracts, expiring-30d flagged, detail panel
# Finance → summary cards (Aug 2026: revenue 160000, commission 20000), records table, CSV export downloads
```
Report: files changed + evidence.
