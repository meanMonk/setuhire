# 08 — WEB-CLIENTS-VENDORS (Wave 2, parallel)

Fill in stub pages + API helpers (created by agent 07). Touch ONLY:
- `src/pages/Clients/ListPage.tsx`, `src/pages/Clients/DetailPage.tsx`
- `src/pages/Vendors/ListPage.tsx`, `src/pages/Vendors/DetailPage.tsx`
- `src/api/clients.ts`, `src/api/vendors.ts`

Use `api/client.ts` (`get/post/patch/del`) and `components/ui.tsx`.

## Clients list (PRD §3.3)
- GET `/api/v1/clients` → table: Name, Industry, Active Jobs count, Status, Last Engagement Date.
- Expandable row → inline open jobs (title, status, TSC, candidates in pipeline) via GET `/api/v1/clients/:id/jobs` (lazy on expand).
- Filters: status dropdown, industry text. "+ Add Client" → simple inline form (POST).
- Click name → `/clients/:id`.

## Client detail (PRD §3.4)
- GET `/api/v1/clients/:id` → header (name, industry, status, contact); jobs table (linked to `/jobs/:id`); **Pricing per job** (TSC vs Sourcing Cost vs Margin); resources hired (placed candidates + FTE/Contract tag); profiles sent so far (count + list with stage); engagement history timeline; add-note form (POST `/clients/:id/notes`).

## Vendors list (PRD §3.5)
- GET `/api/v1/vendors` → accordion per vendor: expand → resources supplied (candidate, job, current stage, date) via `/vendors/:id/candidates`. Columns: Name, Specialization tags, Active Submissions, Placed Count, Status.
- Filter by specialization. "+ Add Vendor" inline form (POST).

## Vendor detail (PRD §3.6)
- GET `/api/v1/vendors/:id` → header, performance stats (GET `/vendors/:id/performance`: submissions/shortlisted/placed/ratio), rate card / rate_notes, resources supplied table, notes/communication log (render `rate_notes` + basic timeline).

## Rules
- All fetches use the api helpers; show loading + error states; keep styling in existing classes (ui.tsx / styles.css).
- Numbers (TSC, rates, margin) formatted as INR (₹, toLocaleString).

## Verify
```bash
cd packages/web/setuhireweb && pnpm typecheck && pnpm dev
# :3001 → Clients shows seeded rows; expand Finlytics Corp → its open jobs; detail page shows pricing + margin
# Vendors → TalentBridge Consulting expands → its supplied candidates + performance stats
```
Report: files changed + routes working.
