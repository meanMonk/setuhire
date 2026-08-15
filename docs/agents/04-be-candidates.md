# 04 — BE-CANDIDATES (Wave 1, parallel)

Implements stubs + owned service. Touch ONLY:
- `src/routes/candidates.ts`, `src/routes/matches.ts`
- `src/services/candidates.ts`

## Candidates (PRD §4)
```
GET    /api/v1/candidates             ?skill=&status=&source=
POST   /api/v1/candidates              { name, email, phone, skills[], experience_years, current_status, source_type, source_vendor_id, rate_expectation }
POST   /api/v1/candidates/upload-resume  multipart/form-data { file }  -> parsed preview, NOT saved
GET    /api/v1/candidates/:id          -> detail incl. matchHistory[]
PATCH  /api/v1/candidates/:id
DELETE /api/v1/candidates/:id
```
- **`upload-resume` (MinIO, NOT disk):**
  1. Read multipart file via Hono (c.req.parseBody / `formData()`). Accept PDF/DOCX.
  2. Call `parseResume(buffer, filename)` from `../services/ai.js` → structured profile preview.
  3. **Upload the file to MinIO** using `putObject` from `../lib/minio.js` with key `resumes/<candidate-id-or-uuid>-<filename>`. Store key as the new `resume_url` when saved.
  4. Return `{ parsedProfile, resumeKey }` — do NOT save the candidate yet.
  5. **Never write to `/upload` or disk.**
- `matchHistory[]`: `job_candidate_matches` for this candidate + job title + match_score + stage + rationale.
- Filters: `skill` (arrayContains), `status` (enum), `source` (`direct`|`vendor`).
- `numeric` experience_years / rate_expectation → number on output.

## Matches — pipeline (PRD §4)
```
GET    /api/v1/matches        ?job_id=&candidate_id=&stage=
POST   /api/v1/matches         { job_id, candidate_id, source_vendor_id? }   -> manual add to pipeline (stage "applied")
PATCH  /api/v1/matches/:id     { stage, notes }                              -> move stage
GET    /api/v1/matches/:id
```
- Valid `stage` values: `applied, screened, interview, offer, placed, rejected` (pipeline_stage enum). 400 on invalid.
- List joins job title + candidate name for convenience.
- `POST` should be idempotent-ish: if the (job_id, candidate_id) pair exists, return the existing row (200) instead of duplicating.

## Rules
- `requireAuth` on all. `json`/`error` helpers. 404 for missing candidate/match.
- Upload: reject >10MB and non-PDF/DOCX with 400.

## Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck && pnpm dev
# login, then:
curl -b c.txt 'localhost:3400/api/v1/candidates?status=available'
curl -b c.txt localhost:3400/api/v1/candidates/cand1                      # matchHistory
curl -b c.txt -X POST localhost:3400/api/v1/matches -H 'content-type: application/json' \
  -d '{"job_id":"j2","candidate_id":"cand2"}'                              # pipeline add
curl -b c.txt -X POST localhost:3400/api/v1/candidates/upload-resume \
  -F 'file=@/tmp/test.pdf'                                                # preview + minio key
# confirm the object appears in MinIO console :9001 bucket "setuhire"/resumes/
```
Report: endpoints + curl evidence + MinIO confirmation.
