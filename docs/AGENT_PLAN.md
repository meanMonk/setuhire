# SetuHire — Multi-Agent Implementation Plan

**Source of truth:** `docs/PRD.md` (spec, schema §6, API §4, scope §8).
**Seed data:** CSVs in `docs/` (users, clients, vendors, jobs, candidates, matches, interviews, contracts, finance).

> **Rule 0 — No code changes until the agent reads ITS OWN brief in `docs/agents/`.** Each agent owns a fixed set of files. Only touch files listed in your brief.

---

## 1. Current state (what exists)

| Area | Status |
|---|---|
| Backend `packages/backend/setuhireapi` | Hono scaffold only: `/health`, `/db/ping`, `/docs`. Deps: hono, zod-openapi, pg, mongodb. **No Drizzle, no schema, no routes, no auth, no MinIO.** |
| Web `packages/web/setuhireweb` | Bare Vite+React page showing API health. **No router, no API client, no pages.** |
| Infra `docker-compose.infra.yml` | Mongo + mongo-express + **MinIO** on `vaayu_db` network. **No Postgres.** |
| Docs | `docs/PRD.md` full spec + 10 CSVs (see `docs/agents/00` for column layout). |

## 2. Target architecture (simple, no over-engineering)

```
Web (React+Vite, :3001) --/api proxy--> Hono API (:3400)
                                        ├─ PostgreSQL (Drizzle ORM, app_setuhireapi)
                                        ├─ MinIO (resumes, contract PDFs — NOT /upload)
                                        └─ Anthropic (optional; deterministic fallback without key)
```

- **Auth:** JWT in httpOnly cookie. Web dev uses Vite proxy so cookies are same-origin.
- **Uploads:** resumes + contract docs go to **MinIO** bucket `setuhire`, never to a local `/upload` dir. Store the object key in `resume_url` / `document_url`; return presigned GET URLs for view/download.
- **DB:** local Postgres. Add a `postgres` service to `docker-compose.infra.yml`.
- **AI:** lives in a single `services/ai.ts`. Foundation ships a deterministic-fallback stub so all endpoints are demoable **without an LLM key**; agent BE-AI upgrades it with Anthropic later. Parsing/match endpoints never block on a missing key.
- **Docs/OpenAPI:** keep the existing `/docs` + `/openapi.json` scaffold. Entity routes are plain Hono (fast to build); do NOT hand-write OpenAPI specs for every endpoint.

## 3. Waves & dependency DAG

```
WAVE 0 (sequential — finish first, everything depends on it)
  00 BE-FOUNDATION   schema+db+seed+minio+auth middleware+app.ts stubs+postgres infra
        │
WAVE 1 (parallel — all 6 depend ONLY on wave 0)
  ├─ 01 BE-AUTH            /auth/register|login|logout|me
  ├─ 02 BE-CLIENTS-VENDORS clients + notes, vendors + performance
  ├─ 03 BE-JOBS            jobs + vendor assignments + fetch/parse (calls services/ai)
  ├─ 04 BE-CANDIDATES      candidates + matches + resume upload -> MinIO
  ├─ 05 BE-PIPELINE        interviews + contracts + finance + dashboard
  └─ 06 BE-AI-SERVICE      services/ai.ts real impl (Anthropic + scoring + rationale)
        │
WAVE 2 (parallel — depend on API contract, can start after wave 0 + short smoke test)
  ├─ 07 WEB-FOUNDATION     router, layout, api client, auth ctx, Login, Dashboard
  ├─ 08 WEB-CLIENTS-VENDORS Clients + Vendors pages
  ├─ 09 WEB-JOBS-CANDIDATES Jobs + Candidates pages (add-job flow, resume upload UI)
  └─ 10 WEB-PIPELINE-FINANCE Interviews + Contracts + Finance pages
```

**Minimum parallel run:** Wave 0 alone → then fire any/all of wave 1 in parallel → then wave 2 in parallel. You can run 1 agent or all 10 — they're independent once wave 0 is done.

