# 05 — BE-PIPELINE (Wave 1, parallel)

Implements stubs + owned service. Touch ONLY:
- `src/routes/interviews.ts`, `src/routes/contracts.ts`, `src/routes/finance.ts`, `src/routes/dashboard.ts`
- `src/services/pipeline.ts`

## Interviews (PRD §4)
```
GET    /api/v1/interviews    ?job_id=&candidate_id=&status=&from=&to=
POST   /api/v1/interviews     { match_id, round, interviewer, scheduled_at }
PATCH  /api/v1/interviews/:id { status, feedback, scheduled_at }
DELETE /api/v1/interviews/:id
```
- `from`/`to` filter on `scheduled_at` (ISO strings). List joins candidate + job + client names.
- `status`: `scheduled, cleared, rejected, no_show`.

## Contracts (PRD §4)
```
GET    /api/v1/contracts           ?client_id=&vendor_id=&status=
POST   /api/v1/contracts            { match_id, contract_type, rate, start_date, end_date, document_url }
GET    /api/v1/contracts/expiring   ?days=30   -> contracts with end_date within `days`
GET    /api/v1/contracts/:id
PATCH  /api/v1/contracts/:id
```
- **Contract document upload**: `document_url` is a MinIO object key set by the frontend (web agent uploads via a small `POST /api/v1/uploads`? **No** — keep simple: contracts accept `document_url` key directly; if you add an upload endpoint, mirror `04`'s MinIO pattern with `lib/minio.js`. Never disk.)
- `expiring`: end_date between now and now+`days`; flag `expiring_soon: true`. Use this same query for the detail/list flag.
- `contract_type`: `candidate_vendor, vendor_client, direct`. `status`: `active, expired, terminated`.

## Finance (PRD §4)
```
GET    /api/v1/finance/records    ?client_id=&vendor_id=&month=
POST   /api/v1/finance/records     { match_id, client_billing_amount, vendor_payout_amount, billing_status, period }
PATCH  /api/v1/finance/records/:id
GET    /api/v1/finance/summary     ?month=  -> { totalRevenue, totalCommission, pendingReceivables, pendingVendorPayouts }
GET    /api/v1/finance/export      ?format=csv   -> CSV download
```
- `commission` computed = `client_billing_amount - vendor_payout_amount` (set on insert/update if empty).
- `summary`: totals for the given month (or all months if omitted). `totalRevenue` = sum(billing for period), `pendingReceivables` = sum where status != 'payment_received', `pendingVendorPayouts` = sum(vendor_payout where status != 'payment_received').
- `export`: build CSV (header + rows), return with `Content-Type: text/csv` and `Content-Disposition: attachment`.

## Dashboard (PRD §4 + §3.2)
```
GET /api/v1/dashboard/summary       -> { activeClients, openJobs, candidatesAvailable, vendorsEngaged, interviewsThisWeek, pendingBillingAmount }
GET /api/v1/dashboard/attention-feed -> [{ type, message, link }]
GET /api/v1/dashboard/activity-log   ?limit=10 -> recent stage moves / notes
```
- `interviewsThisWeek`: interviews with scheduled_at in current week (Mon–Sun).
- `pendingBillingAmount`: sum of finance records not `payment_received`.
- `attention-feed` (rule-based, no LLM): matches with score>=90 and stage='applied' → "N candidates matched >90% for Job #X, not yet contacted"; vendors with no response (no interviews/notes) on an open job for >5 days; interviews scheduled within 24h → "Interview with Y is tomorrow". Each item `{ type: 'match'|'vendor'|'interview', message, link: '/jobs/j1' }`.
- `activity-log`: latest `job_candidate_matches` stage changes (createdAt desc, limit param) → `{ actor?, candidate, job, from, to, at }`.

## Rules
- `requireAuth` on all. `json`/`error` helpers. 404s. `numeric` → number on output.
- Always wrap stage/payload validation — 400 on invalid enums.

## Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck && pnpm dev
# login, then:
curl -b c.txt 'localhost:3400/api/v1/interviews?from=2026-08-16&to=2026-08-20'
curl -b c.txt localhost:3400/api/v1/contracts/expiring?days=45
curl -b c.txt localhost:3400/api/v1/finance/summary?month=2026-08
curl -b c.txt localhost:3400/api/v1/dashboard/summary
curl -b c.txt localhost:3400/api/v1/dashboard/attention-feed
curl -b c.txt 'localhost:3400/api/v1/finance/export?format=csv' -o /tmp/fin.csv && head /tmp/fin.csv
```
Report: endpoints + curl evidence.
