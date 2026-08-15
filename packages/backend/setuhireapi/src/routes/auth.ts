import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import {
  getUserId,
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
} from "../lib/auth.js";
import { error, json } from "../lib/http.js";

export const authRoutes = new Hono();

const COOKIE_NAME = "token";
const COOKIE_OPTS = "HttpOnly; Path=/; SameSite=Lax";

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

const toPublic = (u: typeof users.$inferSelect): PublicUser => ({
  id: u.id as string,
  email: u.email,
  name: u.name,
  role: u.role ?? "recruiter",
});

authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!email || !password || !name) {
    return error(c, 400, "email, password and name are required");
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return error(c, 409, "email already registered");
  }

  const [created] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password), name, role: "recruiter" })
    .returning();

  return json(c, { user: toPublic(created!) }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return error(c, 400, "email and password are required");
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return error(c, 401, "invalid credentials");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return error(c, 401, "invalid credentials");
  }

  const token = signToken(user.id);
  c.header("Set-Cookie", `${COOKIE_NAME}=${token}; ${COOKIE_OPTS}`);
  return json(c, { user: toPublic(user) });
});

authRoutes.post("/logout", (c) => {
  c.header("Set-Cookie", `${COOKIE_NAME}=; ${COOKIE_OPTS}; Max-Age=0`);
  return json(c, { ok: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const userId = getUserId(c);
  if (!userId) return error(c, 401, "Not authenticated");

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return error(c, 404, "user not found");

  return json(c, { user: toPublic(user) });
});
