/**
 * Seed database from repo-root `docs/*.csv`.
 *
 * - CSV ids are strings (`c1`, `cand1`, `m1`…); schema ids are uuid. Each CSV id
 *   is mapped to a deterministic UUID (SHA-1 based, UUIDv5-style) so FK
 *   references stay consistent across tables.
 * - `users.csv` passwords are bcrypt-hashed; plaintext is never stored.
 * - Column names in CSVs are snake_case; mapped to Drizzle camelCase columns.
 * - Missing columns (e.g. `parsed_requirements`, `parsed_profile`, `raw_jd_text`)
 *   are left NULL.
 * - All inserts run inside a single transaction. Row counts logged per table.
 *
 * Re-runnable: run `pnpm db:reset` first (drops + pushes + seeds).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import Papa from "papaparse";
import { db, pool } from "./client.js";
import {
  candidates,
  clients,
  contracts,
  financeRecords,
  interviews,
  jobCandidateMatches,
  jobVendorAssignments,
  jobs,
  users,
  vendors,
} from "./schema.js";

const DOCS_DIR = fileURLToPath(new URL("../../../../../docs/", import.meta.url));
const NAMESPACE = Buffer.from("d0b1d0d0-c0de-4e57-b00b-5eedc0ffee00", "utf8");

type Row = Record<string, string | undefined>;

function parseCsv(file: string): Row[] {
  const result = Papa.parse<Row>(readFileSync(file, "utf8"), {
    header: true,
    skipEmptyLines: true,
  });
  const fatal = result.errors.filter((e) => !e.message.startsWith("Too few fields"));
  if (fatal.length > 0) {
    throw new Error(`CSV parse error in ${file}: ${fatal[0]?.message}`);
  }
  return result.data.filter((row) => row.id?.trim());
}

function uuidFrom(scope: string, id: string): string {
  const hash = createHash("sha1");
  hash.update(NAMESPACE);
  hash.update(`${scope}:${id}`, "utf8");
  const bytes = Buffer.from(hash.digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const num = (v: string | undefined): string | null => {
  if (v === undefined || v === null || v.trim() === "") return null;
  return Number.isNaN(Number(v)) ? null : v.trim();
};

const dateOrNull = (v: string | undefined): Date | null => {
  if (v === undefined || v === null || v.trim() === "") return null;
  const d = new Date(v.trim().replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

const listOrEmpty = (v: string | undefined): string[] =>
  v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

async function main() {
  const mapping = new Map<string, string>();
  const map = (scope: string, id: string) => {
    const uuid = uuidFrom(scope, id);
    mapping.set(`${scope}:${id}`, uuid);
    return uuid;
  };

  const usersCsv = parseCsv(`${DOCS_DIR}users.csv`);
  const clientsCsv = parseCsv(`${DOCS_DIR}clients.csv`);
  const vendorsCsv = parseCsv(`${DOCS_DIR}vendors.csv`);
  const jobsCsv = parseCsv(`${DOCS_DIR}jobs.csv`);
  const assignmentsCsv = parseCsv(`${DOCS_DIR}job_vendor_assignments.csv`);
  const candidatesCsv = parseCsv(`${DOCS_DIR}candidates.csv`);
  const matchesCsv = parseCsv(`${DOCS_DIR}job_candidate_matches.csv`);
  const interviewsCsv = parseCsv(`${DOCS_DIR}interviews.csv`);
  const contractsCsv = parseCsv(`${DOCS_DIR}contracts.csv`);
  const financeCsv = parseCsv(`${DOCS_DIR}finance_records.csv`);

  const counts = await db.transaction(async (tx) => {
    // 1. users (passwords hashed, never plaintext)
    for (const row of usersCsv) {
      const id = map("users", row.id!);
      await tx.insert(users).values({
        id,
        email: row.email!.trim(),
        passwordHash: await bcrypt.hash(row.password_plaintext_for_seed_only ?? "", 10),
        name: row.name!,
        role: row.role?.trim() ?? "recruiter",
      });
    }

    // 2. clients
    for (const row of clientsCsv) {
      const id = map("clients", row.id!);
      await tx.insert(clients).values({
        id,
        name: row.name!,
        industry: row.industry ?? null,
        contactPerson: row.contact_person ?? null,
        contactEmail: row.contact_email ?? null,
        contactPhone: row.contact_phone ?? null,
        status: (row.status ?? "active") as "active" | "on_hold" | "lost",
        engagementStartDate: dateOrNull(row.engagement_start_date),
      });
    }

    // 3. vendors
    for (const row of vendorsCsv) {
      const id = map("vendors", row.id!);
      await tx.insert(vendors).values({
        id,
        name: row.name!,
        specialization: listOrEmpty(row.specialization),
        contactPerson: row.contact_person ?? null,
        contactEmail: row.contact_email ?? null,
        contactPhone: row.contact_phone ?? null,
        status: (row.status ?? "active") as "active" | "preferred" | "blacklisted",
        rateNotes: row.rate_notes ?? null,
      });
    }

    // 4. jobs
    for (const row of jobsCsv) {
      const id = map("jobs", row.id!);
      await tx.insert(jobs).values({
        id,
        clientId: map("clients", row.client_id!),
        title: row.title!,
        techStack: listOrEmpty(row.tech_stack),
        experienceRequired: row.experience_required ?? null,
        targetSellingCost: num(row.target_selling_cost),
        currency: row.currency?.trim() ?? "INR",
        employmentType: (row.employment_type ?? "contract") as "fte" | "contract",
        status: (row.status ?? "open") as "open" | "on_hold" | "filled" | "closed",
        description: row.description ?? null,
      });
    }

    // 5. job_vendor_assignments
    for (const row of assignmentsCsv) {
      const id = map("job_vendor_assignments", row.id!);
      await tx.insert(jobVendorAssignments).values({
        id,
        jobId: map("jobs", row.job_id!),
        vendorId: map("vendors", row.vendor_id!),
        sourcingCost: num(row.sourcing_cost),
        assignedAt: dateOrNull(row.assigned_at),
      });
    }

    // 6. candidates
    for (const row of candidatesCsv) {
      const id = map("candidates", row.id!);
      await tx.insert(candidates).values({
        id,
        name: row.name!,
        email: row.email ?? null,
        phone: row.phone ?? null,
        skills: listOrEmpty(row.skills),
        experienceYears: num(row.experience_years),
        currentStatus: (row.current_status ?? "available") as "available" | "engaged" | "not_looking",
        sourceType: (row.source_type ?? "direct") as "direct" | "vendor",
        sourceVendorId: row.source_vendor_id ? map("vendors", row.source_vendor_id) : null,
        rateExpectation: num(row.rate_expectation),
        resumeUrl: row.resume_url ?? null,
      });
    }

    // 7. job_candidate_matches
    for (const row of matchesCsv) {
      const id = map("job_candidate_matches", row.id!);
      await tx.insert(jobCandidateMatches).values({
        id,
        jobId: map("jobs", row.job_id!),
        candidateId: map("candidates", row.candidate_id!),
        sourceVendorId: row.source_vendor_id ? map("vendors", row.source_vendor_id) : null,
        matchScore: num(row.match_score),
        matchRationale: row.match_rationale ?? null,
        stage: (row.stage ?? "applied") as "applied" | "screened" | "interview" | "offer" | "placed" | "rejected",
      });
    }

    // 8. interviews
    for (const row of interviewsCsv) {
      const id = map("interviews", row.id!);
      await tx.insert(interviews).values({
        id,
        matchId: map("job_candidate_matches", row.match_id!),
        round: row.round ?? null,
        interviewer: row.interviewer ?? null,
        scheduledAt: dateOrNull(row.scheduled_at),
        status: (row.status ?? "scheduled") as "scheduled" | "cleared" | "rejected" | "no_show",
        feedback: row.feedback || null,
      });
    }

    // 9. contracts
    for (const row of contractsCsv) {
      const id = map("contracts", row.id!);
      await tx.insert(contracts).values({
        id,
        matchId: map("job_candidate_matches", row.match_id!),
        contractType: row.contract_type as "candidate_vendor" | "vendor_client" | "direct",
        rate: num(row.rate),
        startDate: dateOrNull(row.start_date),
        endDate: dateOrNull(row.end_date),
        documentUrl: row.document_url ?? null,
        status: (row.status ?? "active") as "active" | "expired" | "terminated",
      });
    }

    // 10. finance_records
    for (const row of financeCsv) {
      const id = map("finance_records", row.id!);
      await tx.insert(financeRecords).values({
        id,
        matchId: map("job_candidate_matches", row.match_id!),
        clientBillingAmount: num(row.client_billing_amount),
        vendorPayoutAmount: num(row.vendor_payout_amount),
        commission: num(row.commission),
        billingStatus: (row.billing_status ?? "pending") as "invoiced" | "payment_received" | "pending",
        period: row.period ?? null,
      });
    }

    return {
      users: usersCsv.length,
      clients: clientsCsv.length,
      vendors: vendorsCsv.length,
      jobs: jobsCsv.length,
      job_vendor_assignments: assignmentsCsv.length,
      candidates: candidatesCsv.length,
      job_candidate_matches: matchesCsv.length,
      interviews: interviewsCsv.length,
      contracts: contractsCsv.length,
      finance_records: financeCsv.length,
    };
  });

  console.log("Seeded rows per table:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }

  console.log("\nCSV id -> UUID mapping (in-memory, deterministic):");
  for (const [key, uuid] of mapping) {
    console.log(`  ${key} -> ${uuid}`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
