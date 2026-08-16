# 03 — BE-JOBS (Wave 1, parallel)

**Owner files:** `src/routes/jobs.ts`, `src/services/jobs.ts`  
**PO lens:** A Job is a *live money opportunity*. Every field must answer: what does client pay, who can fill it, who is sourcing, and what’s the pipeline health.

---

## Product intent

| Screen need | API must return |
|-------------|-----------------|
| List: open demand | title, client, stack, exp, TSC, type, status, topMatchScore, pipelineCount |
| Add job: zero typing | parse URL/text → editable preview (not saved) |
| Detail: act now | AI match list, vendor assigns, pipeline by stage, margin vs vendor cost |
| CEO flag | score ≥ 90 → `priority: true` |

---

## Endpoints
```
GET    /api/v1/jobs                    ?client_id=&tech_stack=&status=&employment_type=&q=
POST   /api/v1/jobs                    { ...create body }
POST   /api/v1/jobs/fetch-from-url     { url }           → JobPreview (NOT saved)
POST   /api/v1/jobs/parse-text         { raw_text }      → JobPreview (NOT saved)
GET    /api/v1/jobs/:id
PATCH  /api/v1/jobs/:id
DELETE /api/v1/jobs/:id
POST   /api/v1/jobs/:id/match          → ranked MatchResult[] (persisted)
POST   /api/v1/jobs/:id/assign-vendor  { vendor_id, sourcing_cost? }
```

---

## Create / patch body (fields that matter on screen)

| Field | Req | UI control | Notes |
|-------|-----|------------|-------|
| client_id | yes | Client select | FK |
| title | yes | text | |
| tech_stack | no | tag multi | string[] |
| experience_required | no | text e.g. `6+ years` | display |
| target_selling_cost | no | money | client bill rate |
| currency | no | default INR | |
| employment_type | no | fte \| contract | margin logic differs later |
| status | no | open/on_hold/filled/closed | default open |
| description | no | textarea | human summary |
| raw_jd_text | no | hidden/store | full paste for re-parse |
| source_url | no | url | if fetched |
| parsed_requirements | no | set by parse | jsonb — see below |

### `parsed_requirements` (store on save when from AI preview)
```ts
{
  must_have_skills: string[],
  nice_to_have_skills: string[],
  min_experience?: number,
  max_experience?: number,
  employment_type?: string,
  seniority?: string
}
```

### JobPreview (parse endpoints — never persist)
```ts
{
  title, skills: { must_have: string[], nice_to_have: string[] },
  min_experience?, max_experience?, employment_type?, seniority?,
  experience_required?: string,   // convenience string for form
  description?: string
}
```
- Call only `parseJobFromUrl` / `parseJobFromText` from `../services/ai.js` — **no Anthropic in routes**

---

## List row shape
```ts
{
  id, title, status, employmentType, techStack,
  experienceRequired, targetSellingCost, currency,
  client: { id, name },
  topMatchScore: number|null,     // max match_score for job
  pipelineCount: number,          // matches where stage not in rejected (or all open stages)
  createdAt
}
```
Filters: `client_id` eq, `tech_stack` arrayContains, `status`, `employment_type`, `q` ILIKE title  
Order: createdAt DESC  

---

## Detail shape
```ts
{
  ...all job columns (numeric as number),
  client: { id, name, industry, contactPerson, contactEmail, contactPhone },
  parsedRequirements,
  vendorAssignments: Array<{
    id, vendorId, vendorName, vendorStatus,
    sourcingCost, assignedAt,
    impliedMargin: number|null  // TSC - sourcingCost
  }>,
  pipelineSummary: {
    applied, screened, interview, offer, placed, rejected, total
  },
  // optional convenience for UI header chips
  daysOpen: number  // from createdAt
}
```

---

## Match (`POST .../match`)
1. Load job + all candidates (or available+engaged)  
2. `runMatch(job, candidates)` from `services/ai.js`  
3. Upsert `job_candidate_matches`: job_id, candidate_id, match_score, match_rationale, source_vendor_id from candidate  
4. Return sorted desc:

```ts
Array<{
  matchId?, candidate: { id, name, email, phone, skills, experienceYears, rateExpectation, sourceType, sourceVendorId, sourceVendorName? },
  score: number,
  rationale: string,
  source: 'direct' | string,  // vendor name if vendor
  key_skills_overlap: string[],
  rate_fit: 'ok' | 'above_tsc',
  priority: boolean,          // score >= 90
  existingStage?: string|null // if already in pipeline
}>
```
- No candidates → `200 []`  
- Do not wipe existing stage on upsert if match already exists — update score/rationale only, keep stage  

---

## Assign vendor
```
POST { vendor_id, sourcing_cost? }
```
- Upsert one row per (job_id, vendor_id)  
- Response: assignment + vendor name + impliedMargin  

---

## Rules
- requireAuth; 404 job; 400 bad enums  
- numeric → number  

### Verify
```bash
curl -b c.txt 'localhost:3400/api/v1/jobs?status=open'
curl -b c.txt localhost:3400/api/v1/jobs/<id>
curl -b c.txt -X POST .../jobs/parse-text -d '{"raw_text":"Senior Salesforce Apex LWC 6+ yrs"}'
curl -b c.txt -X POST .../jobs/<id>/match
```
Report: endpoints + curl evidence.
