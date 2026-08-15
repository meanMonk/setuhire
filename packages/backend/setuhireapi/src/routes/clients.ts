import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import {
  candidates,
  clientNotes,
  clients,
  jobCandidateMatches,
  jobs,
  users,
} from "../db/schema.js";
import { getUserId, requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";

export const clientsRoutes = new Hono();

clientsRoutes.use("*", requireAuth);

const CLIENT_STATUSES = ["active", "on_hold", "lost"] as const;
type ClientStatus = (typeof CLIENT_STATUSES)[number];

const isClientStatus = (v: unknown): v is ClientStatus =>
  typeof v === "string" && (CLIENT_STATUSES as readonly string[]).includes(v);

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const serializeJob = (j: typeof jobs.$inferSelect) => ({
  ...j,
  targetSellingCost: toNum(j.targetSellingCost),
});

clientsRoutes.get("/", async (c) => {
  const statusParam = c.req.query("status");
  const industry = c.req.query("industry");

  let statusFilter: ClientStatus | undefined;
  if (statusParam !== undefined) {
    if (!isClientStatus(statusParam)) return error(c, 400, "invalid status");
    statusFilter = statusParam;
  }

  const rows = await db
    .select()
    .from(clients)
    .where(
      and(
        statusFilter ? eq(clients.status, statusFilter) : undefined,
        industry ? ilike(clients.industry, `%${industry}%`) : undefined,
      ),
    )
    .orderBy(asc(clients.name));

  const jobRows = await db
    .select({ clientId: jobs.clientId, status: jobs.status })
    .from(jobs);

  const total = new Map<string, number>();
  const active = new Map<string, number>();
  for (const j of jobRows) {
    total.set(j.clientId, (total.get(j.clientId) ?? 0) + 1);
    if (j.status === "open") active.set(j.clientId, (active.get(j.clientId) ?? 0) + 1);
  }

  return json(
    c,
    rows.map((r) => ({
      ...r,
      jobsCount: total.get(r.id) ?? 0,
      activeJobsCount: active.get(r.id) ?? 0,
    })),
  );
});

clientsRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return error(c, 400, "name is required");

  const status = body?.status ?? "active";
  if (!isClientStatus(status)) return error(c, 400, "invalid status");

  const [created] = await db
    .insert(clients)
    .values({
      name,
      industry: typeof body?.industry === "string" ? body.industry : null,
      contactPerson: typeof body?.contact_person === "string" ? body.contact_person : null,
      contactEmail: typeof body?.contact_email === "string" ? body.contact_email : null,
      contactPhone: typeof body?.contact_phone === "string" ? body.contact_phone : null,
      status,
    })
    .returning();

  return json(c, created!, 201);
});

clientsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) return error(c, 404, "not found");

  const clientJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.clientId, id))
    .orderBy(desc(jobs.createdAt));

  const placed = await db
    .select({
      match: jobCandidateMatches,
      candidate: candidates,
      job: jobs,
    })
    .from(jobCandidateMatches)
    .innerJoin(candidates, eq(candidates.id, jobCandidateMatches.candidateId))
    .innerJoin(jobs, eq(jobs.id, jobCandidateMatches.jobId))
    .where(and(eq(jobs.clientId, id), eq(jobCandidateMatches.stage, "placed")));

  const resourcesHired = placed.map((r) => ({
    matchId: r.match.id,
    matchScore: toNum(r.match.matchScore),
    stage: r.match.stage,
    candidateId: r.candidate.id,
    candidateName: r.candidate.name,
    candidateEmail: r.candidate.email,
    skills: r.candidate.skills,
    experienceYears: toNum(r.candidate.experienceYears),
    rateExpectation: toNum(r.candidate.rateExpectation),
    jobId: r.job.id,
    jobTitle: r.job.title,
    employmentType: r.job.employmentType,
  }));

  const noteRows = await db
    .select({
      id: clientNotes.id,
      note: clientNotes.note,
      createdAt: clientNotes.createdAt,
      createdByName: users.name,
    })
    .from(clientNotes)
    .leftJoin(users, eq(users.id, clientNotes.createdBy))
    .where(eq(clientNotes.clientId, id))
    .orderBy(desc(clientNotes.createdAt));

  const engagementHistory = noteRows.map((n) => ({
    id: n.id,
    note: n.note,
    createdAt: n.createdAt,
    createdByName: n.createdByName ?? null,
  }));

  return json(c, {
    ...client,
    jobs: clientJobs.map(serializeJob),
    resourcesHired,
    engagementHistory,
  });
});

clientsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!existing) return error(c, 404, "not found");

  const body = await c.req.json().catch(() => null);
  const update: Partial<typeof clients.$inferInsert> = {};

  if (typeof body?.name === "string") update.name = body.name.trim();
  if (typeof body?.industry === "string") update.industry = body.industry;
  if (typeof body?.contact_person === "string") update.contactPerson = body.contact_person;
  if (typeof body?.contact_email === "string") update.contactEmail = body.contact_email;
  if (typeof body?.contact_phone === "string") update.contactPhone = body.contact_phone;
  if (body?.status !== undefined) {
    if (!isClientStatus(body.status)) return error(c, 400, "invalid status");
    update.status = body.status;
  }

  const [updated] = await db
    .update(clients)
    .set(update)
    .where(eq(clients.id, id))
    .returning();

  return json(c, updated!);
});

clientsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!existing) return error(c, 404, "not found");

  await db.delete(clients).where(eq(clients.id, id));
  return json(c, { ok: true });
});

clientsRoutes.get("/:id/jobs", async (c) => {
  const id = c.req.param("id");
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) return error(c, 404, "not found");

  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.clientId, id))
    .orderBy(desc(jobs.createdAt));

  return json(c, rows.map(serializeJob));
});

clientsRoutes.post("/:id/notes", async (c) => {
  const id = c.req.param("id");
  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) return error(c, 404, "not found");

  const body = await c.req.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!note) return error(c, 400, "note is required");

  const userId = getUserId(c);
  const [created] = await db
    .insert(clientNotes)
    .values({ clientId: id, note, createdBy: userId ?? null })
    .returning();

  return json(c, created!, 201);
});
