# SetuHire — Product Requirements Document (MVP)

**Tagline:** Recruit smarter, manage faster.
**Audience of this doc:** Developer / AI coding agent implementing the MVP.
**Stack:** Next.js (frontend) + Hono (REST API) + PostgreSQL + Drizzle ORM + Node.js. Hosted on Contabo VPS via Docker.

---

## 1. Problem statement (why this exists)

SetuHire serves IT staffing/bench-sales businesses that place candidates (Salesforce, ServiceNow, Full-stack, AI/ML) with clients — either by pulling from their own candidate pool or sourcing through vendor/supplier partners, and earning margin between client billing rate and vendor/candidate cost.

Current pain, unfiltered:
1. Recruiters manually dig through **email inboxes** for candidate profiles and vendor supply lists — no central searchable DB.
2. No visibility into **which vendor has correct supply** for a given tech stack until someone remembers or searches old emails.
3. New job openings from clients aren't tracked against **engagement/follow-up status** — leads go cold.
4. As CEO/owner, **no bird's-eye view** of who on the team is working which job, which candidates are hot, or who to call next.
5. No systematic **JD-to-candidate matching** — matching is tribal knowledge in someone's head.
6. **FTE vs Contract** hires aren't distinguished in tracking, but they have different margin/billing logic.
7. No visibility into **margin** (Target Selling Cost vs Sourcing Cost vs commission) per placement until manual Excel reconciliation.
8. No **billing/finance tracking** of what's invoiced to client vs paid to vendor vs pending.

MVP priority is ordered by which pain it kills first: **(1) centralize data → (2) make it searchable/matchable → (3) surface margin & follow-up actions to the CEO.**

---

## 2. Core entities (data model summary)

- **User** (internal team member — recruiter/admin/CEO)
- **Client** (company that has hiring budget)
- **Vendor** (supplier who provides candidates on request)
- **Job** (a requirement raised by a client — FTE or Contract)
- **Candidate** (a person — sourced directly or via a vendor)
- **JobCandidateMatch** (the pipeline join — a candidate against a specific job, with AI match score + stage)
- **Interview** (a round scheduled against a JobCandidateMatch)
- **Contract** (finalized engagement terms once placed)
- **Billing/Finance record** (money in from client, money out to vendor, commission)

---

## 3. Pages — UI requirements

### 3.1 Login
- Email + password fields, "Forgot password" link (stub OK for MVP), single tenant login.
- On success → redirect to Dashboard.
- Store JWT in httpOnly cookie.

### 3.2 Dashboard (bird's-eye view)
Cards (all clickable → deep link to filtered list on respective page):
- **Active Clients** count → Clients page
- **Open Jobs** count → Jobs page (filtered status=open)
- **Candidates Available** count → Candidates page (filtered status=available)
- **Vendors Engaged** count → Vendors page
- **Interviews This Week** count → Interviews page
- **Pending Billing** amount (₹) → Finance page

Below cards:
- **"Needs Your Attention" feed** — auto-generated list, e.g. "3 candidates matched >90% for Job #JD-102, not yet contacted" / "Vendor X hasn't responded in 5 days for Job #JD-98" / "Interview with candidate Y is tomorrow". This directly answers the CEO's "whom to follow up with" pain point.
- **Recent activity log** (last 10 actions across team — who moved what stage).

### 3.3 Clients — list page
- Table/accordion: each **client row expandable** to show their open jobs inline (job title, status, TSC, candidates in pipeline).
- Columns: Client Name, Industry, Active Jobs count, Status (Active/On-hold/Lost), Last Engagement Date.
- Click client name → Client Detail page.
- Filter: by status, by industry.
- "+ Add Client" button.

### 3.4 Client — detail page
- Header: name, industry, status, primary contact (name/email/phone).
- **Engagement history** (timeline of notes/calls logged).
- **Jobs raised by this client** (table, linked to Job Detail).
- **Resources currently hired** (placed candidates under this client, with FTE/Contract tag).
- **Profiles sent so far** (count + list, with stage).
- **Pricing block per job**: Target Selling Cost (TSC) vs Sourcing Cost vs Margin — shown per active engagement, not just one global number (a client can have multiple jobs at different rates).
- **Sourcing partner (vendor) details** tied to each active job, if sourced externally.

