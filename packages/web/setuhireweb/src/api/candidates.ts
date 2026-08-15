import { del, get, patch, post, qs } from "./client";
import type { Candidate, CandidateDetail, CandidateProfile, Match } from "./types";

export type { CandidateDetail };

export type CandidatePreview = CandidateProfile & {
  name?: string;
  email?: string;
  resumeKey?: string;
};

export type CandidateFilters = {
  skill?: string;
  status?: string;
  source?: string;
};

export type CandidateInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  skills?: string[];
  experienceYears?: number | null;
  currentStatus?: string;
  sourceType?: string;
  sourceVendorId?: string | null;
  rateExpectation?: number | null;
  resumeUrl?: string | null;
};

export type MatchFilters = {
  jobId?: string;
  candidateId?: string;
  stage?: string;
};

export type MatchInput = {
  jobId: string;
  candidateId: string;
  sourceVendorId?: string | null;
};

type RawCandidate = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  skills?: string[] | null;
  experience_years?: number | null;
  experienceYears?: number | null;
  current_status?: string | null;
  currentStatus?: string | null;
  source_type?: string | null;
  sourceType?: string | null;
  source_vendor_id?: string | null;
  sourceVendorId?: string | null;
  rate_expectation?: number | null;
  rateExpectation?: number | null;
  resume_url?: string | null;
  resumeUrl?: string | null;
};

type RawMatch = {
  id: string;
  job_id?: string | null;
  candidate_id?: string | null;
  source_vendor_id?: string | null;
  match_score?: number | null;
  match_rationale?: string | null;
  stage?: string | null;
  notes?: string | null;
  job_title?: string | null;
  candidate_name?: string | null;
};

export function normalizeCandidate(raw: RawCandidate): Candidate {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    skills: raw.skills ?? [],
    experienceYears: raw.experience_years ?? raw.experienceYears ?? null,
    currentStatus: raw.current_status ?? raw.currentStatus ?? null,
    sourceType: raw.source_type ?? raw.sourceType ?? null,
    rateExpectation: raw.rate_expectation ?? raw.rateExpectation ?? null,
    resumeUrl: raw.resume_url ?? raw.resumeUrl ?? null,
  };
}

export function normalizeMatch(raw: RawMatch): Match {
  return {
    id: raw.id,
    jobId: raw.job_id ?? undefined,
    candidateId: raw.candidate_id ?? undefined,
    matchScore: raw.match_score ?? null,
    matchRationale: raw.match_rationale ?? null,
    stage: raw.stage ?? null,
    notes: raw.notes ?? null,
    jobTitle: raw.job_title ?? undefined,
    candidateName: raw.candidate_name ?? undefined,
  };
}

const candidateBody = (body: CandidateInput) => ({
  name: body.name,
  email: body.email ?? null,
  phone: body.phone ?? null,
  skills: body.skills ?? [],
  experience_years: body.experienceYears ?? null,
  current_status: body.currentStatus,
  source_type: body.sourceType,
  source_vendor_id: body.sourceVendorId ?? null,
  rate_expectation: body.rateExpectation ?? null,
  resume_url: body.resumeUrl ?? null,
});

export async function listCandidates(params?: CandidateFilters): Promise<Candidate[]> {
  const rows = await get<RawCandidate[]>(`/candidates${qs(params ?? {})}`);
  return rows.map(normalizeCandidate);
}

export async function getCandidate(id: string): Promise<CandidateDetail> {
  const raw = await get<
    RawCandidate & {
      matchHistory?: RawMatch[];
      parsed_profile?: CandidateProfile | null;
    }
  >(`/candidates/${id}`);
  return {
    ...normalizeCandidate(raw),
    parsedProfile: raw.parsed_profile ?? null,
    matchHistory: (raw.matchHistory ?? []).map(normalizeMatch),
  };
}

export async function createCandidate(body: CandidateInput): Promise<Candidate> {
  const raw = await post<RawCandidate>("/candidates", candidateBody(body));
  return normalizeCandidate(raw);
}

export async function updateCandidate(
  id: string,
  body: Partial<CandidateInput>,
): Promise<Candidate> {
  const raw = await patch<RawCandidate>(`/candidates/${id}`, candidateBody(body as CandidateInput));
  return normalizeCandidate(raw);
}

export async function deleteCandidate(id: string): Promise<void> {
  await del(`/candidates/${id}`);
}

export async function uploadResume(files: File[]): Promise<CandidatePreview[]> {
  const form = new FormData();
  for (const f of files) form.append("file", f);
  const res = await fetch("/api/v1/candidates/upload-resume", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const out = (await res.json()) as { parsed_profile?: CandidateProfile; resume_key?: string }[];
  return out.map((o) => ({
    ...(o.parsed_profile ?? { skills: [] }),
    resumeKey: o.resume_key,
  }));
}

export async function listMatches(params?: MatchFilters): Promise<Match[]> {
  const rows = await get<RawMatch[]>(
    `/matches${qs({
      job_id: params?.jobId,
      candidate_id: params?.candidateId,
      stage: params?.stage,
    })}`,
  );
  return rows.map(normalizeMatch);
}

export async function getMatch(id: string): Promise<Match> {
  return normalizeMatch(await get<RawMatch>(`/matches/${id}`));
}

export async function createMatch(body: MatchInput): Promise<Match> {
  const raw = await post<RawMatch>("/matches", {
    job_id: body.jobId,
    candidate_id: body.candidateId,
    source_vendor_id: body.sourceVendorId ?? null,
  });
  return normalizeMatch(raw);
}

export async function updateMatch(
  id: string,
  body: { stage?: string; notes?: string | null },
): Promise<Match> {
  return normalizeMatch(await patch<RawMatch>(`/matches/${id}`, body));
}
