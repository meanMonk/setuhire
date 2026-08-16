# 10 — WEB-PIPELINE-FINANCE (Wave 2, parallel)

**Owner files:**  
- `src/pages/Interviews/ListPage.tsx`  
- `src/pages/Contracts/ListPage.tsx`  
- `src/pages/Finance/ListPage.tsx`  
- `src/api/pipeline.ts`

**PO lens:**  
- Interviews = “who do I prep today?”  
- Contracts = “who’s locked / about to fall off?”  
- Finance = “what’s in the bank vs promised?”  

Keep simple. Dense tables > pretty charts for MVP. INR everywhere. No new deps (calendar = native Date grid).

---

# INTERVIEWS — `/interviews` (PRD §3.11)

## Chrome
```
[List | Calendar] toggle
Filters: Status ▾ · From date · To date · Client (opt) · Job (opt)
[+ Schedule interview]
```

## List view columns
| Candidate | Job | Client | Round | Interviewer | When | Status | Flags |
|-----------|-----|--------|-------|-------------|------|--------|-------|
| link | link | text | L1/L2/Client | text | datetime | pill | ⏰ <24h · ⚠️ overdue |

### Row expand
- Feedback (readonly)  
- Quick actions: Mark cleared | Rejected | No-show | Edit time  
→ PATCH `/interviews/:id`  
- Feedback textarea + Save  

## Calendar view
- Month grid (current month default; prev/next)  
- Dots/pills on days with counts  
- Click day → side list of that day’s interviews (same row component)  
- No external calendar library  

## + Schedule form
| Field | Control | Required |
|-------|---------|----------|
| match_id | search/select: type candidate or job to find match | yes |
| round | select L1 / L2 / Client / HR / Other | yes |
| interviewer | text | no |
| scheduled_at | datetime-local | yes |

POST `/interviews` → refresh  

Deep link support: `?status=scheduled&from=&to=` from dashboard cards.

---

# CONTRACTS — `/contracts` (PRD §3.12)

## Chrome
```
Filters: Status · Client · Vendor · [Expiring ≤30d toggle]
[+ New contract]
```

## Table columns
| Candidate | Client | Vendor | Type | Rate ₹ | Start | End | Status | Doc | Flags |
|-----------|--------|--------|------|--------|-------|-----|--------|-----|-------|
| | | | candidate_vendor / vendor_client / direct | | | | pill | 📄/— | 🔴 expiring |

- Expiring: merge `GET /contracts/expiring?days=30` ids OR use `expiringSoon` on list  
- Red badge: “Ends in Nd”  

## Row → detail side panel
Full fields + document link  
Actions: Edit status, Extend end date (PATCH), Mark terminated  

## + New / Edit fields
| Field | Control | Required |
|-------|---------|----------|
| match_id | select placed/offer matches preferred | yes |
| contract_type | select 3 types | yes |
| rate | number | yes |
| start_date | date | yes |
| end_date | date | no (FTE may be empty) |
| document_url | file → MinIO key if upload API exists; else text key / skip | no |
| status | default active | |

Document: if no upload endpoint, accept paste key or “attach later”; never fake local path.

Dashboard deep link: highlight expiring filter when `?expiring=1`.

---

# FINANCE — `/finance` (PRD §3.13)

## Top summary cards (`GET /finance/summary?month=`)
| Card | Field | Click |
|------|-------|-------|
| Revenue (month) | totalRevenue | — |
| Commission earned | totalCommission | — |
| Pending receivables | pendingReceivables | filter status≠received |
| Pending vendor payouts | pendingVendorPayouts | — |

Month picker default current `YYYY-MM` (seed Aug 2026 in dev).

Optional secondary: collection % if API sends it.

## Filters
Client · Vendor · Month · Billing status  

## Records table (`GET /finance/records`)
| Candidate | Client | Job | Type | Client bill ₹ | Vendor payout ₹ | Commission ₹ | Status | Period | Actions |
|-----------|--------|-----|------|---------------|-----------------|--------------|--------|--------|---------|
| | | | FTE/Contract | | | auto | pill | 2026-08 | Edit |

Commission column emphasize (CEO eyes).  
Status colors: pending=amber, invoiced=blue, payment_received=green  

## + Add / Edit record
| Field | Control | Required |
|-------|---------|----------|
| match_id | select (placed preferred) | yes |
| client_billing_amount | number | yes |
| vendor_payout_amount | number | no |
| billing_status | select | default pending |
| period | month input YYYY-MM | yes |

Show live commission preview: billing − payout  

PATCH inline status change encouraged (dropdown).

## Export
[Export CSV] → GET `/finance/export?format=csv&month=`  
fetch blob + download `setuhire-finance-YYYY-MM.csv` with credentials.

---

# `src/api/pipeline.ts` helpers
```ts
// interviews
listInterviews(params), createInterview, updateInterview, deleteInterview
// contracts
listContracts, listExpiringContracts, getContract, createContract, updateContract
// finance
listFinanceRecords, createFinanceRecord, updateFinanceRecord, financeSummary, financeExportBlob
```

---

## Cross-page CEO flows (implement if trivial)
1. Dashboard “Interviews this week” → `/interviews?from=mon&to=sun`  
2. “Pending billing” → `/finance?billing_status=pending`  
3. Attention “contract expiring” → `/contracts?expiring=1`  

(Query parsing on these pages is part of this brief.)

### Verify
```bash
cd packages/web/setuhireweb && pnpm typecheck && pnpm dev
# Interviews: list+calendar, schedule, feedback expand
# Contracts: expiring badge, side panel
# Finance: Aug 2026 cards (rev 160000 / commission 20000 if seed), CSV download
```
Report: files + evidence.
