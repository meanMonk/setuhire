import { and, arrayContains, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import {
  candidates,
  jobCandidateMatches,
  jobs,
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

const computePerformance = (stages: (string | null)[]) => {
  const submissions = stages.filter((s) => s === "applied").length;
  const shortlisted = stages.filter((s) => s === "screened").length;
  const placed = stages.filter((s) => s === "placed").length;
  const ratio = submissions === 0 ? 0 : Number(((placed / submissions) * 100).toFixed(2));
  return { submissions, shortlisted, placed, ratio };
};

async function vendorStages(vendorId: string): Promise<(string | null)[]> {
  const rows = await db
    .select({ stage: jobCandidateMatches.stage })
    .from(jobCandidateMatches)
    .innerJoin(candidates, eq(candidates.id, jobCandidateMatches.candidateId))
    .where(eq(candidates.sourceVendorId, vendorId));
  return rows.map((r) => r.stage);
}

vendorsRoutes.get("/", async (c) => {
  const specialization = c.req.query("specialization");
  const statusParam = c.req.query("status");

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
      ),
    )
    .orderBy(asc(vendors.name));

  return json(c, rows);
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
    .select({
      candidate: candidates,
      match: jobCandidateMatches,
      job: jobs,
    })
    .from(candidates)
    .innerJoin(jobCandidateMatches, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobs.id, jobCandidateMatches.jobId))
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
  }));

  const performanceStats = computePerformance(await vendorStages(id));

  return json(c, {
    ...vendor,
    resourcesSupplied,
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
