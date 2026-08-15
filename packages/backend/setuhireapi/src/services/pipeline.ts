import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  candidates,
  clients,
  financeRecords,
  interviews,
  jobCandidateMatches,
  jobs,
  jobVendorAssignments,
  vendors,
} from "../db/schema.js";

export const INTERVIEW_STATUSES = ["scheduled", "cleared", "rejected", "no_show"] as const;
export const CONTRACT_TYPES = ["candidate_vendor", "vendor_client", "direct"] as const;
export const CONTRACT_STATUSES = ["active", "expired", "terminated"] as const;
export const BILLING_STATUSES = ["invoiced", "payment_received", "pending"] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export type BillingStatus = (typeof BILLING_STATUSES)[number];

/** Coerce a DB numeric/string/value into a JS number (or null). */
export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Coerce a value into the string form `numeric` columns expect on insert (or null). */
export const numStr = (v: unknown): string | null => {
  const n = num(v);
  return n === null ? null : String(n);
};

/** Coerce an ISO string / Date into a Date (or null). */
export const toDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Start (Mon 00:00) and end (next Mon 00:00, exclusive) of the current week. */
export const weekBounds = (now = new Date()): { start: Date; end: Date } => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
};

export const isExpiringSoon = (endDate: Date | null | undefined, days = 30): boolean => {
  if (!endDate) return false;
  const t = endDate.getTime();
  const now = Date.now();
  return t >= now && t <= now + days * 86_400_000;
};

const inSet = <T extends readonly string[]>(set: T, v: unknown): v is T[number] =>
  typeof v === "string" && (set as readonly string[]).includes(v);

export const isInterviewStatus = (v: unknown): v is InterviewStatus =>
  inSet(INTERVIEW_STATUSES, v);
export const isContractType = (v: unknown): v is ContractType => inSet(CONTRACT_TYPES, v);
export const isContractStatus = (v: unknown): v is ContractStatus =>
  inSet(CONTRACT_STATUSES, v);
export const isBillingStatus = (v: unknown): v is BillingStatus => inSet(BILLING_STATUSES, v);

export const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export type FinanceSummary = {
  totalRevenue: number;
  totalCommission: number;
  pendingReceivables: number;
  pendingVendorPayouts: number;
};

export async function financeSummary(month?: string): Promise<FinanceSummary> {
  const rows = month
    ? await db.select().from(financeRecords).where(eq(financeRecords.period, month))
    : await db.select().from(financeRecords);

  let totalRevenue = 0;
  let totalCommission = 0;
  let pendingReceivables = 0;
  let pendingVendorPayouts = 0;

  for (const r of rows) {
    const billing = num(r.clientBillingAmount) ?? 0;
    const payout = num(r.vendorPayoutAmount) ?? 0;
    const commission = num(r.commission) ?? billing - payout;

    totalRevenue += billing;
    totalCommission += commission;

    if (r.billingStatus !== "payment_received") {
      pendingReceivables += billing;
      pendingVendorPayouts += payout;
    }
  }

  return { totalRevenue, totalCommission, pendingReceivables, pendingVendorPayouts };
}

export async function dashboardSummary() {
  const [activeClients] = await db
    .select({ value: count() })
    .from(clients)
    .where(eq(clients.status, "active"));
  const [openJobs] = await db
    .select({ value: count() })
    .from(jobs)
    .where(eq(jobs.status, "open"));
  const [candidatesAvailable] = await db
    .select({ value: count() })
    .from(candidates)
    .where(eq(candidates.currentStatus, "available"));
  const [vendorsEngaged] = await db
    .select({ value: sql<number>`count(distinct ${jobVendorAssignments.vendorId})` })
    .from(jobVendorAssignments);

  const { start, end } = weekBounds();
  const [interviewsThisWeek] = await db
    .select({ value: count() })
    .from(interviews)
    .where(and(gte(interviews.scheduledAt, start), lte(interviews.scheduledAt, end)));

  const rows = await db
    .select()
    .from(financeRecords)
    .where(inArray(financeRecords.billingStatus, ["invoiced", "pending"]));
  const pendingBillingAmount = rows.reduce(
    (sum, r) => sum + (num(r.clientBillingAmount) ?? 0),
    0,
  );

  return {
    activeClients: Number(activeClients?.value ?? 0),
    openJobs: Number(openJobs?.value ?? 0),
    candidatesAvailable: Number(candidatesAvailable?.value ?? 0),
    vendorsEngaged: Number(vendorsEngaged?.value ?? 0),
    interviewsThisWeek: Number(interviewsThisWeek?.value ?? 0),
    pendingBillingAmount,
  };
}