### 3.5 Vendors — list page
- **Accordion per vendor** → expands to show resources (candidates) this vendor has supplied, with their current status (submitted/shortlisted/placed).
- Click vendor name → Vendor Detail page.
- Columns: Vendor Name, Specialization tags, Active Submissions, Placed Count, Status (Active/Preferred/Blacklisted).
- Filter: by specialization/tech stack.
- "+ Add Vendor" button.

### 3.6 Vendor — detail page
- Header: name, specialization, contact person, status.
- **Performance stats**: submissions made, shortlisted, placed, submission-to-placement ratio (%).
- **Rate card / typical sourcing cost range** by role type.
- **Resources supplied** (table: candidate name, job applied to, current stage, date supplied).
- **Notes/communication log**.

### 3.7 Jobs — list page
- Filters: by Client, by Tech Stack, by Status (Open/On-hold/Filled/Closed), by Employment Type (FTE/Contract).
- Table columns: Job Title, Client, Tech Stack tags, Experience Required, TSC, Status, Top Match Score (if AI run), # Candidates in Pipeline.
- "+ Add Job" button → opens job creation flow (3.7a).
- Click job title → Job Detail page.

### 3.7a Add Job flow
Two entry modes, toggle:
1. **URL-based fetch**: paste job posting URL → backend fetches + LLM extracts structured JD (title, skills, experience, must-have vs nice-to-have, employment type) → shown in editable preview before save.
2. **Manual/paste entry**: paste raw JD text or fill form fields directly → same LLM structuring pass runs on paste to auto-fill fields, user reviews/edits before save.

Both paths save a `raw_jd_text` (for future re-parsing) and structured fields. This structured store is what becomes their "own job portal" data asset over time.

### 3.8 Job — detail page
- Header: title, client, tech stack, experience required, TSC, employment type, status.
- **"Run AI Match" button** → triggers matching against candidate DB (see §5 algorithm). Shows a loading state, then:
  - Ranked list of candidates, sorted by match score descending.
  - Each row: candidate name, match score (%), source (Direct DB / Vendor name), key skill overlap tags, rate expectation vs TSC fit indicator.
  - **Candidates scoring ≥90% are visually flagged** (badge/highlight) — per the requirement, these are the "call immediately" list.
  - Action buttons per row: "Move to Pipeline", "Contact Vendor" (if sourced), "Reject".
- **Vendor assignment section**: which vendors have been asked to source for this job, sourcing cost quoted, response status.
- **Pipeline snapshot**: candidates currently in Applied/Screened/Interview/Offer stages for this job.

### 3.9 Candidates — list page
- Table: Name, Skills tags, Experience (yrs), Current Status (Available/Engaged/Not Looking), Source (Direct/Vendor name), Rate Expectation.
- Filters: by skill/tech stack, by availability, by source.
- "+ Add Candidate" button → two modes:
  1. **Upload resume (PDF/DOCX)** — one or multiple files → parsed via LLM into structured profile, shown for review before save.
  2. **Manual entry form**.
- Click candidate name → Candidate Detail page.

### 3.10 Candidate — detail page
- Header: name, contact info, current status, source.
- **Structured profile**: skills, experience timeline, education, certifications (from parsed resume JSON).
- **Original resume** viewable/downloadable.
- **Match history**: which jobs this candidate has been matched/submitted against, with scores and stages.
- **Notes** field for recruiter comments.

### 3.11 Interviews — pipeline page
- Toggle: **List view** / **Calendar view**.
- Columns/fields: Candidate, Job, Client, Round (L1/L2/Client), Interviewer, Scheduled Date/Time, Status (Scheduled/Cleared/Rejected/No-show).
- Click row → inline expand for feedback notes.
- "+ Schedule Interview" button (from a JobCandidateMatch).

### 3.12 Contracts — page
- Table: Candidate, Client, Vendor (if applicable), Contract Type (Candidate-Vendor / Vendor-Client / Direct), Rate, Start Date, End Date, Status (Active/Expired/Terminated).
- Expiry alerts: contracts expiring within 30 days visually flagged.
- Document upload/download (signed contract PDF).
- Click row → detail view with full terms.

### 3.13 Finance — page
This directly answers "as CEO, what's billed vs pending vs paid out."
- Table, filterable by Client / Vendor / Month:
  - Candidate, Client, Job, Employment Type, **Client Billing Amount (TSC)**, **Vendor/Sourcing Payout**, **Commission (margin)**, Billing Status (Invoiced/Payment Received/Pending), Period.
- Summary cards at top: **Total Revenue (this month)**, **Total Commission Earned**, **Pending Receivables**, **Pending Vendor Payouts**.
- Export to CSV button (for accountant handoff).

