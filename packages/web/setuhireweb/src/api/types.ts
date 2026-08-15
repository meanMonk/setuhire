export type Client = {
  id: string;
  name: string;
  industry?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: string | null;
  engagementStartDate?: string | null;
  jobsCount?: number;
  activeJobsCount?: number;
};

export type Job = {
  id: string;
  clientId?: string;
  clientName?: string;
  title: string;
  techStack?: string[] | null;
  experienceRequired?: string | null;
  targetSellingCost?: number | string | null;
  currency?: string | null;
  employmentType?: string | null;
  status?: string | null;
  description?: string | null;
  topMatchScore?: number | null;
  candidatesCount?: number;
  pipelineSummary?: { stage: string; count: number }[];
  vendorAssignments?: VendorAssignment[];
};

export type VendorAssignment = {
  id?: string;
  jobId?: string;
  vendorId?: string;
  vendorName?: string;
  vendorStatus?: string;
  sourcingCost?: number | string | null;
};

export type Candidate = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  skills?: string[] | null;
  experienceYears?: number | string | null;
  currentStatus?: string | null;
  sourceType?: string | null;
  sourceVendorName?: string | null;
  rateExpectation?: number | string | null;
  resumeUrl?: string | null;
};

export type Vendor = {
  id: string;
  name: string;
  specialization?: string[] | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: string | null;
  rateNotes?: string | null;
  activeSubmissions?: number;
  placedCount?: number;
};

export type Match = {
  id?: string;
  jobId?: string;
  candidateId?: string;
  candidate?: Candidate;
  candidateName?: string;
  jobTitle?: string;
  score?: number | null;
  matchScore?: number | null;
  rationale?: string | null;
  matchRationale?: string | null;
  stage?: string | null;
  notes?: string | null;
  source?: string | null;
  keySkillsOverlap?: string[];
  rateFit?: "ok" | "above_tsc" | string | null;
  priority?: boolean;
};

export type Interview = {
  id: string;
  matchId?: string;
  candidateName?: string;
  jobTitle?: string;
  clientName?: string;
  round?: string | null;
  interviewer?: string | null;
  scheduledAt?: string | null;
  status?: string | null;
  feedback?: string | null;
};

export type Contract = {
  id: string;
  matchId?: string;
  candidateName?: string;
  clientName?: string;
  vendorName?: string | null;
  contractType?: string | null;
  rate?: number | string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  documentUrl?: string | null;
};

export type FinanceRecord = {
  id: string;
  matchId?: string;
  candidateName?: string;
  clientName?: string;
  jobTitle?: string;
  employmentType?: string | null;
  clientBillingAmount?: number | string | null;
  vendorPayoutAmount?: number | string | null;
  commission?: number | string | null;
  billingStatus?: string | null;
  period?: string | null;
};

export type JobPreview = {
  title: string;
  skills: { must_have: string[]; nice_to_have: string[] };
  min_experience?: number | null;
  max_experience?: number | null;
  employment_type?: "fte" | "contract" | null;
  seniority?: string | null;
};

export type CandidateProfile = {
  skills: string[];
  experience_years?: number | null;
  roles?: { title: string; company: string; duration?: string; tech?: string[] }[];
  education?: string;
  certifications?: string[];
};

export type CandidateDetail = Candidate & {
  parsedProfile?: CandidateProfile | null;
  matchHistory?: Match[];
};

export type DashboardSummary = {
  activeClients?: number;
  openJobs?: number;
  candidatesAvailable?: number;
  vendorsEngaged?: number;
  interviewsThisWeek?: number;
  pendingBillingAmount?: number;
};

export type AttentionFeedItem = {
  type?: "match" | "vendor" | "interview" | string;
  message: string;
  link?: string;
};

export type ActivityLogItem = {
  actor?: string | null;
  candidate?: string | null;
  job?: string | null;
  from?: string | null;
  to?: string | null;
  at?: string | null;
};
