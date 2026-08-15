# 07 — WEB-FOUNDATION (Wave 2, parallel)

Foundation for the frontend. Works in `packages/web/setuhireweb/`. Files owned:
- `package.json` (add `react-router-dom`; keep React 18; no other heavy deps — plain CSS, no Tailwind)
- `vite.config.ts` (add dev proxy: `/api` → `http://localhost:3400`, so auth cookie is same-origin)
- `src/main.tsx`, `src/styles.css`, `src/App.tsx` (router)
- `src/api/client.ts`, `src/auth/AuthContext.tsx`, `src/components/Layout.tsx`, `src/components/ui.tsx`
- `src/pages/Login.tsx`, `src/pages/Dashboard.tsx`
- **CREATE stub page files** (others will fill): 
  - `src/pages/Clients/ListPage.tsx`, `Clients/DetailPage.tsx`
  - `src/pages/Vendors/ListPage.tsx`, `Vendors/DetailPage.tsx`
  - `src/pages/Jobs/ListPage.tsx`, `Jobs/DetailPage.tsx`, `Jobs/AddJobPage.tsx`
  - `src/pages/Candidates/ListPage.tsx`, `Candidates/DetailPage.tsx`, `Candidates/AddCandidatePage.tsx`
  - `src/pages/Interviews/ListPage.tsx`, `src/pages/Contracts/ListPage.tsx`, `src/pages/Finance/ListPage.tsx`
  - each: a default-export "Coming soon" component (so the router compiles). Agents 08/09/10 replace the bodies.
  - **also create typed API helpers** as empty shells: `src/api/clients.ts`, `src/api/vendors.ts`, `src/api/jobs.ts`, `src/api/candidates.ts`, `src/api/pipeline.ts` — each exporting typed request functions (unimplemented `throw new Error('TODO')`) so imports don't break.
- `src/App.tsx` router is **locked** (only you edit it). Routes:
  `/` → Dashboard (requireAuth), `/login` → Login, `/clients`, `/clients/:id`, `/vendors`, `/vendors/:id`, `/jobs`, `/jobs/:id`, `/jobs/new`, `/candidates`, `/candidates/:id`, `/candidates/new`, `/interviews`, `/contracts`, `/finance`.

## Build
- **`api/client.ts`**: `request<T>(path, opts)` — fetch `/api/v1${path}` with `credentials: "include"`, JSON body handling, throws on non-2xx with `error` message. Exports `get/post/patch/del`.
- **`auth/AuthContext.tsx`**: context holding `{ user, loading, login(email,pw), logout() }`. On mount calls `GET /api/v1/auth/me`; `login` calls `/auth/login`; `logout` calls `/auth/logout`. `requireAuth` wrapper redirects to `/login`.
- **`components/Layout.tsx`**: top nav (Dashboard, Clients, Vendors, Jobs, Candidates, Interviews, Contracts, Finance) + user/role + logout. Renders `<Outlet/>`.
- **`components/ui.tsx`**: tiny `Card`, `Badge`, `Table`, `Button`, `StatusPill` helpers (keep minimal, styled with CSS classes).
- **`pages/Login.tsx`**: email/password form → `login()` → redirect `/`.
- **`pages/Dashboard.tsx`** (PRD §3.2): fetch `/dashboard/summary` + `/attention-feed` + `/activity-log`. Render 6 clickable stat cards (link to respective page), "Needs Your Attention" feed list, recent activity log.
- **`styles.css`**: clean base styles (system-ui font, cards, table, badges). No framework.

## Verify
```bash
cd packages/web/setuhireweb && pnpm install && pnpm typecheck && pnpm dev
# open :3001 — login with ceo@setuhire.com / Passw0rd! -> Dashboard shows seeded stats + attention feed
# stub pages render "Coming soon" under each route without console errors.
```
Report: router map, components, evidence (screenshot/curl).
