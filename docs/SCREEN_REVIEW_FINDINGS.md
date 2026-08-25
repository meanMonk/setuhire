# Screen Review Findings — vs PRD (2026-08-25)

Review of `packages/web/setuhireweb/src/` against `docs/PRD.md`. No code changes made — findings only, to be addressed later.

## Open decisions (need answer before implementation)

- **Resource Management**: new standalone page (all placed candidates across clients in one view) vs. enriched section inside Client Detail (PRD §3.4 default)?
- **Role permission matrix**: `users.role` exists in DB (`admin | recruiter | ceo`) but is unused anywhere in the frontend beyond display. Need explicit mapping of who sees margin/commission, who can blur/unblur finance data, who sees org-wide vs. own-pipeline data (admin/sales/manager).

## Confirmed gaps

### 1. No margin / sourcing cost anywhere
- `pages/Clients/DetailPage.tsx` — Jobs table shows only `formatInr(j.targetSellingCost)` ("TSC"). Sourcing cost and margin are never computed or rendered, despite PRD §3.4 requiring TSC vs Sourcing Cost vs Margin per active job engagement.
- No vendor-tied-to-job link shown on Client Detail either.

### 2. Match scoring is binary, not 3-tier
- `pages/Jobs/DetailPage.tsx` — only a single `matchScore >= 90` condition flags candidates. PRD §5 defines three bands: 90–100 (priority), 75–89 (good match), <75 (unflagged). `matchScore` is already stored as numeric in `jobCandidateMatches`, so this is a UI-only fix.

### 3. Zero role-based logic in the frontend
- `components/Layout.tsx:78` — `<div className="role">{user?.role}</div>` is the only place `role` is referenced anywhere in `src/`. No `role === 'admin'` checks, no route guards, no `canView`/`hasPermission` helpers exist repo-wide.
- DB already has `users.role` (`admin | recruiter | ceo`); it's simply unused for authorization.

### 4. Finance amounts render unmasked, no permission gate
- `pages/Finance/ListPage.tsx` — `clientBillingAmount`, `vendorPayoutAmount`, `commission` all rendered directly via `formatInr()` in both the summary cards and the table body, with zero conditional/blur/role check.
- `pages/Dashboard.tsx` — "Pending Billing" stat tile (`pendingBillingAmount`, `money: true`) is likewise unconditional; `money: true` is a display-formatting flag only, not a permission gate.
- No `financeVisibility`/`permission` field exists on `users` or elsewhere in the schema — the only lever available is the plain `role` string column.

### 5. Vendor rate card is unstructured
- `pages/Vendors/DetailPage.tsx` — "Rate Card / Notes" card just prints `vendor.rateNotes` as free text. PRD §3.6 implies itemized rates by role type; schema (`vendors.rateNotes`) has no structured field for this.
- Performance stats (Submissions, Shortlisted, Placed, Placement Ratio) are already implemented correctly and match PRD.

## What's already solid (no action needed)
- `Vendors/DetailPage.tsx` performance stats block matches PRD §3.6 requirements.
- `Jobs/DetailPage.tsx` already has match-run trigger, vendor assignment section, and pipeline stage moves — structurally correct, just needs the score-band tiering above.
- `Clients/DetailPage.tsx` already has Jobs table, Resources Hired, Engagement History with add-note form — structurally correct, just missing the pricing breakdown above.

## Schema reference (current state, `packages/backend/setuhireapi/src/db/schema.ts`)
- `users`: `id, email, passwordHash, name, role, createdAt`
- `clients`: `id, name, industry, contactPerson, contactEmail, contactPhone, status, engagementStartDate, createdAt` — no margin/sourcing-cost fields (those live on `jobs`)
- `vendors`: `id, name, specialization, contactPerson, contactEmail, contactPhone, status, rateNotes, createdAt`
- `jobCandidateMatches`: `id, jobId, candidateId, sourceVendorId, matchScore, matchRationale, stage, notes, createdAt`
- No `financeVisibility`, `permission`, or structured rate-card fields exist anywhere in the schema today.
