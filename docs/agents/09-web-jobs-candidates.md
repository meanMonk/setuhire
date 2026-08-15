# 09 — WEB-JOBS-CANDIDATES (Wave 2, parallel)

Fill in stub pages + API helpers. Touch ONLY:
- `src/pages/Jobs/ListPage.tsx`, `Jobs/DetailPage.tsx`, `Jobs/AddJobPage.tsx`
- `src/pages/Candidates/ListPage.tsx`, `Candidates/DetailPage.tsx`, `Candidates/AddCandidatePage.tsx`
- `src/api/jobs.ts`, `src/api/candidates.ts`

Use `api/client.ts` and `components/ui.tsx`. No new deps.

## Jobs list (PRD §3.7)
- GET `/api/v1/jobs` → table: Title, Client, Tech Stack tags, Experience, TSC, Status, Top Match Score, # Candidates in Pipeline. Filters: client, tech stack, status, employment type. "+ Add Job" → `/jobs/new`.

## Add Job flow (PRD §3.7a)
- Two-mode toggle:
  1. URL fetch: input URL → POST `/api/v1/jobs/fetch-from-url` → editable preview (title, skills must/nice, experience, employment type).
  2. Manual/paste: textarea raw JD → POST `/api/v1/jobs/parse-text` → same preview.
- Both → editable form → POST `/api/v1/jobs` to save (`raw_jd_text` included).

## Job detail (PRD §3.8)
- Header: title, client, tech stack, experience, TSC, employment type, status.
- **"Run AI Match"** button → POST `/api/v1/jobs/:id/match` → loading state → ranked list (candidate, match score, source Direct/Vendor, skill overlap tags, rate-vs-TSC indicator). **≥90% candidates visually flagged** (badge). Buttons: "Move to Pipeline" (POST `/api/v1/matches`), "Contact Vendor" (link), "Reject" (PATCH match stage=rejected).
- Vendor assignment section (GET detail `vendorAssignments[]`, POST `/jobs/:id/assign-vendor`).
- Pipeline snapshot: matches by stage for this job.

## Candidates list (PRD §3.9)
- GET `/api/v1/candidates` → table: Name, Skills tags, Experience, Status, Source (Direct/Vendor name), Rate Expectation. Filters: skill, availability, source. "+ Add Candidate" → `/candidates/new`.

## Add Candidate (PRD §3.9)
- Two modes:
  1. **Resume upload (PDF/DOCX, one or multiple)** → POST `/api/v1/candidates/upload-resume` (multipart) → parsed profile preview for review → POST `/api/v1/candidates` to save with `resume_url` = returned MinIO key.
  2. Manual form.
- Show preview (skills/roles/education/certs) with edit before save.

## Candidate detail (PRD §3.10)
- Header: name, contact, status, source. Structured profile from `parsedProfile` (skills, experience timeline, education, certifications). Original resume viewable/downloadable (build URL from `resume_url` → presigned via `GET /api/v1/candidates/:id` won't give a presigned URL by default — if you need view/download, call MinIO presign through backend: ask in your open-questions, else render a "Resume on file" link). Match history (scores + stages). Notes field (PATCH `/api/v1/matches/:id` or candidate note — keep to existing API).

## Rules
- Loading + error states everywhere. INR formatting. Keep styling to existing classes.

## Verify
```bash
cd packages/web/setuhireweb && pnpm typecheck && pnpm dev
# Jobs list → seeded jobs; AddJob paste-mode → preview; Detail → Run AI Match → ranked list with ≥90 flags
# Candidates → upload a test PDF → preview → save → appears in list with resume key
```
Report: files changed + evidence.
