import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import {
  candidates,
  clientNotes,
  clients,
  jobCandidateMatches,
  jobs,
  jobVendorAssignments,
  users,
  vendors,
} from "../db/schema.js";
import { getUserId, requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";
import { toDate } from "../services/pipeline.js";

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

type ClientAggregate = {
  jobsCount: number;
  activeJobsCount: number;
  lastEngagementAt: Date | null;
};

async function clientAggregates(ids: string[]): Promise<Map<string, ClientAggregate>> {
  const map = new Map<string, ClientAggregate>();
  for (const id of ids) {
    map.set(id, { jobsCount: 0, activeJobsCount: 0, lastEngagementAt: null });
  }
  if (ids.length === 0) return map;

  const jobRows = await db
    .select({ clientId: jobs.clientId, status: jobs.status, createdAt: jobs.createdAt })
    .from(jobs)
    .where(inArray(jobs.clientId, ids));

  const noteRows = await db
    .select({ clientId: clientNotes.clientId, createdAt: clientNotes.createdAt })
    .from(clientNotes);

  for (const j of jobRows) {
    const e = map.get(j.clientId);
    if (!e) continue;
    e.jobsCount += 1;
    if (j.status === "open") e.activeJobsCount += 1;
    if (j.createdAt && (!e.lastEngagementAt || j.createdAt > e.lastEngagementAt)) {
      e.lastEngagementAt = j.createdAt;
    }
  }
  for (const n of noteRows) {
    if (!n.clientId) continue;
    const e = map.get(n.clientId);
    if (!e) continue;
    if (n.createdAt && (!e.lastEngagementAt || n.createdAt > e.lastEngagementAt)) {
      e.lastEngagementAt = n.createdAt;
    }
  }
  return map;
}

clientsRoutes.get("/", async (c) => {
  const statusParam = c.req.query("status");
  const industry = c.req.query("industry");
  const q = c.req.query("q");

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
        q ? ilike(clients.name, `%${q}%`) : undefined,
      ),
    )
    .orderBy(asc(clients.name));

  const aggs = await clientAggregates(rows.map((r) => r.id));

  return json(
    c,
    rows.map((r) => {
      const a = aggs.get(r.id);
      return {
        ...r,
        jobsCount: a?.jobsCount ?? 0,
        activeJobsCount: a?.activeJobsCount ?? 0,
        lastEngagementAt: a?.lastEngagementAt ?? null,
      };
    }),
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
      engagementStartDate: toDate(body?.engagement_start_date),
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
  const jobIds = clientJobs.map((j) => j.id);

  const aggs = await clientAggregates([id]);
  const agg = aggs.get(id)!;

  const matchRows = jobIds.length
    ? await db
        .select({ match: jobCandidateMatches, candidate: candidates, job: jobs })
        .from(jobCandidateMatches)
        .innerJoin(candidates, eq(candidates.id, jobCandidateMatches.candidateId))
        .innerJoin(jobs, eq(jobs.id, jobCandidateMatches.jobId))
        .where(inArray(jobCandidateMatches.jobId, jobIds))
    : [];

  const assignRows = jobIds.length
    ? await db
        .select({ a: jobVendorAssignments, vendor: vendors })
        .from(jobVendorAssignments)
        .innerJoin(vendors, eq(vendors.id, jobVendorAssignments.vendorId))
        .where(inArray(jobVendorAssignments.jobId, jobIds))
        .orderBy(jobVendorAssignments.assignedAt)
    : [];

  const jobsOut = clientJobs.map((j) => {
    const matches = matchRows.filter((r) => r.match.jobId === j.id);
    const nonRejected = matches.filter((r) => r.match.stage !== "rejected");
    const topMatchScore = matches.reduce<number | null>((best, r) => {
      const s = toNum(r.match.matchScore);
      return s !== null && (best === null || s > best) ? s : best;
    }, null);
    const assigns = assignRows.filter((r) => r.a.jobId === j.id);
    const sourcingCost = toNum(assigns[0]?.a.sourcingCost ?? null);
    const tsc = toNum(j.targetSellingCost);
    return {
      ...serializeJob(j),
      pipelineCount: nonRejected.length,
      topMatchScore,
      sourcingCost,
      margin:
        sourcingCost !== null && tsc !== null ? Number((tsc - sourcingCost).toFixed(2)) : null,
      assignedVendors: assigns.map((r) => ({
        vendorId: r.vendor.id,
        vendorName: r.vendor.name,
        sourcingCost: toNum(r.a.sourcingCost),
        assignedAt: r.a.assignedAt,
      })),
    };
  });

  const resourcesHired = matchRows
    .filter((r) => r.match.stage === "placed")
    .map((r) => ({
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
      placedAt: r.match.createdAt,
    }));

  const profilesSent = matchRows
    .filter((r) => r.match.stage !== "rejected")
    .map((r) => ({
      matchId: r.match.id,
      candidateId: r.candidate.id,
      candidateName: r.candidate.name,
      jobId: r.job.id,
      jobTitle: r.job.title,
      stage: r.match.stage,
      matchScore: toNum(r.match.matchScore),
      createdAt: r.match.createdAt,
    }));

  const noteRows = await db
    .select({
      id: clientNotes.id,
      note: clientNotes.note,
      createdAt: clientNotes.createdAt,
      createdById: users.id,
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
    createdBy: n.createdById ? { id: n.createdById, name: n.createdByName ?? null } : null,
  }));

  return json(c, {
    ...client,
    jobsCount: agg.jobsCount,
    activeJobsCount: agg.activeJobsCount,
    lastEngagementAt: agg.lastEngagementAt,
    jobs: jobsOut,
    resourcesHired,
    profilesSent,
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
  if (body?.engagement_start_date !== undefined) {
    update.engagementStartDate = toDate(body.engagement_start_date);
  }
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
