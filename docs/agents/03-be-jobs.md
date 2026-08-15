# 03 — BE-JOBS (Wave 1, parallel)

Implements stub + owned service. Touch ONLY:
- `src/routes/jobs.ts`, `src/services/jobs.ts`

## Endpoints (PRD §4)
```
GET    /api/v1/jobs                     ?client_id=&tech_stack=&status=&employment_type=
POST   /api/v1/jobs                      { client_id, title, tech_stack[], experience_required, target_selling_cost, currency, employment_type, description, raw_jd_text, source_url }
POST   /api/v1/jobs/fetch-from-url       { url }        -> LLM-parsed preview, NOT saved
POST   /api/v1/jobs/parse-text           { raw_text }   -> LLM-parsed preview, NOT saved
GET    /api/v1/jobs/:id                                -> detail incl. vendorAssignments[], pipelineSummary
PATCH  /api/v1/jobs/:id
DELETE /api/v1/jobs/:id
POST   /api/v1/jobs/:id/match                           -> runs ai.runMatch, persists job_candidate_matches, returns ranked list
POST   /api/v1/jobs/:id/assign-vendor    { vendor_id, sourcing_cost }
```
- `fetch-from-url` / `parse-text`: call `parseJobFromUrl(url)` / `parseJobFromText(rawText)` from `../services/ai.js` (stub exists). Return the preview object `{ title, skills: {must_have, nice_to_have}, experience, employment_type, seniority }`. **Do not import Anthropic directly.**
- `match`: fetch job + candidates from DB → `runMatch(job, candidates)` from `services/ai.js` → upsert `job_candidate_matches` (job_id, candidate_id, match_score, match_rationale, source_vendor_id from candidate) → return array sorted desc by score with `{ candidate, score, rationale, source, key_skills_overlap, rate_fit }`. Flag `score >= 90` (add `priority: true`).
- `pipelineSummary`: counts of `job_candidate_matches` by stage for this job.
- `vendorAssignments`: `job_vendor_assignments` joined with vendor name + status.
- `assign-vendor`: upsert assignment (one vendor per job — replace existing row for that vendor).
- Filters: `client_id` (eq), `tech_stack` (arrayContains), `status`, `employment_type` (enum eq).
- `numeric` target_selling_cost → number on output.

## Rules
- `requireAuth` on all. `json`/`error` helpers. 404 for missing job.
- On `match` with no candidates → 200 with empty array (don't error).

## Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck && pnpm dev
# login, then:
curl -b c.txt 'localhost:3400/api/v1/jobs?status=open'            # seeded jobs
curl -b c.txt localhost:3400/api/v1/jobs/j1                       # detail + pipelineSummary
curl -b c.txt -X POST localhost:3400/api/v1/jobs/parse-text -H 'content-type: application/json' \
  -d '{"raw_text":"Need a Senior Salesforce dev, Apex + LWC, 6+ yrs"}'   # preview, no save
curl -b c.txt -X POST localhost:3400/api/v1/jobs/j1/match         # ranked candidates persisted
```
Report: endpoints + curl evidence.
