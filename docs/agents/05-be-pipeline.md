# 05 — BE-PIPELINE (Wave 1, parallel)

**Owner files:**  
- `src/routes/interviews.ts`, `contracts.ts`, `finance.ts`, `dashboard.ts`  
- `src/services/pipeline.ts`

**PO lens:** This module is the CEO’s daily cockpit after data is in.  
Interviews = calendar of risk. Contracts = locked revenue. Finance = cash truth. Dashboard = “what do I do in the next 30 minutes?”

---

## A. Interviews

### Screen fields
| Field | Why |
|-------|-----|
| candidate, job, client | Who/what/where money sits |
| round (L1/L2/Client/HR) | Pipeline depth |
| interviewer | Accountability |
| scheduled_at | Calendar + “tomorrow” alerts |
| status scheduled/cleared/rejected/no_show | Outcome |
| feedback | Decision memory |

### Endpoints
```
GET    /api/v1/interviews     ?job_id=&candidate_id=&status=&from=&to=&client_id=
POST   /api/v1/interviews     { match_id, round, interviewer?, scheduled_at }
PATCH  /api/v1/interviews/:id { status?, feedback?, scheduled_at?, round?, interviewer? }
DELETE /api/v1/interviews/:id
```

### List row (joined)
```ts
{
  id, matchId, round, interviewer, scheduledAt, status, feedback,
  candidate: { id, name },
  job: { id, title },
  client: { id, name },
  isWithin24h: boolean,
  isPastDue: boolean   // scheduled + scheduledAt < now
}
```
- `from`/`to` filter `scheduled_at` ISO  
- Order: scheduled_at ASC  

---

## B. Contracts

### Screen fields
| Field | Why |
|-------|-----|
| candidate, client, vendor | Parties |
| contract_type | candidate_vendor / vendor_client / direct |
| rate | Locked commercial |
| start_date, end_date | Tenure + expiry risk |
| status | active/expired/terminated |
| document_url | Signed PDF key (MinIO) |
| expiring_soon | CEO red flag ≤ N days |

### Endpoints
```
GET    /api/v1/contracts            ?client_id=&vendor_id=&status=&expiring_days=
POST   /api/v1/contracts            { match_id, contract_type, rate?, start_date?, end_date?, document_url? }
GET    /api/v1/contracts/expiring   ?days=30
GET    /api/v1/contracts/:id
PATCH  /api/v1/contracts/:id
```

### List/detail shape
```ts
{
  id, matchId, contractType, rate, startDate, endDate, documentUrl, status,
  expiringSoon: boolean,
  daysToExpiry: number|null,
  candidate: { id, name },
  client: { id, name },
  vendor: { id, name } | null,   // from match/candidate source when applicable
  job: { id, title, employmentType }
}
```
- `document_url` = MinIO key (frontend uploads separately or via same MinIO pattern as resumes if you add `POST /uploads` — optional; don’t use disk)  
- expiring: end_date ∈ [now, now+days], status=active  

---

## C. Finance (cash truth)

### Screen fields
| Field | Why |
|-------|-----|
| client_billing_amount | What client owes (TSC period) |
| vendor_payout_amount | What we pay out |
| commission | billing − payout (auto) |
| billing_status | pending / invoiced / payment_received |
| period | `YYYY-MM` bucket |
| candidate, client, job, employment_type | Context for CEO table |

### Endpoints
```
GET    /api/v1/finance/records   ?client_id=&vendor_id=&month=&billing_status=
POST   /api/v1/finance/records   { match_id, client_billing_amount, vendor_payout_amount?, billing_status?, period }
PATCH  /api/v1/finance/records/:id
GET    /api/v1/finance/summary   ?month=
GET    /api/v1/finance/export    ?format=csv&month=&client_id=
```

### Record shape
```ts
{
  id, matchId, clientBillingAmount, vendorPayoutAmount, commission,
  billingStatus, period, createdAt,
  candidate: { id, name },
  client: { id, name },
  vendor: { id, name } | null,
  job: { id, title, employmentType }
}
```
- On insert/update: if commission empty → `billing - payout`  
- Summary:
```ts
{
  month: string|null,
  totalRevenue,          // sum client_billing for scope
  totalCommission,       // sum commission
  pendingReceivables,    // sum billing where status != payment_received
  pendingVendorPayouts,  // sum payout where status != payment_received
  invoicedAmount,        // optional extra card
  collectionRatePct      // optional: received/revenue * 100
}
```
- Export: CSV headers matching table columns; `Content-Type: text/csv` + attachment disposition  

---

## D. Dashboard (CEO home — 30-second scan)

### Endpoints
```
GET /api/v1/dashboard/summary
GET /api/v1/dashboard/attention-feed
GET /api/v1/dashboard/activity-log  ?limit=10
```

### summary — all cards clickable via deep-link query on web
```ts
{
  activeClients: number,           // status=active
  openJobs: number,                // status=open
  candidatesAvailable: number,     // available
  vendorsEngaged: number,          // active|preferred with ≥1 submission or assignment
  interviewsThisWeek: number,      // Mon–Sun scheduled_at
  pendingBillingAmount: number,    // finance not payment_received
  // richer CEO chips (include if cheap):
  priorityMatchesUntouched: number, // score>=90 & stage=applied
  contractsExpiring30d: number,
  interviewsNext24h: number
}
```

### attention-feed — rule engine (no LLM)
Each item: `{ id, type, severity, message, link, entityId?, createdAt? }`

| type | Rule | severity | link example |
|------|------|----------|--------------|
| match | score≥90 & stage=applied | high | `/jobs/:id` |
| vendor | open job assigned, no match/interview activity >5 days | medium | `/jobs/:id` or `/vendors/:id` |
| interview | scheduled within 24h | high | `/interviews` |
| interview | scheduled + past due still scheduled | high | `/interviews` |
| contract | ends within 30d, active | medium | `/contracts` |
| finance | pending receivables aging (optional MVP) | low | `/finance` |
| client | no note & no job activity >14d, status=active (optional) | low | `/clients/:id` |

Message examples (plain English, counts OK):  
- `"3 candidates matched ≥90% on Job Senior SFDC — not contacted"`  
- `"Interview with Priya Sharma tomorrow 11:00 — L2"`  
- `"Contract for Rahul ends in 12 days"`  

Order: severity high→low, then time.

### activity-log
```ts
Array<{
  at: string,
  actorName?: string|null,
  candidateName, jobTitle,
  action: string,          // e.g. "stage_change"
  from?: string, to?: string,
  detail?: string
}>
```
Source MVP: latest matches by `createdAt` / stage (if no audit table, approximate with newest matches + notes). Limit default 10.

---

## Rules
- requireAuth; enums validated 400; numeric→number; 404s  

### Verify
```bash
curl -b c.txt 'localhost:3400/api/v1/interviews?from=2026-08-16&to=2026-08-23'
curl -b c.txt 'localhost:3400/api/v1/contracts/expiring?days=45'
curl -b c.txt 'localhost:3400/api/v1/finance/summary?month=2026-08'
curl -b c.txt localhost:3400/api/v1/dashboard/summary
curl -b c.txt localhost:3400/api/v1/dashboard/attention-feed
curl -b c.txt 'localhost:3400/api/v1/finance/export?format=csv' -o /tmp/fin.csv && head /tmp/fin.csv
```
Report: endpoints + curl evidence.