---

## 4. REST API — Hono + PostgreSQL + Drizzle ORM

Base path: `/api/v1`. All routes except `/auth/*` require `Authorization: Bearer <jwt>`.

### Auth
```
POST   /api/v1/auth/register        { email, password, name }         -> creates user (admin-invite only in MVP, or open for first user)
POST   /api/v1/auth/login           { email, password }                -> { token, user }
POST   /api/v1/auth/logout          -> clears session
GET    /api/v1/auth/me              -> current user profile
```

### Clients
```
GET    /api/v1/clients                     ?status=&industry=         -> list (with jobs count, active engagements)
POST   /api/v1/clients                     { name, industry, contact_person, contact_email, contact_phone, status }
GET    /api/v1/clients/:id                                            -> detail incl. jobs[], resourcesHired[], engagementHistory[]
PATCH  /api/v1/clients/:id
DELETE /api/v1/clients/:id
GET    /api/v1/clients/:id/jobs                                       -> jobs raised by this client
POST   /api/v1/clients/:id/notes           { note }                    -> add engagement history entry
```

### Vendors
```
GET    /api/v1/vendors                     ?specialization=&status=
POST   /api/v1/vendors                     { name, specialization[], contact_person, contact_email, contact_phone, status }
GET    /api/v1/vendors/:id                                            -> detail incl. resourcesSupplied[], performanceStats
PATCH  /api/v1/vendors/:id
DELETE /api/v1/vendors/:id
GET    /api/v1/vendors/:id/candidates                                 -> candidates sourced by this vendor
GET    /api/v1/vendors/:id/performance                                -> { submissions, shortlisted, placed, ratio }
```

### Jobs
```
GET    /api/v1/jobs                        ?client_id=&tech_stack=&status=&employment_type=
POST   /api/v1/jobs                         { client_id, title, tech_stack[], experience_required, target_selling_cost, currency, employment_type, description, raw_jd_text, source_url }
POST   /api/v1/jobs/fetch-from-url          { url }                    -> LLM-fetched + parsed JD preview (not saved yet)
POST   /api/v1/jobs/parse-text              { raw_text }                -> LLM-parsed JD preview (not saved yet)
GET    /api/v1/jobs/:id                                                -> detail incl. vendorAssignments[], pipelineSummary
PATCH  /api/v1/jobs/:id
DELETE /api/v1/jobs/:id
POST   /api/v1/jobs/:id/match                                          -> runs AI matching, returns ranked candidates (also persists to job_candidate_matches)
POST   /api/v1/jobs/:id/assign-vendor       { vendor_id, sourcing_cost }
```

### Candidates
```
GET    /api/v1/candidates                  ?skill=&status=&source=
POST   /api/v1/candidates                   { name, email, phone, skills[], experience_years, current_status, source_type, source_vendor_id, rate_expectation }
POST   /api/v1/candidates/upload-resume     multipart/form-data { file } -> LLM-parsed profile preview (not saved yet)
GET    /api/v1/candidates/:id                                          -> detail incl. matchHistory[]
PATCH  /api/v1/candidates/:id
DELETE /api/v1/candidates/:id
```

### Job-Candidate Matches (pipeline)
```
GET    /api/v1/matches                     ?job_id=&candidate_id=&stage=
POST   /api/v1/matches                      { job_id, candidate_id, source_vendor_id? }   -> manual add to pipeline
PATCH  /api/v1/matches/:id                  { stage, notes }                              -> move pipeline stage
GET    /api/v1/matches/:id
```

### Interviews
```
GET    /api/v1/interviews                  ?job_id=&candidate_id=&status=&from=&to=
POST   /api/v1/interviews                   { match_id, round, interviewer, scheduled_at }
PATCH  /api/v1/interviews/:id               { status, feedback, scheduled_at }
DELETE /api/v1/interviews/:id
```

### Contracts
```
GET    /api/v1/contracts                   ?client_id=&vendor_id=&status=
POST   /api/v1/contracts                    { match_id, contract_type, rate, start_date, end_date, document_url }
GET    /api/v1/contracts/:id
PATCH  /api/v1/contracts/:id
GET    /api/v1/contracts/expiring           ?days=30                  -> contracts expiring soon
```