## 4. File ownership contract (prevents merge conflicts)

> Agents work on the **same working tree** with **disjoint files**. If a file isn't in your brief, don't touch it.

### Backend — `packages/backend/setuhireapi/`
| Owner | Files (owns/edits) |
|---|---|
| 00 Foundation | `src/db/schema.ts`, `src/db/client.ts`, `src/db/seed.ts`, `src/db/migrate.ts`, `drizzle.config.ts`, `src/lib/minio.ts`, `src/lib/auth.ts`, `src/lib/http.ts` (error/json helpers), `src/app.ts`, `src/index.ts`, `package.json`, `tsconfig.json`, `.env`, `docker-compose.infra.yml` (repo root, add postgres), `docs/AGENT_PLAN.md`(updates only) |
| 00 Foundation also CREATES **empty stub route files** | `src/routes/auth.ts`, `clients.ts`, `vendors.ts`, `jobs.ts`, `candidates.ts`, `matches.ts`, `interviews.ts`, `contracts.ts`, `finance.ts`, `dashboard.ts` — each `export const xRoutes = new Hono()` — plus a stub `src/services/ai.ts` |
| 01 BE-Auth | `src/routes/auth.ts` only |
| 02 BE-Clients-Vendors | `src/routes/clients.ts`, `src/routes/vendors.ts`, `src/services/clients.ts`, `src/services/vendors.ts` |
| 03 BE-Jobs | `src/routes/jobs.ts`, `src/services/jobs.ts` |
| 04 BE-Candidates | `src/routes/candidates.ts`, `src/routes/matches.ts`, `src/services/candidates.ts` |
| 05 BE-Pipeline | `src/routes/interviews.ts`, `contracts.ts`, `finance.ts`, `dashboard.ts`, `src/services/pipeline.ts` |
| 06 BE-AI-Service | `src/services/ai.ts` only |
| `src/app.ts` mounts every route module | **Locked — only foundation may edit.** All route files already imported+registered. |

### Web — `packages/web/setuhireweb/`
| Owner | Files (owns/edits) |
|---|---|
| 07 Web Foundation | `src/main.tsx`, `src/App.tsx` (router), `src/api/client.ts`, `src/auth/AuthContext.tsx`, `src/components/Layout.tsx`, `src/components/ui.tsx`, `src/pages/Login.tsx`, `src/pages/Dashboard.tsx`, `src/styles.css`, `package.json`, `vite.config.ts` |
| 07 also CREATES stub page files | `src/pages/Clients/ListPage.tsx`, `Clients/DetailPage.tsx`, `Vendors/ListPage.tsx`, `Vendors/DetailPage.tsx`, `Jobs/ListPage.tsx`, `Jobs/DetailPage.tsx`, `Jobs/AddJobPage.tsx`, `Candidates/ListPage.tsx`, `Candidates/DetailPage.tsx`, `Candidates/AddCandidatePage.tsx`, `Interviews/ListPage.tsx`, `Contracts/ListPage.tsx`, `Finance/ListPage.tsx` — each a "coming soon" placeholder, plus `src/api/clients.ts`, `src/api/vendors.ts`, `src/api/jobs.ts`, `src/api/candidates.ts`, `src/api/pipeline.ts` (empty typed helpers) |
| 08 Web Clients-Vendors | `src/pages/Clients/*`, `src/pages/Vendors/*`, `src/api/clients.ts`, `src/api/vendors.ts` |
| 09 Web Jobs-Candidates | `src/pages/Jobs/*`, `src/pages/Candidates/*`, `src/api/jobs.ts`, `src/api/candidates.ts` |
| 10 Web Pipeline-Finance | `src/pages/Interviews/*`, `src/pages/Contracts/*`, `src/pages/Finance/*`, `src/api/pipeline.ts` |
| Router in `App.tsx` | **Locked — only web foundation may edit** (it imports all page stubs, agents fill bodies) |

## 5. Conventions (all agents)

