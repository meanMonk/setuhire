import { and, arrayContains, asc, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import {
  candidates,
  clients,
  jobCandidateMatches,
  jobs,
  jobVendorAssignments,
  vendors,
} from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";

export const vendorsRoutes = new Hono();

vendorsRoutes.use("*", requireAuth);

const VENDOR_STATUSES = ["active", "preferred", "blacklisted"] as const;
type VendorStatus = (typeof VENDOR_STATUSES)[number];

const isVendorStatus = (v: unknown): v is VendorStatus =>
  typeof v === "string" && (VENDOR_STATUSES as readonly string[]).includes(v);

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const serializeCandidate = (cand: typeof candidates.$inferSelect) => ({
  ...cand,
  experienceYears: toNum(cand.experienceYears),
  rateExpectation: toNum(cand.rateExpectation),
});

const SHORTLISTED_STAGES = ["screened", "interview", "offer", "placed"];
const ACTIVE_SUBMISSION_STAGES = ["applied", "screened", "interview", "offer"];

const computePerformance = (stages: string[]) => {
  const submissions = stages.length;
  const shortlisted = stages.filter((s) => SHORTLISTED_STAGES.includes(s)).length;
  const placed = stages.filter((s) => s === "placed").length;
  const ratio = submissions === 0 ? 0 : Number(((placed / submissions) * 100).toFixed(2));
  return { submissions, shortlisted, placed, ratio };
};

async function vendorMatchRows(): Promise<
  { matchVendor: string | null; candVendor: string | null; stage: string | null }[]
> {
  return db
    .select({
      matchVendor: jobCandidateMatches.sourceVendorId,
      candVendor: candidates.sourceVendorId,
      stage: jobCandidateMatches.stage,
    })
    .from(jobCandidateMatches)
    .innerJoin(candidates, eq(candidates.id, jobCandidateMatches.candidateId));
}

async function vendorStages(vendorId: string): Promise<string[]> {
  const rows = await vendorMatchRows();
  return rows
    .filter((r) => (r.matchVendor ?? r.candVendor) === vendorId)
    .map((r) => r.stage ?? "");
}

type VendorAggregate = { activeSubmissions: number; placedCount: number };

async function vendorAggregates(ids: string[]): Promise<Map<string, VendorAggregate>> {
  const map = new Map<string, VendorAggregate>();
  for (const id of ids) map.set(id, { activeSubmissions: 0, placedCount: 0 });
  if (ids.length === 0) return map;

  const rows = await vendorMatchRows();
  for (const r of rows) {
    const vid = r.matchVendor ?? r.candVendor;
    if (!vid || !map.has(vid)) continue;
    const e = map.get(vid)!;
    if (r.stage === "placed") e.placedCount += 1;
    if (r.stage && ACTIVE_SUBMISSION_STAGES.includes(r.stage)) e.activeSubmissions += 1;
  }
  return map;
}

vendorsRoutes.get("/", async (c) => {
  const specialization = c.req.query("specialization");
  const statusParam = c.req.query("status");
  const q = c.req.query("q");

  let statusFilter: VendorStatus | undefined;
  if (statusParam !== undefined) {
    if (!isVendorStatus(statusParam)) return error(c, 400, "invalid status");
    statusFilter = statusParam;
  }

  const rows = await db
    .select()
    .from(vendors)
    .where(
      and(
        specialization ? arrayContains(vendors.specialization, [specialization]) : undefined,
        statusFilter ? eq(vendors.status, statusFilter) : undefined,
        q ? ilike(vendors.name, `%${q}%`) : undefined,
      ),
    )
    .orderBy(asc(vendors.name));

  const aggs = await vendorAggregates(rows.map((r) => r.id));

  return json(
    c,
    rows.map((r) => {
      const a = aggs.get(r.id);
      return {
        ...r,
        activeSubmissions: a?.activeSubmissions ?? 0,
        placedCount: a?.placedCount ?? 0,
        rateNotesPreview: r.rateNotes ? r.rateNotes.slice(0, 80) : null,
      };
    }),
  );
});

vendorsRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return error(c, 400, "name is required");

  const status = body?.status ?? "active";
  if (!isVendorStatus(status)) return error(c, 400, "invalid status");

  const specialization = Array.isArray(body?.specialization)
    ? body.specialization.filter((s: unknown): s is string => typeof s === "string")
    : [];

  const [created] = await db
    .insert(vendors)
    .values({
      name,
      specialization,
      contactPerson: typeof body?.contact_person === "string" ? body.contact_person : null,
      contactEmail: typeof body?.contact_email === "string" ? body.contact_email : null,
      contactPhone: typeof body?.contact_phone === "string" ? body.contact_phone : null,
      status,
      rateNotes: typeof body?.rate_notes === "string" ? body.rate_notes : null,
    })
    .returning();

  return json(c, created!, 201);
});

vendorsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!vendor) return error(c, 404, "not found");

  const supplied = await db
    .select({ candidate: candidates, match: jobCandidateMatches, job: jobs, client: clients })
    .from(candidates)
    .innerJoin(jobCandidateMatches, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobs.id, jobCandidateMatches.jobId))
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .where(eq(candidates.sourceVendorId, id));

  const resourcesSupplied = supplied.map((r) => ({
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
    clientName: r.client.name,
    suppliedAt: r.match.createdAt,
  }));

  const assigned = await db
    .select({
      jobId: jobs.id,
      jobTitle: jobs.title,
      clientName: clients.name,
      sourcingCost: jobVendorAssignments.sourcingCost,
      assignedAt: jobVendorAssignments.assignedAt,
      jobStatus: jobs.status,
    })
    .from(jobVendorAssignments)
    .innerJoin(jobs, eq(jobs.id, jobVendorAssignments.jobId))
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .where(eq(jobVendorAssignments.vendorId, id));

  const assignedJobs = assigned.map((a) => ({
    jobId: a.jobId,
    jobTitle: a.jobTitle,
    clientName: a.clientName,
    sourcingCost: toNum(a.sourcingCost),
    assignedAt: a.assignedAt,
    jobStatus: a.jobStatus,
  }));

  const performanceStats = computePerformance(await vendorStages(id));

  return json(c, {
    ...vendor,
    resourcesSupplied,
    assignedJobs,
    performanceStats,
  });
});

vendorsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!existing) return error(c, 404, "not found");

  const body = await c.req.json().catch(() => null);
  const update: Partial<typeof vendors.$inferInsert> = {};

  if (typeof body?.name === "string") update.name = body.name.trim();
  if (Array.isArray(body?.specialization)) {
    update.specialization = body.specialization.filter(
      (s: unknown): s is string => typeof s === "string",
    );
  }
  if (typeof body?.contact_person === "string") update.contactPerson = body.contact_person;
  if (typeof body?.contact_email === "string") update.contactEmail = body.contact_email;
  if (typeof body?.contact_phone === "string") update.contactPhone = body.contact_phone;
  if (typeof body?.rate_notes === "string") update.rateNotes = body.rate_notes;
  if (body?.status !== undefined) {
    if (!isVendorStatus(body.status)) return error(c, 400, "invalid status");
    update.status = body.status;
  }

  const [updated] = await db
    .update(vendors)
    .set(update)
    .where(eq(vendors.id, id))
    .returning();

  return json(c, updated!);
});

vendorsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!existing) return error(c, 404, "not found");

  await db.delete(vendors).where(eq(vendors.id, id));
  return json(c, { ok: true });
});

vendorsRoutes.get("/:id/candidates", async (c) => {
  const id = c.req.param("id");
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!vendor) return error(c, 404, "not found");

  const rows = await db
    .select()
    .from(candidates)
    .where(eq(candidates.sourceVendorId, id))
    .orderBy(asc(candidates.name));

  return json(c, rows.map(serializeCandidate));
});

vendorsRoutes.get("/:id/performance", async (c) => {
  const id = c.req.param("id");
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!vendor) return error(c, 404, "not found");

  return json(c, computePerformance(await vendorStages(id)));
});
