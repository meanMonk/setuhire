# 01 — BE-AUTH (Wave 1, parallel)

Implements `src/routes/auth.ts` (stub already created by agent 00). Touch ONLY that file.

## Endpoints (PRD §4)
```
POST /api/v1/auth/register  { email, password, name }       -> 201 { user } (role defaults "recruiter")
POST /api/v1/auth/login     { email, password }             -> { user }  + Set-Cookie: token=<jwt>; HttpOnly; Path=/; SameSite=Lax
POST /api/v1/auth/logout    -> clears cookie
GET  /api/v1/auth/me        (requireAuth)                   -> { user }
```

## Rules
- Use helpers from `../lib/auth.js` (hashPassword, verifyPassword, signToken, requireAuth, getUserId) and `../lib/http.js`.
- `users` table from `../db/schema.js`; insert/select via `db` from `../db/client.js`.
- Login: verify password → sign JWT → `c.header("Set-Cookie", "token=…; HttpOnly; Path=/; SameSite=Lax")`.
- Register: reject duplicate email with 409 `{ error }`. Never return the password hash.
- `me`: return `{ id, email, name, role }`.
- All responses via `json()`/`error()` helpers; 400 for missing/invalid fields (zod optional — plain checks fine).

## Verify
```bash
cd packages/backend/setuhireapi && pnpm typecheck && pnpm dev
curl -X POST localhost:3400/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"ceo@setuhire.com","password":"Passw0rd!"}' -v   # 200 + Set-Cookie + user
curl -b cookies.txt localhost:3400/api/v1/auth/me               # 200 user
```
Report: endpoints + curl evidence + any notes.
