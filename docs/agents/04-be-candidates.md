# 04 — BE-CANDIDATES (Wave 1, parallel)

**Owner files:**  
- `src/routes/candidates.ts`, `src/routes/matches.ts`  
- `src/services/candidates.ts`

**PO lens:** Candidates are inventory. Pipeline matches are *work in progress*. Resume parse must be review-then-save so bad AI never pollutes the DB.

---

## A. Candidates

### Fields that matter on every screen
| Field | List | Detail | Add | Why |
|-------|------|--------|-----|-----|
| name, email, phone | ✓ | ✓ | ✓ | Contact in one click |
| skills[] | tags | tags | multi | Search + match |
| experience_years | ✓ | ✓ | ✓ | Fit vs JD |
| current_status | ✓ | ✓ | ✓ | available / engaged / not_looking |
| source_type + source_vendor_id | ✓ | ✓ | ✓ | Direct vs partner supply |
| rate_expectation | ✓ | ✓ | ✓ | vs TSC / margin |
| resume_url (MinIO key) | badge | download | from upload | Original proof |
| parsed_profile jsonb | — | full | from upload | Structured CV |
| notes (optional on candidate) | — | if column exists | — | Else use match notes |
| createdAt | ✓ | ✓ | — | Freshness |

### Endpoints
```
GET    /api/v1/candidates                ?skill=&status=&source=&q=&vendor_id=
POST   /api/v1/candidates                { create body }
POST   /api/v1/candidates/upload-resume  multipart { file }  → preview NOT saved
GET    /api/v1/candidates/:id
PATCH  /api/v1/candidates/:id
DELETE /api/v1/candidates/:id
```

### Create body
```ts
{
  name: string,                    // required
  email?: string,
  phone?: string,
  skills?: string[],
  experience_years?: number,
  current_status?: 'available'|'engaged'|'not_looking',
  source_type?: 'direct'|'vendor',
  source_vendor_id?: string|null,  // required-ish when source_type=vendor
  rate_expectation?: number,
  resume_url?: string,             // MinIO key from upload step
  parsed_profile?: object          // from upload preview
}
```

### List row
```ts
{
  id, name, email, phone, skills, experienceYears, currentStatus,
  sourceType, sourceVendorId, sourceVendorName: string|null,
  rateExpectation, hasResume: boolean, createdAt
}
```
Filters: `skill` arrayContains, `status`→current_status, `source`→source_type, `vendor_id`, `q` ILIKE name|email  

### Detail
```ts
{
  ...all fields,
  sourceVendor: { id, name } | null,
  parsedProfile: {
    skills?, experience_years?,
    roles?: Array<{ title, company, duration?, tech?: string[] }>,
    education?, certifications?
  } | null,
  resumeUrl,                    // key
  // if you add presign helper later: resumeDownloadUrl
  matchHistory: Array<{
    matchId, jobId, jobTitle, clientName,
    matchScore, stage, matchRationale, notes, createdAt
  }>
}
```

### Upload resume (MinIO only — never disk)
1. multipart file; PDF/DOCX only; max 10MB → else 400  
2. `parseResume(buffer, filename)` from `services/ai.js`  
3. `putObject` key `resumes/<uuid>-<safeFilename>` via `lib/minio.js`  
4. Return:
```ts
{
  parsedProfile: CandidateProfile,
  resumeKey: string,
  // suggested form defaults:
  suggested: { name?, email?, phone?, skills?, experience_years? }
}
```
Do **not** insert candidate until explicit POST /candidates.

---

## B. Matches (pipeline spine)

### Stage machine (CEO pipeline)
`applied → screened → interview → offer → placed`  
side exit: `rejected` from any stage  

### Endpoints
```
GET    /api/v1/matches       ?job_id=&candidate_id=&stage=&client_id=
POST   /api/v1/matches       { job_id, candidate_id, source_vendor_id?, notes? }  → stage=applied
PATCH  /api/v1/matches/:id   { stage?, notes?, match_score? }   // stage move + notes
GET    /api/v1/matches/:id
```

### List/detail join shape (always)
```ts
{
  id, jobId, candidateId, sourceVendorId, matchScore, matchRationale, stage, notes, createdAt,
  job: { id, title, clientId, clientName, targetSellingCost, employmentType, status },
  candidate: { id, name, skills, experienceYears, rateExpectation, sourceType },
  sourceVendorName?: string|null,
  priority?: boolean  // score >= 90
}
```

### Rules
- POST idempotent on (job_id, candidate_id): return existing 200, don’t duplicate  
- Invalid stage → 400  
- List joins title + names for UI tables  

---

## Rules
- requireAuth; numeric→number; 404s  
- Upload never writes `/upload` or local disk  

### Verify
```bash
curl -b c.txt 'localhost:3400/api/v1/candidates?status=available'
curl -b c.txt localhost:3400/api/v1/candidates/<id>
curl -b c.txt -X POST .../matches -d '{"job_id":"...","candidate_id":"..."}'
curl -b c.txt -X POST .../candidates/upload-resume -F 'file=@/tmp/test.pdf'
# MinIO :9001 bucket setuhire/resumes/
```
Report: endpoints + curl + MinIO confirmation.
