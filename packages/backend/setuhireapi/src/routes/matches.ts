import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { candidates, jobCandidateMatches, jobs } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { error, json } from "../lib/http.js";

const PIPELINE_STAGES = ["applied", "screened", "interview", "offer", "placed", "rejected"] as const;
type PipelineStage = (typeof PIPELINE_STAGES)[number];

type MatchRow = {
  id: string;
  jobId: string;
  candidateId: string;
  sourceVendorId: string | null;
  matchScore: string | null;
  matchRationale: string | null;
  stage: PipelineStage | null;
  notes: string | null;
  createdAt: Date | null;
  jobTitle: string;
  candidateName: string;
};

const isStage = (v: string): v is PipelineStage =>
  (PIPELINE_STAGES as readonly string[]).includes(v);

const toNumber = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

const matchColumns = {
  id: jobCandidateMatches.id,
  jobId: jobCandidateMatches.jobId,
  candidateId: jobCandidateMatches.candidateId,
  sourceVendorId: jobCandidateMatches.sourceVendorId,
  matchScore: jobCandidateMatches.matchScore,
  matchRationale: jobCandidateMatches.matchRationale,
  stage: jobCandidateMatches.stage,
  notes: jobCandidateMatches.notes,
  createdAt: jobCandidateMatches.createdAt,
  jobTitle: jobs.title,
  candidateName: candidates.name,
};

function serializeMatch(row: MatchRow) {
  return {
    id: row.id,
    job_id: row.jobId,
    candidate_id: row.candidateId,
    source_vendor_id: row.sourceVendorId,
    match_score: toNumber(row.matchScore),
    match_rationale: row.matchRationale,
    stage: row.stage,
    notes: row.notes,
    created_at: row.createdAt,
    job_title: row.jobTitle,
    candidate_name: row.candidateName,
  };
}

async function getMatchById(id: string): Promise<MatchRow | null> {
  const rows = await db
    .select(matchColumns)
    .from(jobCandidateMatches)
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .where(eq(jobCandidateMatches.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export const matchesRoutes = new Hono();

matchesRoutes.use("*", requireAuth);

matchesRoutes.get("/", async (c) => {
  const jobId = c.req.query("job_id");
  const candidateId = c.req.query("candidate_id");
  const stage = c.req.query("stage");

  if (stage && !isStage(stage)) return error(c, 400, "invalid stage");

  const conditions = [];
  if (jobId) conditions.push(eq(jobCandidateMatches.jobId, jobId));
  if (candidateId) conditions.push(eq(jobCandidateMatches.candidateId, candidateId));
  if (stage) conditions.push(eq(jobCandidateMatches.stage, stage as PipelineStage));

  const rows = await db
    .select(matchColumns)
    .from(jobCandidateMatches)
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(jobCandidateMatches.createdAt));

  return json(c, rows.map(serializeMatch));
});

matchesRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return error(c, 400, "invalid body");

  const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
  const candidateId = typeof body.candidate_id === "string" ? body.candidate_id.trim() : "";
  const sourceVendorId =
    typeof body.source_vendor_id === "string" && body.source_vendor_id.trim() !== ""
      ? body.source_vendor_id.trim()
      : null;

  if (!jobId || !candidateId) return error(c, 400, "job_id and candidate_id are required");

  const existing = await db
    .select(matchColumns)
    .from(jobCandidateMatches)
    .innerJoin(jobs, eq(jobCandidateMatches.jobId, jobs.id))
    .innerJoin(candidates, eq(jobCandidateMatches.candidateId, candidates.id))
    .where(
      and(
        eq(jobCandidateMatches.jobId, jobId),
        eq(jobCandidateMatches.candidateId, candidateId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return json(c, serializeMatch(existing[0]!));
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return error(c, 404, "job not found");
  const [cand] = await db.select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
  if (!cand) return error(c, 404, "candidate not found");

  const [created] = await db
    .insert(jobCandidateMatches)
    .values({ jobId, candidateId, sourceVendorId, stage: "applied" })
    .returning();

  const row = await getMatchById(created!.id);
  return json(c, serializeMatch(row!), 201);
});

matchesRoutes.get("/:id", async (c) => {
  const row = await getMatchById(c.req.param("id"));
  if (!row) return error(c, 404, "match not found");
  return json(c, serializeMatch(row));
});

matchesRoutes.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return error(c, 400, "invalid body");

  if (body.stage !== undefined && !isStage(String(body.stage))) {
    return error(c, 400, "invalid stage");
  }

  const patch: Record<string, unknown> = {};
  if (body.stage !== undefined) patch.stage = String(body.stage);
  if (body.notes !== undefined) patch.notes = typeof body.notes === "string" ? body.notes : null;

  if (Object.keys(patch).length === 0) return error(c, 400, "nothing to update");

  const rows = await db
    .update(jobCandidateMatches)
    .set(patch)
    .where(eq(jobCandidateMatches.id, c.req.param("id")))
    .returning();

  if (rows.length === 0) return error(c, 404, "match not found");

  const row = await getMatchById(c.req.param("id"));
  return json(c, serializeMatch(row!));
});
