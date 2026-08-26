export type Role = "ceo" | "admin" | "recruiter";

/**
 * Demo RBAC matrix: which roles can access which route prefix.
 * Unlisted routes are accessible to everyone.
 */
const ROUTE_ACCESS: { path: string; roles: Role[] }[] = [
  { path: "/vendors", roles: ["ceo", "admin"] },
  { path: "/contracts", roles: ["ceo", "admin"] },
  { path: "/finance", roles: ["ceo", "admin"] },
];

export function canAccess(role: string | undefined, pathname: string): boolean {
  const entry = ROUTE_ACCESS.find((r) =>
    r.path === "/" ? pathname === "/" : pathname === r.path || pathname.startsWith(`${r.path}/`),
  );
  if (!entry) return true;
  return entry.roles.includes(role as Role);
}
