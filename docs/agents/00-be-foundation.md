# 00 — BE-FOUNDATION (Wave 0 — run FIRST, alone)

You are the foundation agent. Everything else imports your files. Work ONLY in:
- `packages/backend/setuhireapi/` (files listed below)
- `docker-compose.infra.yml` (repo root — add postgres)
- `docs/AGENT_PLAN.md` (you may update "open questions")

Do NOT implement entity routes — create empty stubs for others to fill.

## 1. Infra — add Postgres to `docker-compose.infra.yml`
Add a `postgres` service to the existing file (keep mongo/minio as-is):
- image `postgres:16-alpine`, container_name `vaayu-postgres`, restart unless-stopped
- env `POSTGRES_USER=setuhire`, `POSTGRES_PASSWORD=setuhire`, `POSTGRES_DB=app_setuhireapi`
- volume `postgres_data:/var/lib/postgresql/data`, network `vaayu_db`
- ports `127.0.0.1:5432:5432`
- add `postgres_data` to the `volumes:` block
MinIO is already there — leave it.

## 2. Schema — `src/db/schema.ts`
Transcribe PRD §6 exactly (all enums, 10 tables + client_notes + job_vendor_assignments). Additions:
- `users.role`: keep `"admin" | "recruiter" | "ceo"` (default "recruiter").
- `vendors.specialization`, `jobs.techStack`, `candidates.skills`, `parsedRequirements`, `parsedProfile`: `jsonb $type<string[]>` / `$type<object>` as in PRD.
- `candidates.resumeUrl` + `contracts.documentUrl` = `text` (store MinIO object key, not full URL).
- Keep `uuid` PKs with `defaultRandom()`.

## 3. DB client + migrate — `src/db/client.ts`, `src/db/migrate.ts`, `drizzle.config.ts`
- `client.ts`: export `db` (drizzle(postgres Pool) from `drizzle-orm/node-postgres`) + a `pool`. Connection string from `PG_URI` (drizzle) — fall back to `postgres://setuhire:setuhire@127.0.0.1:5432/app_setuhireapi`.
- `migrate.ts`: programmatic migrate + create schema. Add deps: `drizzle-orm`, `drizzle-kit`, `@types/pg` already present.
- package.json scripts: `"db:push": "drizzle-kit push"`, `"db:migrate": "tsx src/db/migrate.ts"`, `"db:seed": "tsx src/db/seed.ts"`, `"db:reset": "tsx src/db/reset.ts"` (drop + push + seed).
- `reset.ts`: drops all tables, runs migrate/push, then seed. This is the standard dev command.

## 4. Seed — `src/db/seed.ts`
Read CSVs from repo root `docs/*.csv` (10 files) in FK order:
`users → clients → vendors → jobs → job_vendor_assignments → candidates → job_candidate_matches → interviews → contracts → finance_records`.
- Parse with `papaparse` (add dep) or built-in CSV parsing.
- **CSV ids are strings (`c1`, `cand1`, `m1`…). Schema ids are `uuid`. Map each to a deterministic UUID** so FKs stay consistent, e.g. `uuidv5(NAMESPACE, id)` using `node:crypto`'s `createHash` or the `uuid` package. Log the mapping in-memory.
- `users.csv` has `password_plaintext_for_seed_only` — hash with `bcryptjs` (add dep) before insert; do not store plaintext.
- Column names in CSVs are snake_case; map to Drizzle column names (camelCase). Missing CSV columns (e.g. `parsed_requirements`, `parsed_profile`, `raw_jd_text`) → leave null.
- Wrap inserts in a transaction. Log row counts per table. Script must be re-runnable (reset first).

## 5. MinIO helper — `src/lib/minio.ts`
- Client from `minio` npm package. Env: `MINIO_ENDPOINT` (default `127.0.0.1`), `MINIO_PORT` (9000), `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` (default `setuhire`), `MINIO_USE_SSL` (false local).
- Exports: `ensureBucket()` (create bucket if missing), `putObject(key, buffer, contentType)`, `getPresignedUrl(key, expires=3600)`.
- **Never write uploads to disk. MinIO only.**

## 6. Auth helpers — `src/lib/auth.ts`
- `hashPassword` / `verifyPassword` via `bcryptjs`.
- `signToken(userId)` → JWT (`jsonwebtoken`, add dep), secret `JWT_SECRET`.
- `requireAuth` Hono middleware: read JWT from httpOnly cookie `token`; attach `c.set("userId", …)`; 401 otherwise. (Cookie set by the auth route agent.)
- `getUserId(c)` helper.

## 7. HTTP helpers — `src/lib/http.ts`
- `json(c, data, status=200)`, `error(c, status, message)` → `{ error: message }`.

## 8. App wiring — `src/app.ts`, `src/index.ts`
- `app.ts`: build the Hono app: `app.use("*", logger())`, CORS (allow `http://localhost:3001`, `credentials: true`), mount `/health`, `/db`, `/api/v1/auth` → `authRoutes`, `/api/v1/clients` → `clientsRoutes`, `/api/v1/vendors`, `/api/v1/jobs`, `/api/v1/candidates`, `/api/v1/matches`, `/api/v1/interviews`, `/api/v1/contracts`, `/api/v1/finance`, `/api/v1/dashboard` (all from stubs), plus existing `setupDocs(app)`.
- **Create empty stub route modules** (others will fill them): `src/routes/{auth,clients,vendors,jobs,candidates,matches,interviews,contracts,finance,dashboard}.ts`, each `export const xxxRoutes = new Hono()`.
- **Create `src/services/ai.ts` stub**: export typed signatures + deterministic fallbacks (no LLM):
  - `parseJobFromUrl(url)` → basic shape from PRD §5
  - `parseJobFromText(rawText)` → same
  - `parseResume(buffer, filename)` → profile shape
  - `runMatch(job, candidates)` → ranked list with score 0-100 + short rationale (rule-based, e.g. skill-overlap count). Match the exact function signatures here so agents 03/04/06 code against them.
- `index.ts`: serve `app` on PORT 3400 (keep existing logger line). Keep `/health` + `/db/ping` working.

## 9. package.json additions
`drizzle-orm`, `drizzle-kit`, `minio`, `bcryptjs`, `jsonwebtoken`, `papaparse` (or built-in), `uuid`; dev `@types/jsonwebtoken`, `@types/papaparse`, `@types/bcryptjs`. Add scripts from step 3.

## 10. `.env`
Update `PG_URI` to `postgres://setuhire:setuhire@127.0.0.1:5432/app_setuhireapi`, add `JWT_SECRET`, `MINIO_*`, `ANTHROPIC_API_KEY=` (empty ok). Keep `DB_TYPE=postgres`.

## Verify
```bash
cd packages/backend/setuhireapi
pnpm install
docker compose -f ../../..//docker-compose.infra.yml up -d   # from repo root actually
# from repo root: docker compose -f docker-compose.infra.yml up -d
pnpm db:push && pnpm db:seed
pnpm typecheck
pnpm dev    # curl localhost:3400/health -> ok; /db/ping -> postgres ok; /api/v1/clients -> [] (stub)
```
Confirm all 10 tables have seeded rows (`psql` or `SELECT count(*)`). Confirm MinIO bucket `setuhire` exists (console :9001).
Report: files created, db counts, any PRD conflicts in your "open questions" section.
