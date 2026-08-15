import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  candidates,
  clients,
  financeRecords,
  jobCandidateMatches,
  jobs,
  vendors,
} from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";
import {
  csvCell,
  financeSummary,
  isBillingStatus,
  num,
  numStr,
} from "../services/pipeline.js";

export const financeRoutes = new Hono();

financeRoutes.use("*", requireAuth);

const rowShape = {
  id: financeRecords.id,
  matchId: financeRecords.matchId,
  clientBillingAmount: financeRecords.clientBillingAmount,
  vendorPayoutAmount: financeRecords.vendorPayoutAmount,
  commission: financeRecords.commission,
  billingStatus: financeRecords.billingStatus,
  period: financeRecords.period,
  createdAt: financeRecords.createdAt,
  candidateId: candidates.id,
  candidateName: candidates.name,
  jobId: jobs.id,
  jobTitle: jobs.title,
  clientId: clients.id,
  clientName: clients.name,
  vendorId: vendors.id,
  vendorName: vendors.name,
} as const;

const toOutput = <
  T extends {
    clientBillingAmount: string | null;
    vendorPayoutAmount: string | null;
    commission: string | null;
  },
>(
  r: T,
) => {
  const billing = num(r.clientBillingAmount);
  const payout = num(r.vendorPayoutAmount);
  return {
    ...r,
    clientBillingAmount: billing,
    vendorPayoutAmount: payout,
    commission: num(r.commission) ?? (billing !== null && payout !== null ? billing - payout : null),
  };
};

const buildConditions = (q: Record<string, string>) => {
  const conditions = [];
  if (q.client_id) conditions.push(eq(clients.id, q.client_id));
  if (q.vendor_id) conditions.push(eq(vendors.id, q.vendor_id));
  if (q.month) conditions.push(eq(financeRecords.period, q.month));
  return conditions;
};

financeRoutes.get("/records", async (c) => {
  const conditions = buildConditions(c.req.query());

  const rows = await db
    .select(rowShape)
    .from(financeRecords)
    .innerJoin(jobCandidateMatches, eq(financeRecords.matchId, jobCandidateMatches.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(vendors, eq(jobCandidateMatches.sourceVendorId, vendors.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(financeRecords.createdAt));

  return json(c, rows.map(toOutput));
});

financeRoutes.post("/records", async (c) => {
  const body = await c.req.json().catch(() => null);

  const matchId = typeof body?.match_id === "string" ? body.match_id : "";
  if (!matchId) return error(c, 400, "match_id is required");

  const [match] = await db
    .select({ id: jobCandidateMatches.id })
    .from(jobCandidateMatches)
    .where(eq(jobCandidateMatches.id, matchId))
    .limit(1);
  if (!match) return error(c, 404, "match not found");

  const billing = body?.client_billing_amount === undefined ? null : numStr(body.client_billing_amount);
  const payout = body?.vendor_payout_amount === undefined ? null : numStr(body.vendor_payout_amount);

  if (body?.billing_status !== undefined && !isBillingStatus(body.billing_status)) {
    return error(c, 400, `invalid billing_status: ${body.billing_status}`);
  }
  const billingStatus = isBillingStatus(body?.billing_status)
    ? body.billing_status
    : "pending";

  const commission = numStr(body?.commission) ??
    (billing !== null && payout !== null ? String(num(billing)! - num(payout)!) : null);
  const period = typeof body?.period === "string" ? body.period : null;

  const [created] = await db
    .insert(financeRecords)
    .values({
      matchId,
      clientBillingAmount: billing,
      vendorPayoutAmount: payout,
      commission,
      billingStatus,
      period,
    })
    .returning();

  return json(c, toOutput(created!), 201);
});

financeRoutes.patch("/records/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(financeRecords)
    .where(eq(financeRecords.id, id))
    .limit(1);
  if (!existing) return error(c, 404, "finance record not found");

  const body = await c.req.json().catch(() => null);

  const updates: Partial<typeof financeRecords.$inferInsert> = {};

  if (body?.client_billing_amount !== undefined) {
    updates.clientBillingAmount = numStr(body.client_billing_amount);
  }
  if (body?.vendor_payout_amount !== undefined) {
    updates.vendorPayoutAmount = numStr(body.vendor_payout_amount);
  }
  if (body?.billing_status !== undefined) {
    if (!isBillingStatus(body.billing_status)) {
      return error(c, 400, `invalid billing_status: ${body.billing_status}`);
    }
    updates.billingStatus = body.billing_status;
  }
  if (body?.period !== undefined) {
    updates.period = typeof body.period === "string" ? body.period : null;
  }

  if (Object.keys(updates).length === 0) {
    return json(c, toOutput(existing));
  }

  let commission: string | null;
  if (body?.commission !== undefined) {
    commission = numStr(body.commission);
  } else {
    const billing = updates.clientBillingAmount !== undefined
      ? updates.clientBillingAmount
      : existing.clientBillingAmount;
    const payout = updates.vendorPayoutAmount !== undefined
      ? updates.vendorPayoutAmount
      : existing.vendorPayoutAmount;
    const b = num(billing);
    const p = num(payout);
    commission = b !== null && p !== null ? String(b - p) : numStr(existing.commission);
  }
  updates.commission = commission;

  const [updated] = await db
    .update(financeRecords)
    .set(updates)
    .where(eq(financeRecords.id, id))
    .returning();

  return json(c, toOutput(updated!));
});

financeRoutes.get("/summary", async (c) => {
  const month = c.req.query("month");
  return json(c, await financeSummary(month));
});

financeRoutes.get("/export", async (c) => {
  const conditions = buildConditions(c.req.query());

  const rows = await db
    .select(rowShape)
    .from(financeRecords)
    .innerJoin(jobCandidateMatches, eq(financeRecords.matchId, jobCandidateMatches.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(vendors, eq(jobCandidateMatches.sourceVendorId, vendors.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(financeRecords.createdAt));

  const header = [
    "id",
    "candidate",
    "job",
    "client",
    "vendor",
    "client_billing_amount",
    "vendor_payout_amount",
    "commission",
    "billing_status",
    "period",
    "created_at",
  ];

  const lines = rows.map((r) => {
    const out = toOutput(r);
    return [
      out.id,
      out.candidateName,
      out.jobTitle,
      out.clientName,
      out.vendorName,
      out.clientBillingAmount ?? "",
      out.vendorPayoutAmount ?? "",
      out.commission ?? "",
      out.billingStatus,
      out.period ?? "",
      out.createdAt,
    ]
      .map(csvCell)
      .join(",");
  });

  const csv = [header.join(","), ...lines].join("\n");

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="finance.csv"');
  return c.body(csv);
});
