# SetuHire — PO screen depth (Wave 1–2)

**Audience:** Product owner + implementers of agents 01–06, 08–10.  
**Out of scope here:** Foundation wave0 (`00`), web shell (`07`) — keep those thin.

**Design north star:** A CEO of an IT staffing / bench-sales firm opens the app between calls and in **under 30 seconds** knows: *whom to call, what’s open, what’s stuck, what’s expiring, what’s unpaid.*

---

## 1. Jobs-to-be-done (not features)

| JTBD | Primary screens | Success signal |
|------|-----------------|----------------|
| Centralize clients & vendors out of email | Clients, Vendors | Search + contact + status without inbox |
| See open demand vs supply | Jobs list, Candidates list | Filters by stack/status; counts honest |
| Decide who to call *today* | Dashboard attention, Job AI match ≥90 | Priority flags + one-click pipeline |
| Track deal through stages | Job detail pipeline, Matches API | Stage moves logged |
| Don’t miss interviews | Interviews list/calendar | 24h + overdue flags |
| Lock commercial terms | Contracts | Expiring ≤30d red |
| Know cash position | Finance | Revenue / commission / pending cards + CSV |
| Protect margin | Client detail pricing, Job vendor assign | TSC − sourcing always visible |

---

## 2. Information architecture (simple)

```
Dashboard          ← morning cockpit
Clients ⇄ Jobs ⇄ Candidates
   ↓         ↓          ↓
 Vendors   Pipeline   Matches
              ↓
        Interviews → Contracts → Finance
```

Every list row should deep-link to detail. Every count on Dashboard should deep-link to a **pre-filtered** list.

---

## 3. Screen field matrix (MVP must-have)

### Dashboard
- Cards: active clients, open jobs, candidates available, vendors engaged, interviews this week, pending billing ₹  
- Extra chips if cheap: priority matches untouched, contracts expiring 30d, interviews next 24h  
- Attention feed (rules, not LLM): hot matches, silent vendors, interviews, expiring contracts  
- Activity: last stage moves  

### Clients list / detail
- List: name, industry, active jobs, status, contact, last engagement; expand → open jobs (title, status, TSC, pipeline#)  
- Detail: header contact; KPI chips; **jobs + TSC/sourcing/margin**; hired resources; profiles sent; note timeline  

### Vendors list / detail
- List: name, specialization, active submissions, placed, status; expand → supplied candidates  
- Detail: performance (submit/shortlist/place/ratio%); rate notes; resources; assigned jobs  

### Jobs list / add / detail
- List: title, client, stack, exp, TSC, type, status, top match %, pipeline#  
- Add: URL **or** paste → AI preview → edit all commercial + skill fields → save raw + parsed  
- Detail: pipeline counters; **Run AI Match** table (priority ≥90, overlap, rate fit, actions); vendor assign + margin; stage board  

### Candidates list / add / detail
- List: name, skills, exp, status, source, rate, resume flag  
- Add: resume upload preview (edit!) or manual; vendor source required when source=vendor  
- Detail: structured profile, resume on file, match history  

### Interviews
- List + month calendar; round, interviewer, when, status; expand feedback; schedule from match  

### Contracts
- Parties, type, rate, dates, status, doc; expiring flag; side panel edit  

### Finance
- Month summary 4 cards; records with bill/payout/commission/status/period; inline status; CSV export  

---

## 4. Status & vocabulary (keep consistent in UI copy)

| Domain | Values |
|--------|--------|
| Client | active, on_hold, lost |
| Vendor | active, preferred, blacklisted |
| Job | open, on_hold, filled, closed |
| Candidate | available, engaged, not_looking |
| Pipeline | applied → screened → interview → offer → placed / rejected |
| Interview | scheduled, cleared, rejected, no_show |
| Contract | active, expired, terminated |
| Billing | pending, invoiced, payment_received |
| Employment | fte, contract |
| Source | direct, vendor |

Money: default **INR**, always formatted. Margin = TSC − sourcing (or billing − payout).

---

## 5. CEO interaction rules (UX)

1. **Scan → filter → act** on one screen; avoid multi-page wizards except Add Job / Add Candidate.  
2. **AI never auto-saves** — preview then human confirm.  
3. **≥90% match** = visual emergency (badge/border), default sort top.  
4. **Empty states** teach the next action (“Add client”, “Run AI Match”).  
5. **Mutations optimistic-optional**; always refetch or patch local row on success.  
6. **No Excel for daily ops** — export only for accountant (Finance CSV).  

---

## 6. Agent map (rewritten briefs)

| Agent | Depth focus |
|-------|-------------|
| 01 BE-Auth | Session gate only |
| 02 BE-Clients-Vendors | List aggregates, detail pricing/performance shapes |
| 03 BE-Jobs | Preview parse, match payload, vendor margin |
| 04 BE-Candidates | Resume preview, match spine, idempotent pipeline add |
| 05 BE-Pipeline | Interviews/contracts/finance shapes + dashboard rules |
| 06 BE-AI | Explainable scores + fallback always-on |
| 08 Web C/V | Expandable lists, client margin table, vendor ratio cards |
| 09 Web J/C | Full add flows, match action grid, resume review |
| 10 Web P/F | Calendar, expiring, finance cockpit + CSV |

---

## 7. Explicit non-goals (keep MVP simple)

- Multi-tenant / SSO / RBAC matrix (role string only)  
- Email/WhatsApp send from app  
- Full ATS careers page  
- Accounting GST/invoices PDF  
- Real-time websockets  
- Mobile native app  

Build **depth on the desk the CEO already has**, not adjacent products.
