import { and, asc, arrayContains, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.js";
import { candidates, jobCandidateMatches, jobs } from "../db/schema.js";
import { putObject } from "../lib/minio.js";
import { parseResume } from "./ai.js";

export const CANDIDATE_STATUSES = ["available", "engaged", "not_looking"] as const;
export const SOURCE_TYPES = ["direct", "vendor"] as const;
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];

type CandidateRow = typeof candidates.$inferSelect;

export type CandidateFilters = {
  skill?: string;
  status?: CandidateStatus;
  source?: SourceType;
};

export type CandidateInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  skills?: string[];
  experienceYears?: number | null;
  currentStatus?: CandidateStatus;
  sourceType?: SourceType;
  sourceVendorId?: string | null;
  rateExpectation?: number | null;
  resumeUrl?: string | null;
};

export function isCandidateStatus(v: string): v is CandidateStatus {
  return (CANDIDATE_STATUSES as readonly string[]).includes(v);
}

export function isSourceType(v: string): v is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(v);
}

const toNumber = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

const toNumericStr = (v: number | null | undefined): string | null =>
  v === null || v === undefined ? null : String(v);

export function serializeCandidate(row: CandidateRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    skills: row.skills ?? [],
    experience_years: toNumber(row.experienceYears),
    current_status: row.currentStatus,
    source_type: row.sourceType,
    source_vendor_id: row.sourceVendorId,
    rate_expectation: toNumber(row.rateExpectation),
    resume_url: row.resumeUrl,
    parsed_profile: row.parsedProfile,
    created_at: row.createdAt,
  };
}

export async function listCandidates(filters: CandidateFilters) {
  const conditions = [];
  if (filters.status) conditions.push(eq(candidates.currentStatus, filters.status));
  if (filters.source) conditions.push(eq(candidates.sourceType, filters.source));
  if (filters.skill) conditions.push(arrayContains(candidates.skills, [filters.skill]));

  const rows = await db
    .select()
    .from(candidates)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(candidates.name));

  return rows.map(serializeCandidate);
}

export async function createCandidate(input: CandidateInput) {
  const [row] = await db
    .insert(candidates)
    .values({
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      skills: input.skills ?? [],
      experienceYears: toNumericStr(input.experienceYears),
      currentStatus: input.currentStatus ?? "available",
      sourceType: input.sourceType ?? "direct",
      sourceVendorId: input.sourceVendorId ?? null,
      rateExpectation: toNumericStr(input.rateExpectation),
      resumeUrl: input.resumeUrl ?? null,
    })
    .returning();

  return serializeCandidate(row!);
}

export async function getCandidateDetail(id: string) {
  const [row] = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
  if (!row) return null;

  const matches = await db
    .select({
      id: jobCandidateMatches.id,
      jobId: jobCandidateMatches.jobId,
      matchScore: jobCandidateMatches.matchScore,
      matchRationale: jobCandidateMatches.matchRationale,
      stage: jobCandidateMatches.stage,
      notes: jobCandidateMatches.notes,
      createdAt: jobCandidateMatches.createdAt,
      jobTitle: jobs.title,
    })
    .from(jobCandidateMatches)
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .where(eq(jobCandidateMatches.candidateId, id));

  const matchHistory = matches.map((m) => ({
    id: m.id,
    job_id: m.jobId,
    job_title: m.jobTitle,
    match_score: toNumber(m.matchScore),
    match_rationale: m.matchRationale,
    stage: m.stage,
    notes: m.notes,
    created_at: m.createdAt,
  }));

  return { ...serializeCandidate(row), matchHistory };
}

export async function updateCandidate(id: string, input: Partial<CandidateInput>) {
  const patch: Partial<typeof candidates.$inferInsert> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.email !== undefined) patch.email = input.email ?? null;
  if (input.phone !== undefined) patch.phone = input.phone ?? null;
  if (input.skills !== undefined) patch.skills = input.skills;
  if (input.experienceYears !== undefined) patch.experienceYears = toNumericStr(input.experienceYears);
  if (input.currentStatus !== undefined) patch.currentStatus = input.currentStatus;
  if (input.sourceType !== undefined) patch.sourceType = input.sourceType;
  if (input.sourceVendorId !== undefined) patch.sourceVendorId = input.sourceVendorId ?? null;
  if (input.rateExpectation !== undefined) patch.rateExpectation = toNumericStr(input.rateExpectation);
  if (input.resumeUrl !== undefined) patch.resumeUrl = input.resumeUrl ?? null;

  const rows = await db
    .update(candidates)
    .set(patch)
    .where(eq(candidates.id, id))
    .returning();

  return rows[0] ? serializeCandidate(rows[0]) : null;
}

export async function deleteCandidate(id: string): Promise<boolean> {
  const rows = await db.delete(candidates).where(eq(candidates.id, id)).returning();
  return rows.length > 0;
}

export function resumeContentType(filename: string, fallback?: string): string {
  if (fallback && fallback !== "application/octet-stream") return fallback;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

export async function storeResume(buffer: Buffer, filename: string, contentType: string) {
  const parsedProfile = await parseResume(buffer, filename);
  const key = `resumes/${randomUUID()}-${filename}`;
  await putObject(key, buffer, contentType);
  return { parsedProfile, resumeKey: key };
}