export type AttentionItem = {
  type: "match" | "vendor" | "interview";
  message: string;
  link: string;
};

export async function attentionFeed(): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];
  const now = Date.now();

  // 1. High-score matches still at "applied" stage.
  const hot = await db
    .select({
      jobId: jobs.id,
      jobTitle: jobs.title,
      candidateName: candidates.name,
    })
    .from(jobCandidateMatches)
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .where(
      and(
        eq(jobCandidateMatches.stage, "applied"),
        sql`${jobCandidateMatches.matchScore} >= 90`,
      ),
    );

  const byJob = new Map<string, { title: string; names: string[] }>();
  for (const m of hot) {
    const key = m.jobId as string;
    const entry = byJob.get(key) ?? { title: m.jobTitle, names: [] };
    entry.names.push(m.candidateName);
    byJob.set(key, entry);
  }
  for (const [jobId, { title, names }] of byJob) {
    items.push({
      type: "match",
      message: `${names.length} candidate${names.length === 1 ? "" : "s"} matched >90% for ${title}, not yet contacted`,
      link: `/jobs/${jobId}`,
    });
  }

  // 2. Vendors unresponsive on open jobs for >5 days (no interviews / notes).
  const staleCutoff = new Date(now - 5 * 86_400_000);
  const assignments = await db
    .select({
      assignmentId: jobVendorAssignments.id,
      jobId: jobs.id,
      jobTitle: jobs.title,
      vendorId: vendors.id,
      vendorName: vendors.name,
      assignedAt: jobVendorAssignments.assignedAt,
    })
    .from(jobVendorAssignments)
    .innerJoin(jobs, eq(jobVendorAssignments.jobId, jobs.id))
    .innerJoin(vendors, eq(jobVendorAssignments.vendorId, vendors.id))
    .where(and(eq(jobs.status, "open"), lte(jobVendorAssignments.assignedAt, staleCutoff)));

  for (const a of assignments) {
    const matches = await db
      .select({ id: jobCandidateMatches.id, notes: jobCandidateMatches.notes })
      .from(jobCandidateMatches)
      .where(
        and(
          eq(jobCandidateMatches.jobId, a.jobId),
          eq(jobCandidateMatches.sourceVendorId, a.vendorId),
        ),
      );

    const hasNotes = matches.some((m) => m.notes && m.notes.trim().length > 0);
    if (hasNotes) continue;

    const matchIds = matches.map((m) => m.id);
    if (matchIds.length > 0) {
      const [withInterview] = await db
        .select({ id: interviews.id })
        .from(interviews)
        .where(inArray(interviews.matchId, matchIds))
        .limit(1);
      if (withInterview) continue;
    }

    const assignedAt = toDate(a.assignedAt);
    const days = assignedAt
      ? Math.max(1, Math.floor((now - assignedAt.getTime()) / 86_400_000))
      : 5;

    items.push({
      type: "vendor",
      message: `${a.vendorName} hasn't responded in ${days} days for ${a.jobTitle}`,
      link: `/jobs/${a.jobId}`,
    });
  }

  // 3. Interviews scheduled within the next 24h.
  const soon = await db
    .select({
      id: interviews.id,
      jobId: jobs.id,
      candidateName: candidates.name,
    })
    .from(interviews)
    .innerJoin(jobCandidateMatches, eq(interviews.matchId, jobCandidateMatches.id))
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .where(
      and(
        eq(interviews.status, "scheduled"),
        gte(interviews.scheduledAt, new Date(now)),
        lte(interviews.scheduledAt, new Date(now + 24 * 3600_000)),
      ),
    );

  for (const it of soon) {
    items.push({
      type: "interview",
      message: `Interview with ${it.candidateName} is tomorrow`,
      link: `/jobs/${it.jobId}`,
    });
  }

  return items;
}

export async function activityLog(limit: number) {
  const rows = await db
    .select({
      id: jobCandidateMatches.id,
      candidateName: candidates.name,
      jobTitle: jobs.title,
      stage: jobCandidateMatches.stage,
      createdAt: jobCandidateMatches.createdAt,
    })
    .from(jobCandidateMatches)
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .orderBy(sql`${jobCandidateMatches.createdAt} desc`)
    .limit(limit);

  return rows.map((r) => ({
    actor: null,
    candidate: r.candidateName,
    job: r.jobTitle,
    from: null,
    to: r.stage,
    at: r.createdAt,
  }));
}
