import { del, get, patch, post, qs } from "./client";
import type { Job, JobPreview, Match } from "./types";
import { normalizeCandidate } from "./candidates";

export type { JobPreview };

export type JobFilters = {
  clientId?: string;
  techStack?: string;
  status?: string;
  employmentType?: string;
};

export type JobInput = {
  clientId: string;
  title: string;
  techStack?: string[];
  experienceRequired?: string | null;
  targetSellingCost?: number | null;
  currency?: string;
  employmentType?: string;
  description?: string | null;
  rawJdText?: string | null;
  sourceUrl?: string | null;
};

const jobBody = (body: JobInput) => ({
  client_id: body.clientId,
  title: body.title,
  tech_stack: body.techStack ?? [],
  experience_required: body.experienceRequired ?? null,
  target_selling_cost: body.targetSellingCost ?? null,
  currency: body.currency,
  employment_type: body.employmentType,
  description: body.description ?? null,
  raw_jd_text: body.rawJdText ?? null,
  source_url: body.sourceUrl ?? null,
});

export async function listJobs(params?: JobFilters): Promise<Job[]> {
  return get<Job[]>(
    `/jobs${qs({
      client_id: params?.clientId,
      tech_stack: params?.techStack,
      status: params?.status,
      employment_type: params?.employmentType,
    })}`,
  );
}

export async function getJob(id: string): Promise<Job> {
  return get<Job>(`/jobs/${id}`);
}

export async function createJob(body: JobInput): Promise<Job> {
  return post<Job>("/jobs", jobBody(body));
}

export async function updateJob(id: string, body: Partial<JobInput>): Promise<Job> {
  return patch<Job>(`/jobs/${id}`, jobBody(body as JobInput));
}

export async function deleteJob(id: string): Promise<void> {
  await del(`/jobs/${id}`);
}

export async function fetchJobFromUrl(url: string): Promise<JobPreview> {
  return post<JobPreview>("/jobs/fetch-from-url", { url });
}

export async function parseJobText(rawText: string): Promise<JobPreview> {
  return post<JobPreview>("/jobs/parse-text", { raw_text: rawText });
}

type RawMatchResult = {
  candidate: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    skills?: string[] | null;
    experienceYears?: number | null;
    currentStatus?: string | null;
    sourceType?: string | null;
    sourceVendorId?: string | null;
    rateExpectation?: number | null;
    resumeUrl?: string | null;
  };
  score: number;
  rationale: string;
  source: string;
  key_skills_overlap?: string[];
  rate_fit?: "ok" | "above_tsc";
  priority?: boolean;
};

export async function runMatch(id: string): Promise<Match[]> {
  const results = await post<RawMatchResult[]>(`/jobs/${id}/match`);
  return results.map((r) => ({
    candidate: normalizeCandidate(r.candidate),
    score: r.score,
    rationale: r.rationale,
    source: r.source,
    keySkillsOverlap: r.key_skills_overlap ?? [],
    rateFit: r.rate_fit ?? "ok",
    priority: r.priority ?? false,
  }));
}

export async function assignVendor(
  id: string,
  body: { vendorId: string; sourcingCost?: number | null },
): Promise<unknown> {
  return post(`/jobs/${id}/assign-vendor`, {
    vendor_id: body.vendorId,
    sourcing_cost: body.sourcingCost ?? null,
  });
}
