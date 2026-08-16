# 09 — WEB-JOBS-CANDIDATES (Wave 2, parallel)

**Owner files:**  
- `src/pages/Jobs/ListPage.tsx`, `DetailPage.tsx`, `AddJobPage.tsx`  
- `src/pages/Candidates/ListPage.tsx`, `DetailPage.tsx`, `AddCandidatePage.tsx`  
- `src/api/jobs.ts`, `src/api/candidates.ts`

**PO lens:** Jobs = demand board. Candidates = supply shelf. AI is *assist then human confirm*. ≥90% matches must scream “call now.”

INR formatting. Loading/error everywhere. No new deps.

---

# JOBS

## 1. List — `/jobs` (PRD §3.7)

### Filters bar
| Control | API param |
|---------|-----------|
| Client select | client_id |
| Tech stack text/tag | tech_stack |
| Status multi/single | status |
| Employment type | employment_type |
| Search title | q |

### Columns
| Col | Notes |
|-----|-------|
| Title | link `/jobs/:id` |
| Client | name |
| Tech stack | max 4 tags +N |
| Experience | experienceRequired |
| TSC | ₹ |
| Type | FTE/Contract badge |
| Status | pill |
| Top match | % or —; ≥90 highlight |
| Pipeline | count badge |
| Age | daysOpen or createdAt |

[+ Add Job] → `/jobs/new` (honor `?client_id=` preselect)

---

## 2. Add Job — `/jobs/new` (PRD §3.7a)

### Stepper / toggle (two modes, same final form)

**Mode A — From URL**  
1. URL input + “Fetch & parse” → POST `/jobs/fetch-from-url`  
2. Loading → editable preview form  

**Mode B — Paste / manual**  
1. Large textarea raw JD + “Parse with AI” → POST `/jobs/parse-text`  
2. OR skip parse and fill manually  

### Editable form fields (always shown before save)
| Field | Control | Required | Prefill from preview |
|-------|---------|----------|----------------------|
| client_id | select clients | yes | query param |
| title | text | yes | ✓ |
| tech_stack | tag input | no | must+nice merged or must only |
| must_have_skills | tag input | no | skills.must_have → stored in parsed_requirements |
| nice_to_have_skills | tag input | no | skills.nice_to_have |
| experience_required | text | no | derived |
| min/max experience | number | no | hidden advanced OK |
| target_selling_cost | number | strongly encouraged | — |
| currency | select default INR | no | |
| employment_type | fte/contract | yes-ish | ✓ |
| seniority | text | no | ✓ |
| status | default open | no | |
| description | textarea | no | ✓ |
| raw_jd_text | hidden/textarea | store paste | ✓ |
| source_url | text | if URL mode | ✓ |

Actions: [Cancel] [Save job] → POST `/jobs` including `parsed_requirements` object → navigate `/jobs/:id`

---

## 3. Detail — `/jobs/:id` (PRD §3.8)

### Header
```
Title                          [Status ▾ quick patch] [Type] [₹ TSC]
Client → link · Exp · Stack tags · Days open
[Run AI Match]  [Assign vendor]  [Edit]
```

### Block 1 — Pipeline snapshot
Horizontal counters: Applied | Screened | Interview | Offer | Placed | Rejected  
Click counter → scroll to pipeline table filtered (client filter OK)

### Block 2 — AI Match results
- Button → POST `/jobs/:id/match` with full-page or panel loading (“Scoring N candidates…”)  
- Result table sorted by score:

| Priority | Candidate | Score | Source | Overlap tags | Rate vs TSC | Exp | Actions |
|----------|-----------|-------|--------|--------------|-------------|-----|---------|
| 🔥 if ≥90 | link | bar+% | Direct/Vendor | chips | ok / above (warn) | yrs | see below |

**Row actions**
- **Move to pipeline** → POST `/matches` {job_id, candidate_id} — disable if existingStage set; show stage instead  
- **Contact vendor** → if vendor source, `mailto:` contact or link `/vendors/:id`  
- **Reject** → if match exists PATCH stage=rejected; else optional create+reject  

Score bands visual: ≥90 gold/red border, 75–89 normal, <75 muted

Rationale: expandable 2–3 lines under row

### Block 3 — Vendor assignment
Table: Vendor | Sourcing cost ₹ | Margin (TSC−cost) | Assigned at | Status  
Form: vendor select + sourcing_cost + Assign → POST `/jobs/:id/assign-vendor`

### Block 4 — Pipeline people (GET matches?job_id=)
| Candidate | Stage (select to PATCH) | Score | Notes | Updated |
Stage select onChange → PATCH `/matches/:id` { stage } with confirm on rejected/placed

---

# CANDIDATES

## 4. List — `/candidates` (PRD §3.9)

### Filters
skill · status (availability) · source (direct/vendor) · vendor_id · q  

### Columns
| Name | Skills | Exp | Status | Source (vendor name) | Rate ₹ | Resume • | Added |

[+ Add Candidate] → `/candidates/new`

---

## 5. Add Candidate — `/candidates/new`

### Mode toggle
**A. Resume upload**  
- Dropzone PDF/DOCX (multi: process sequentially)  
- POST multipart `/candidates/upload-resume`  
- Show preview card per file:

| Editable | From parse |
|----------|------------|
| name, email, phone | suggested |
| skills tags | parsedProfile.skills |
| experience_years | parsed |
| roles timeline readonly/edit | roles[] |
| education, certifications | |
| rate_expectation | manual |
| source_type + vendor | manual |
| current_status | default available |
| resume_url | resumeKey hidden |

[Save candidate] → POST `/candidates` with resume_url + parsed_profile  

**B. Manual** — same fields, no resumeKey  

Validation: name required; if source=vendor, vendor required.

---

## 6. Detail — `/candidates/:id` (PRD §3.10)

### Header
Name · StatusPill · Source badge · Rate ₹  
email · phone · [Edit status]

### Structured profile
- Skills chips  
- Experience years  
- Roles timeline: title @ company · duration · tech chips  
- Education · Certifications  

### Resume
- If resumeUrl: “View resume” — if backend has no presign yet, show “On file: {key}” + note; if detail returns URL use it  
- Never point at local disk paths  

### Match history
| Job | Client | Score | Stage | Rationale | When |
Click job → `/jobs/:id`

### Recruiter notes
- Prefer PATCH last match notes OR local textarea that PATCHes candidate if API supports notes field  
- If only match notes exist: show per-match notes in history  

---

## API helpers
`jobs.ts`: list, get, create, update, parseText, fetchUrl, match, assignVendor  
`candidates.ts`: list, get, create, update, uploadResume  
Also thin `createMatch`, `updateMatch` (or import from pipeline api if exists — don’t fight ownership: call `post('/matches')` via client if needed)

### Verify
```bash
pnpm typecheck && pnpm dev
# Jobs list → AddJob paste parse → save → Detail Run AI Match → ≥90 flags + pipeline move
# Candidates upload PDF → preview edit → save → detail profile + history
```
Report: files + evidence.
