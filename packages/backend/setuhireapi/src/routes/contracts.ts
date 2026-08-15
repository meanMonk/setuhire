import { Hono } from "hono";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  candidates,
  clients,
  contracts,
  jobCandidateMatches,
  jobs,
  vendors,
} from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";
import {
  isContractStatus,
  isContractType,
  isExpiringSoon,
  num,
  numStr,
  toDate,
} from "../services/pipeline.js";

export const contractsRoutes = new Hono();

contractsRoutes.use("*", requireAuth);

const rowShape = {
  id: contracts.id,
  matchId: contracts.matchId,
  contractType: contracts.contractType,
  rate: contracts.rate,
  startDate: contracts.startDate,
  endDate: contracts.endDate,
  documentUrl: contracts.documentUrl,
  status: contracts.status,
  createdAt: contracts.createdAt,
  candidateId: candidates.id,
  candidateName: candidates.name,
  jobId: jobs.id,
  jobTitle: jobs.title,
  clientId: clients.id,
  clientName: clients.name,
  vendorId: vendors.id,
  vendorName: vendors.name,
} as const;

const toOutput = <T extends { rate: string | null; endDate: Date | null }>(r: T) => ({
  ...r,
  rate: num(r.rate),
  expiring_soon: isExpiringSoon(r.endDate),
});

contractsRoutes.get("/", async (c) => {
  const q = c.req.query();
  const conditions = [];

  if (q.client_id) conditions.push(eq(clients.id, q.client_id));
  if (q.vendor_id) conditions.push(eq(vendors.id, q.vendor_id));
  if (q.status) {
    if (!isContractStatus(q.status)) {
      return error(c, 400, `invalid status: ${q.status}`);
    }
    conditions.push(eq(contracts.status, q.status));
  }

  const rows = await db
    .select(rowShape)
    .from(contracts)
    .innerJoin(jobCandidateMatches, eq(contracts.matchId, jobCandidateMatches.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(vendors, eq(jobCandidateMatches.sourceVendorId, vendors.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(contracts.createdAt));

  return json(c, rows.map(toOutput));
});

contractsRoutes.get("/expiring", async (c) => {
  const daysRaw = Number(c.req.query("days") ?? "30");
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 30;
  const now = Date.now();
  const floor = new Date(now);
  const ceiling = new Date(now + days * 86_400_000);

  const rows = await db
    .select(rowShape)
    .from(contracts)
    .innerJoin(jobCandidateMatches, eq(contracts.matchId, jobCandidateMatches.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(vendors, eq(jobCandidateMatches.sourceVendorId, vendors.id))
    .where(
      and(gte(contracts.endDate, floor), lte(contracts.endDate, ceiling)),
    )
    .orderBy(contracts.endDate);

  return json(
    c,
    rows.map((r) => ({ ...toOutput(r), expiring_soon: true })),
  );
});

contractsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db
    .select(rowShape)
    .from(contracts)
    .innerJoin(jobCandidateMatches, eq(contracts.matchId, jobCandidateMatches.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(vendors, eq(jobCandidateMatches.sourceVendorId, vendors.id))
    .where(eq(contracts.id, id))
    .limit(1);
  if (!row) return error(c, 404, "contract not found");

  return json(c, toOutput(row));
});

contractsRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);

  const matchId = typeof body?.match_id === "string" ? body.match_id : "";
  if (!matchId) return error(c, 400, "match_id is required");

  if (!isContractType(body?.contract_type)) {
    return error(c, 400, "invalid contract_type");
  }

  const [match] = await db
    .select({ id: jobCandidateMatches.id })
    .from(jobCandidateMatches)
    .where(eq(jobCandidateMatches.id, matchId))
    .limit(1);
  if (!match) return error(c, 404, "match not found");

  const rate = body?.rate === undefined ? null : numStr(body.rate);
  const startDate = toDate(body?.start_date);
  const endDate = toDate(body?.end_date);
  const documentUrl =
    typeof body?.document_url === "string" ? body.document_url : null;

  const [created] = await db
    .insert(contracts)
    .values({
      matchId,
      contractType: body.contract_type,
      rate,
      startDate,
      endDate,
      documentUrl,
      status: "active",
    })
    .returning();

  return json(
    c,
    { ...created!, rate: num(created!.rate), expiring_soon: isExpiringSoon(created!.endDate) },
    201,
  );
});

contractsRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, id))
    .limit(1);
  if (!existing) return error(c, 404, "contract not found");

  const body = await c.req.json().catch(() => null);

  const updates: Partial<typeof contracts.$inferInsert> = {};

  if (body?.contract_type !== undefined) {
    if (!isContractType(body.contract_type)) {
      return error(c, 400, "invalid contract_type");
    }
    updates.contractType = body.contract_type;
  }
  if (body?.rate !== undefined) updates.rate = numStr(body.rate);
  if (body?.start_date !== undefined) updates.startDate = toDate(body.start_date);
  if (body?.end_date !== undefined) updates.endDate = toDate(body.end_date);
  if (body?.document_url !== undefined) {
    updates.documentUrl =
      typeof body.document_url === "string" ? body.document_url : null;
  }
  if (body?.status !== undefined) {
    if (!isContractStatus(body.status)) {
      return error(c, 400, `invalid status: ${body.status}`);
    }
    updates.status = body.status;
  }

  const [updated] = await db
    .update(contracts)
    .set(updates)
    .where(eq(contracts.id, id))
    .returning();

  return json(
    c,
    { ...updated!, rate: num(updated!.rate), expiring_soon: isExpiringSoon(updated!.endDate) },
  );
});
