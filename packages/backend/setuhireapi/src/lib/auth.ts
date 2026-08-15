import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { error } from "./http.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "string") return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const token = getCookie(c, "token");
  const userId = token ? verifyToken(token) : null;
  if (!userId) return error(c, 401, "Not authenticated");
  c.set("userId", userId);
  await next();
});

export function getUserId(c: { get: (key: string) => unknown }): string | undefined {
  const id = c.get("userId");
  return typeof id === "string" ? id : undefined;
}
