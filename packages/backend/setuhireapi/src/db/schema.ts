import {
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const employmentTypeEnum = pgEnum("employment_type", ["fte", "contract"]);
export const jobStatusEnum = pgEnum("job_status", ["open", "on_hold", "filled", "closed"]);
export const clientStatusEnum = pgEnum("client_status", ["active", "on_hold", "lost"]);
export const vendorStatusEnum = pgEnum("vendor_status", ["active", "preferred", "blacklisted"]);
export const candidateStatusEnum = pgEnum("candidate_status", ["available", "engaged", "not_looking"]);
export const pipelineStageEnum = pgEnum("pipeline_stage", ["applied", "screened", "interview", "offer", "placed", "rejected"]);
export const interviewStatusEnum = pgEnum("interview_status", ["scheduled", "cleared", "rejected", "no_show"]);
export const contractTypeEnum = pgEnum("contract_type", ["candidate_vendor", "vendor_client", "direct"]);
export const contractStatusEnum = pgEnum("contract_status", ["active", "expired", "terminated"]);
export const billingStatusEnum = pgEnum("billing_status", ["invoiced", "payment_received", "pending"]);
export const sourceTypeEnum = pgEnum("source_type", ["direct", "vendor"]);

export type ParsedRequirements = {
  must_have_skills?: string[];
  nice_to_have_skills?: string[];
  min_experience?: number | null;
  max_experience?: number | null;
};

export type ParsedProfile = {
  skills?: string[];
  experience_years?: number | null;
  roles?: { title: string; company: string; duration?: string; tech?: string[] }[];
  education?: string;
  certifications?: string[];
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("recruiter"), // admin | recruiter | ceo
  createdAt: timestamp("created_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 150 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  status: clientStatusEnum("status").default("active"),
  engagementStartDate: timestamp("engagement_start_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientNotes = pgTable("client_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").references(() => clients.id),
  note: text("note").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  specialization: jsonb("specialization").$type<string[]>().default([]),
  contactPerson: varchar("contact_person", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  status: vendorStatusEnum("status").default("active"),
  rateNotes: text("rate_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  techStack: jsonb("tech_stack").$type<string[]>().default([]),
  experienceRequired: varchar("experience_required", { length: 50 }), // e.g. "6+ years"
  targetSellingCost: numeric("target_selling_cost", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("INR"),
  employmentType: employmentTypeEnum("employment_type").default("contract"),
  status: jobStatusEnum("status").default("open"),
  description: text("description"),
  rawJdText: text("raw_jd_text"),
  sourceUrl: text("source_url"),
  parsedRequirements: jsonb("parsed_requirements").$type<ParsedRequirements | null>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobVendorAssignments = pgTable("job_vendor_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id).notNull(),
  sourcingCost: numeric("sourcing_cost", { precision: 12, scale: 2 }),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  skills: jsonb("skills").$type<string[]>().default([]),
  experienceYears: numeric("experience_years", { precision: 4, scale: 1 }),
  currentStatus: candidateStatusEnum("current_status").default("available"),
  sourceType: sourceTypeEnum("source_type").default("direct"),
  sourceVendorId: uuid("source_vendor_id").references(() => vendors.id),
  rateExpectation: numeric("rate_expectation", { precision: 12, scale: 2 }),
  resumeUrl: text("resume_url"),
  parsedProfile: jsonb("parsed_profile").$type<ParsedProfile | null>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobCandidateMatches = pgTable("job_candidate_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  candidateId: uuid("candidate_id").references(() => candidates.id).notNull(),
  sourceVendorId: uuid("source_vendor_id").references(() => vendors.id),
  matchScore: numeric("match_score", { precision: 5, scale: 2 }),
  matchRationale: text("match_rationale"),
  stage: pipelineStageEnum("stage").default("applied"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => jobCandidateMatches.id).notNull(),
  round: varchar("round", { length: 50 }), // L1 | L2 | Client
  interviewer: varchar("interviewer", { length: 255 }),
  scheduledAt: timestamp("scheduled_at"),
  status: interviewStatusEnum("status").default("scheduled"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => jobCandidateMatches.id).notNull(),
  contractType: contractTypeEnum("contract_type").notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  documentUrl: text("document_url"),
  status: contractStatusEnum("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financeRecords = pgTable("finance_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => jobCandidateMatches.id).notNull(),
  clientBillingAmount: numeric("client_billing_amount", { precision: 12, scale: 2 }),
  vendorPayoutAmount: numeric("vendor_payout_amount", { precision: 12, scale: 2 }),
  commission: numeric("commission", { precision: 12, scale: 2 }), // computed = billing - payout
  billingStatus: billingStatusEnum("billing_status").default("pending"),
  period: varchar("period", { length: 20 }), // "2026-08"
  createdAt: timestamp("created_at").defaultNow(),
});