1. **Read your brief first** (`docs/agents/NN-*.md`) — it has exact endpoints, schemas, verify steps.
2. API contract = PRD §4. Schemas = PRD §6. Match Drizzle column names exactly (camelCase in code, snake_case in DB).
3. `typecheck`: `pnpm typecheck` in the package before finishing. Fix all errors.
4. Code style: match existing files; import paths use `.js` suffix in the backend (ESM), like `../lib/auth.js`.
5. Auth: every route except `/auth/*` uses the `requireAuth` middleware from `lib/auth.ts` (JWT in httpOnly cookie).
6. Uploads → MinIO only (helper `lib/minio.ts`). Never write files to disk.
7. AI: never import Anthropic directly in route files — always through `services/ai.ts`.
8. No mock/placeholder data in code. Real seed data comes from CSVs via the seed script.
9. Errors: return `{ error: string }` with sensible HTTP status (400/401/404/409/500). Keep it simple.
10. Do not modify `docs/PRD.md`. If you find a spec conflict, note it in your brief's "open questions" and continue.

## 6. Local environment (run before wave 0)

```bash
# 1. Infra: Postgres (added by agent 00) + MinIO + Mongo
docker compose -f docker-compose.infra.yml up -d

# 2. Backend .env (agent 00 sets this) — local dev targets 127.0.0.1
PG_URI=postgres://setuhire:setuhire@127.0.0.1:5432/app_setuhireapi
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_ACCESS_KEY=setuhire
MINIO_SECRET_KEY=setuhire-secret
MINIO_BUCKET=setuhire
JWT_SECRET=dev-secret-change-me
ANTHROPIC_API_KEY=      # optional — deterministic fallback if empty

# 3. Backend dev (from packages/backend/setuhireapi)
pnpm install && pnpm db:push && pnpm db:seed && pnpm dev   # :3400

# 4. Web dev (from packages/web/setuhireweb)
pnpm install && pnpm dev    # :3001, /api proxied to :3400
```

## 7. How to run multiple agents at the same time

**Option A — separate opencode sessions (recommended, simplest):** one terminal per agent.

```bash
# terminal 1
opencode docs/agents/02-be-clients-vendors.md
# terminal 2
opencode docs/agents/03-be-jobs.md
# terminal 3 ... up to N (only run wave-1 agents AFTER wave-0 is committed)
```

**Option B — `opencode run` (headless, scriptable):**
```bash
opencode run "Implement docs/agents/03-be-jobs.md fully, then run pnpm typecheck and report"
```

**Option C — opencode subagents (in-session `task` tool):** spawn a `general` agent per brief with the prompt `"Read docs/agents/NN-*.md and implement it fully; run typecheck; report files changed + verify output."` Run several in parallel — they operate on the same tree but disjoint files.

**Sequencing rules for safety:**
1. **Wave 0 must finish and commit first.** Everything imports its files.
2. Wave-1 backend agents can all start at once. `services/ai.ts` stub already exists so jobs/candidates agents don't block on BE-AI.
3. Wave-2 web agents can start after wave 0 + a quick smoke test of auth + one CRUD route (they build against the documented contract; real integration happens at the end).
4. Git: each agent commits only its owned files (`git add <owned paths>`), working on `main` is fine since file sets are disjoint. Coordinator reviews each merge.

## 8. Definition of done (whole project)

- [ ] `docker compose -f docker-compose.infra.yml up -d` brings up Postgres + MinIO.
- [ ] `pnpm db:push && pnpm db:seed` → all 10 CSV tables populated (counts logged).
- [ ] Login → JWT cookie → all CRUD pages render with seeded data.
- [ ] Resume upload stores in MinIO (visible in MinIO console :9001), not on disk.
- [ ] Add-Job via URL + paste text → structured preview; Run AI Match returns ranked candidates (fallback scores OK without a key).
- [ ] Interviews / Contracts / Finance pages + dashboard cards + attention feed work.
- [ ] `pnpm typecheck` passes in both packages.