### Finance
```
GET    /api/v1/finance/records              ?client_id=&vendor_id=&month=
POST   /api/v1/finance/records               { match_id, client_billing_amount, vendor_payout_amount, billing_status, period }
PATCH  /api/v1/finance/records/:id
GET    /api/v1/finance/summary               ?month=                  -> { totalRevenue, totalCommission, pendingReceivables, pendingVendorPayouts }
GET    /api/v1/finance/export                ?format=csv
```

### Dashboard
```
GET    /api/v1/dashboard/summary                                      -> counts for all cards
GET    /api/v1/dashboard/attention-feed                                -> auto-generated follow-up items
GET    /api/v1/dashboard/activity-log        ?limit=10
```

---

## 5. AI matching algorithm (proposed design)

**Goal:** given a Job, rank all candidates in DB by fit, output score 0–100 + short rationale, flag ≥90 as priority-call.

**Stage 1 — Structuring (on ingestion, not at match time)**
- Resume → LLM extraction → structured JSON: `{skills: [], experience_years, roles: [{title, company, duration, tech}], education, certifications}`. Stored on candidate record (`parsed_profile` jsonb column).
- Job (on creation, from URL/paste) → LLM extraction → `{must_have_skills: [], nice_to_have_skills: [], min_experience, max_experience, employment_type, seniority}`. Stored on job record (`parsed_requirements` jsonb column).

**Stage 2 — Scoring (on-demand, when "Run AI Match" clicked)**
Composite score = weighted sum:
- **Must-have skill coverage** (50%): % of `must_have_skills` present in candidate's skill list (exact + synonym match, e.g. "ReactJS" = "React").
- **Nice-to-have skill coverage** (15%): same, lower weight.
- **Experience fit** (20%): penalize if candidate experience is below `min_experience`; slight penalty if far above `max_experience` (overqualified/rate mismatch risk).
- **Rate fit** (15%): candidate `rate_expectation` vs job `target_selling_cost` — if candidate rate exceeds TSC, flag and reduce score (this stops the recruiter chasing an unaffordable match).

Score bands:
- **90–100**: priority call list (highlighted in UI)
- **75–89**: good match, secondary list
- **Below 75**: shown but not flagged

**Stage 3 — Rationale generation**
- Single LLM call per top-N (e.g., top 20) candidates: input = candidate structured JSON + job structured JSON → output = 2–3 line plain-English rationale ("Strong Salesforce Lightning + Apex match, 6.5 yrs exp fits the 6+ requirement, rate expectation slightly above TSC — negotiable"). Stored alongside the score so it's not regenerated every page view.

**Implementation note for MVP:** Stage 1+3 use Claude API (structured JSON output mode). Stage 2 (scoring) is deterministic code — no need for an LLM call per candidate per job, this keeps matching fast and cheap even with a large candidate DB. Only the rationale text for top matches goes through the LLM.

---

## 6. Database schema (PostgreSQL + Drizzle ORM)

