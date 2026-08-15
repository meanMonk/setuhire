import { and, arrayContains, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  candidates,
  jobCandidateMatches,
  jobVendorAssignments,
  jobs,
  vendors,
} from "../db/schema.js";
import { runMatch } from "./ai.js";

type JobRow = typeof jobs.$inferSelect;
type CandidateRow = typeof candidates.$inferSelect;
type JobStatus = JobRow["status"];
type EmploymentType = JobRow["employmentType"];

const numOrNull = (v: string | number | null | undefined): number | null =>
  v == null ? null : Number(v);

export function serializeJob(job: JobRow) {
  return { ...job, targetSellingCost: numOrNull(job.targetSellingCost) };
}

export function serializeCandidate(candidate: CandidateRow) {
  return {
    ...candidate,
    experienceYears: numOrNull(candidate.experienceYears),
    rateExpectation: numOrNull(candidate.rateExpectation),
  };
}

export type JobsFilter = {
  clientId?: string;
  techStack?: string;
  status?: JobStatus;
  employmentType?: EmploymentType;
};

export async function listJobs(filter: JobsFilter) {
  const conditions = [];
  if (filter.clientId) conditions.push(eq(jobs.clientId, filter.clientId));
  if (filter.techStack) conditions.push(arrayContains(jobs.techStack, [filter.techStack]));
  if (filter.status) conditions.push(eq(jobs.status, filter.status));
  if (filter.employmentType) conditions.push(eq(jobs.employmentType, filter.employmentType));

  const rows = await db
    .select()
    .from(jobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(jobs.createdAt));

  return rows.map(serializeJob);
}

export async function getJob(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return job ? serializeJob(job) : null;
}

export type CreateJobInput = {
  clientId: string;
  title: string;
  techStack?: string[];
  experienceRequired?: string | null;
  targetSellingCost?: number | null;
  currency?: string;
  employmentType?: EmploymentType;
  description?: string | null;
  rawJdText?: string | null;
  sourceUrl?: string | null;
};

export async function createJob(input: CreateJobInput) {
  const [created] = await db
    .insert(jobs)
    .values({
      clientId: input.clientId,
      title: input.title,
      techStack: input.techStack ?? [],
      experienceRequired: input.experienceRequired ?? null,
      targetSellingCost:
        input.targetSellingCost == null ? null : String(input.targetSellingCost),
      currency: input.currency ?? "INR",
      employmentType: input.employmentType ?? "contract",
      description: input.description ?? null,
      rawJdText: input.rawJdText ?? null,
      sourceUrl: input.sourceUrl ?? null,
    })
    .returning();

  return serializeJob(created!);
}

export type UpdateJobInput = Partial<{
  clientId: string;
  title: string;
  techStack: string[];
  experienceRequired: string | null;
  targetSellingCost: number | null;
  currency: string;
  employmentType: EmploymentType;
  status: JobStatus;
  description: string | null;
  rawJdText: string | null;
  sourceUrl: string | null;
}>;

export async function updateJob(id: string, input: UpdateJobInput) {
  const set: Partial<typeof jobs.$inferInsert> = {};
  if (input.clientId !== undefined) set.clientId = input.clientId;
  if (input.title !== undefined) set.title = input.title;
  if (input.techStack !== undefined) set.techStack = input.techStack;
  if (input.experienceRequired !== undefined) set.experienceRequired = input.experienceRequired;
  if (input.targetSellingCost !== undefined)
    set.targetSellingCost =
      input.targetSellingCost == null ? null : String(input.targetSellingCost);
  if (input.currency !== undefined) set.currency = input.currency;
  if (input.employmentType !== undefined) set.employmentType = input.employmentType;
  if (input.status !== undefined) set.status = input.status;
  if (input.description !== undefined) set.description = input.description;
  if (input.rawJdText !== undefined) set.rawJdText = input.rawJdText;
  if (input.sourceUrl !== undefined) set.sourceUrl = input.sourceUrl;

  if (Object.keys(set).length === 0) return getJob(id);

  const [updated] = await db.update(jobs).set(set).where(eq(jobs.id, id)).returning();
  return updated ? serializeJob(updated) : null;
}

export async function deleteJob(id: string) {
  await db.delete(jobs).where(eq(jobs.id, id));
}

export async function getVendorAssignments(jobId: string) {
  const rows = await db
    .select({
      id: jobVendorAssignments.id,
      vendorId: jobVendorAssignments.vendorId,
      sourcingCost: jobVendorAssignments.sourcingCost,
      assignedAt: jobVendorAssignments.assignedAt,
      vendorName: vendors.name,
      vendorStatus: vendors.status,
    })
    .from(jobVendorAssignments)
    .leftJoin(vendors, eq(jobVendorAssignments.vendorId, vendors.id))
    .where(eq(jobVendorAssignments.jobId, jobId));

  return rows.map((r) => ({ ...r, sourcingCost: numOrNull(r.sourcingCost) }));
}

export async function getPipelineSummary(jobId: string) {
  const rows = await db
    .select({ stage: jobCandidateMatches.stage })
    .from(jobCandidateMatches)
    .where(eq(jobCandidateMatches.jobId, jobId));

  const summary: Record<string, number> = {
    applied: 0,
    screened: 0,
    interview: 0,
    offer: 0,
    placed: 0,
    rejected: 0,
  };
  for (const row of rows) {
    const stage = row.stage ?? "applied";
    summary[stage] = (summary[stage] ?? 0) + 1;
  }
  return summary;
}

export async function assignVendor(jobId: string, vendorId: string, sourcingCost: number | null) {
  const [existing] = await db
    .select()
    .from(jobVendorAssignments)
    .where(
      and(eq(jobVendorAssignments.jobId, jobId), eq(jobVendorAssignments.vendorId, vendorId)),
    )
    .limit(1);

  const cost = sourcingCost == null ? null : String(sourcingCost);

  if (existing) {
    const [updated] = await db
      .update(jobVendorAssignments)
      .set({ sourcingCost: cost })
      .where(eq(jobVendorAssignments.id, existing.id))
      .returning();
    return updated ? { ...updated, sourcingCost: numOrNull(updated.sourcingCost) } : null;
  }

  const [created] = await db
    .insert(jobVendorAssignments)
    .values({ jobId, vendorId, sourcingCost: cost })
    .returning();
  return { ...created!, sourcingCost: numOrNull(created!.sourcingCost) };
}

export async function matchJob(jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return null;

  const candidateRows = await db.select().from(candidates);
  const results = await runMatch(job, candidateRows);

  for (const result of results) {
    const candidate = result.candidate;
    const [existing] = await db
      .select()
      .from(jobCandidateMatches)
      .where(
        and(
          eq(jobCandidateMatches.jobId, job.id),
          eq(jobCandidateMatches.candidateId, candidate.id),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(jobCandidateMatches)
        .set({
          matchScore: String(result.score),
          matchRationale: result.rationale,
          sourceVendorId: candidate.sourceVendorId,
        })
        .where(eq(jobCandidateMatches.id, existing.id));
    } else {
      await db.insert(jobCandidateMatches).values({
        jobId: job.id,
        candidateId: candidate.id,
        sourceVendorId: candidate.sourceVendorId,
        matchScore: String(result.score),
        matchRationale: result.rationale,
        stage: "applied",
      });
    }
  }

  return results.map((result) => ({
    candidate: serializeCandidate(result.candidate),
    score: result.score,
    rationale: result.rationale,
    source: result.source,
    key_skills_overlap: result.key_skills_overlap,
    rate_fit: result.rate_fit,
    ...(result.score >= 90 ? { priority: true } : {}),
  }));
}
