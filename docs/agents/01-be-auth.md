# 01 — BE-AUTH (Wave 1, parallel)

**Owner files:** `src/routes/auth.ts` only  
**PO lens:** CEO/recruiter must log in once, stay in, and always know *who* is acting. Auth is the gate — not a feature screen.

---

## Product intent

| Need | Why |
|------|-----|
| Fast login | Owner opens app 20×/day between calls |
| Cookie session | No token paste; works with Vite proxy |
| `me` always fresh | Layout shows name + role; future role gates |
| Register | Seed/bootstrap only for MVP (role default `recruiter`) |

---

## Endpoints

```
POST /api/v1/auth/register  { email, password, name }  → 201 { user }
POST /api/v1/auth/login     { email, password }        → { user } + Set-Cookie
POST /api/v1/auth/logout    → clear cookie
GET  /api/v1/auth/me        (requireAuth)              → { user }
```

### Request / response fields

| Endpoint | Body / query | Response `user` shape |
|----------|--------------|------------------------|
| register | `email` (req), `password` (req, min 8), `name` (req) | `{ id, email, name, role }` — never `passwordHash` |
| login | `email`, `password` | same + cookie `token=<jwt>; HttpOnly; Path=/; SameSite=Lax` |
| me | — | `{ id, email, name, role }` role ∈ `admin\|recruiter\|ceo` |

### Rules
- Helpers: `../lib/auth.js` (`hashPassword`, `verifyPassword`, `signToken`, `requireAuth`, `getUserId`), `../lib/http.js`
- Duplicate email → `409 { error }`
- Missing/invalid → `400`
- Register role defaults `"recruiter"`

### Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck && pnpm dev
curl -X POST localhost:3400/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"ceo@setuhire.com","password":"Passw0rd!"}' -c c.txt -v
curl -b c.txt localhost:3400/api/v1/auth/me
```
Report: endpoints + curl evidence.