```typescript
// schema.ts — Drizzle ORM table definitions

import { pgTable, uuid, varchar, text, integer, numeric, timestamp, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core";

export const employmentTypeEnum = pgEnum("employment_type", ["fte", "contract"]);
export const jobStatusEnum = pgEnum("job_status", ["open", "on_hold", "filled", "closed"]);
export const clientStatusEnum = pgEnum("client_status", ["active", "on_hold", "lost"]);
export const vendorStatusEnum = pgEnum("vendor_status", ["active", "preferred", "blacklisted"]);
export const candidateStatusEnum = pgEnum("candidate_status", ["available", "engaged", "not_looking"]);
export const pipelineStageEnum = pgEnum("pipeline_stage", ["applied", "screened", "interview", "offer", "placed", "rejected"]);
export const interviewStatusEnum = pgEnum("interview_status", ["scheduled", "cleared", "rejected", "no_show"]);
export const contractTypeEnum = pgEnum("contract_type", ["candidate_vendor", "vendor_client", "direct"]);
export const contractStatusEnum = pgEnum("contract_status", ["active", "expired", "terminated"]);
export const billingStatusEnum = pgEnum("billing_status", ["invoiced", "payment_received", "pending"]);
export const sourceTypeEnum = pgEnum("source_type", ["direct", "vendor"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("recruiter"), // admin | recruiter | ceo
  createdAt: timestamp("created_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 150 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  status: clientStatusEnum("status").default("active"),
  engagementStartDate: timestamp("engagement_start_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientNotes = pgTable("client_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").references(() => clients.id),
  note: text("note").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  specialization: jsonb("specialization").$type<string[]>().default([]),
  contactPerson: varchar("contact_person", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  status: vendorStatusEnum("status").default("active"),
  rateNotes: text("rate_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  techStack: jsonb("tech_stack").$type<string[]>().default([]),
  experienceRequired: varchar("experience_required", { length: 50 }), // e.g. "6+ years"
  targetSellingCost: numeric("target_selling_cost", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("INR"),
  employmentType: employmentTypeEnum("employment_type").default("contract"),
  status: jobStatusEnum("status").default("open"),
  description: text("description"),
  rawJdText: text("raw_jd_text"),
  sourceUrl: text("source_url"),
  parsedRequirements: jsonb("parsed_requirements"), // { must_have_skills, nice_to_have_skills, min_experience, max_experience }
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobVendorAssignments = pgTable("job_vendor_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id).notNull(),
  sourcingCost: numeric("sourcing_cost", { precision: 12, scale: 2 }),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  skills: jsonb("skills").$type<string[]>().default([]),
  experienceYears: numeric("experience_years", { precision: 4, scale: 1 }),
  currentStatus: candidateStatusEnum("current_status").default("available"),
  sourceType: sourceTypeEnum("source_type").default("direct"),
  sourceVendorId: uuid("source_vendor_id").references(() => vendors.id),
  rateExpectation: numeric("rate_expectation", { precision: 12, scale: 2 }),
  resumeUrl: text("resume_url"),
  parsedProfile: jsonb("parsed_profile"), // { skills, experience_years, roles[], education, certifications }
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobCandidateMatches = pgTable("job_candidate_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  candidateId: uuid("candidate_id").references(() => candidates.id).notNull(),
  sourceVendorId: uuid("source_vendor_id").references(() => vendors.id),
  matchScore: numeric("match_score", { precision: 5, scale: 2 }),
  matchRationale: text("match_rationale"),
  stage: pipelineStageEnum("stage").default("applied"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => jobCandidateMatches.id).notNull(),
  round: varchar("round", { length: 50 }), // L1 | L2 | Client
  interviewer: varchar("interviewer", { length: 255 }),
  scheduledAt: timestamp("scheduled_at"),
  status: interviewStatusEnum("status").default("scheduled"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => jobCandidateMatches.id).notNull(),
  contractType: contractTypeEnum("contract_type").notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  documentUrl: text("document_url"),
  status: contractStatusEnum("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financeRecords = pgTable("finance_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => jobCandidateMatches.id).notNull(),
  clientBillingAmount: numeric("client_billing_amount", { precision: 12, scale: 2 }),
  vendorPayoutAmount: numeric("vendor_payout_amount", { precision: 12, scale: 2 }),
  commission: numeric("commission", { precision: 12, scale: 2 }), // computed = billing - payout
  billingStatus: billingStatusEnum("billing_status").default("pending"),
  period: varchar("period", { length: 20 }), // "2026-08"
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 7. Seed data

CSV files provided separately (see attached): `users.csv`, `clients.csv`, `vendors.csv`, `jobs.csv`, `candidates.csv`, `job_candidate_matches.csv`, `interviews.csv`, `contracts.csv`, `finance_records.csv`.

Import order matters due to foreign keys: `users → clients → vendors → jobs → candidates → job_vendor_assignments → job_candidate_matches → interviews → contracts → finance_records`.

Seed script suggestion (give this instruction to the AI coding agent):
> "Write a `seed.ts` script using Drizzle ORM that reads each CSV from `/seed`, in dependency order, and inserts rows via `db.insert()`. Use `papaparse` or Node's built-in CSV handling. Wrap in a transaction. Log row counts per table on completion."

---

## 8. MVP scope guardrails (build sequencing)

Build and ship in this order — each stage independently demoable:

1. **Auth + Clients + Vendors + Candidates (CRUD only, no AI)** — centralizes the data that currently lives in email. This alone kills pain points #1 and #2.
2. **Jobs + manual pipeline (JobCandidateMatch, stage moves)** — kills pain point #3 (engagement tracking).
3. **Dashboard + attention feed** — kills pain point #4 (CEO visibility).
4. **AI job parsing (URL/paste) + AI candidate matching + rationale** — kills pain point #5.
5. **Interviews + Contracts** — completes pipeline lifecycle.
6. **Finance module** — kills pain points #6 and #7 (margin + billing visibility).

Do not start AI matching (stage 4) until stages 1–3 are working and demoable — matching is worthless without clean underlying data.
