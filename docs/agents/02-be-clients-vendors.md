# 02 — BE-CLIENTS-VENDORS (Wave 1, parallel)

Implements stubs + owned services. Touch ONLY:
- `src/routes/clients.ts`, `src/routes/vendors.ts`
- `src/services/clients.ts`, `src/services/vendors.ts` (optional — keep logic in routes if small)

## Clients (PRD §4)
```
GET    /api/v1/clients        ?status=&industry=   -> list; include jobsCount, activeJobsCount
POST   /api/v1/clients        { name, industry, contact_person, contact_email, contact_phone, status }
GET    /api/v1/clients/:id                         -> detail incl. jobs[], resourcesHired[], engagementHistory[] (client_notes)
PATCH  /api/v1/clients/:id
DELETE /api/v1/clients/:id
GET    /api/v1/clients/:id/jobs                    -> jobs raised by client
POST   /api/v1/clients/:id/notes   { note }        -> add client_notes row (createdBy = current user)
```
- Filtering: `status` = client_status enum, `industry` = string contains. Order by name.
- `resourcesHired` = placed candidates (`job_candidate_matches` stage='placed') joined to candidates, with FTE/Contract tag from their job.
- `engagementHistory` = `client_notes` (note + createdAt + createdBy name).

## Vendors (PRD §4)
```
GET    /api/v1/vendors         ?specialization=&status=
POST   /api/v1/vendors         { name, specialization[], contact_person, contact_email, contact_phone, status, rate_notes }
GET    /api/v1/vendors/:id                           -> detail incl. resourcesSupplied[], performanceStats
PATCH  /api/v1/vendors/:id
DELETE /api/v1/vendors/:id
GET    /api/v1/vendors/:id/candidates                -> candidates with source_vendor_id = :id
GET    /api/v1/vendors/:id/performance               -> { submissions, shortlisted, placed, ratio }
```
- `performanceStats`/`performance`: count of `job_candidate_matches` for the vendor's candidates grouped by stage (`submitted` = applied, `shortlisted` = screened, `placed` = placed); `ratio` = placed/submissions %, 0 if none.
- `resourcesSupplied` = candidates from this vendor + the job + current stage (join matches).
- `specialization` filter: array contains (jsonb `?` operator via drizzle `arrayContains`).

## Rules
- `requireAuth` on all. snake→camel column mapping per schema.
- Use `json`/`error` helpers. 404 `{ error: "not found" }` on missing id. 400 on invalid enum values.
- Serialize `numeric` columns as numbers (parse float/Number before returning).

## Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck && pnpm dev
# login first to get cookie; then:
curl -b c.txt 'localhost:3400/api/v1/clients?status=active'          # list w/ jobsCount
curl -b c.txt localhost:3400/api/v1/clients/c1                        # seeded client detail (jobs + notes)
curl -b c.txt localhost:3400/api/v1/vendors/v1/performance            # { submissions, shortlisted, placed, ratio }
```
Report: endpoints + curl evidence.
