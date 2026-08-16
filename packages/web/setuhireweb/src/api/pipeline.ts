import { del, get, patch, post, qs } from "./client";
import type { Contract, FinanceRecord, Interview } from "./types";

export type InterviewFilters = {
  jobId?: string;
  candidateId?: string;
  clientId?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type InterviewInput = {
  matchId: string;
  round?: string | null;
  interviewer?: string | null;
  scheduledAt?: string | null;
};

export type ContractFilters = {
  clientId?: string;
  vendorId?: string;
  status?: string;
};

export type ContractInput = {
  matchId: string;
  contractType: string;
  rate?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  documentUrl?: string | null;
};

export type FinanceRecordInput = {
  matchId: string;
  clientBillingAmount?: number | null;
  vendorPayoutAmount?: number | null;
  billingStatus?: string;
  period?: string | null;
};

export async function listInterviews(params?: InterviewFilters): Promise<Interview[]> {
  return get<Interview[]>(
    `/interviews${qs({
      job_id: params?.jobId,
      candidate_id: params?.candidateId,
      client_id: params?.clientId,
      status: params?.status,
      from: params?.from,
      to: params?.to,
    })}`,
  );
}

export async function createInterview(body: InterviewInput): Promise<Interview> {
  return post<Interview>("/interviews", {
    match_id: body.matchId,
    round: body.round ?? null,
    interviewer: body.interviewer ?? null,
    scheduled_at: body.scheduledAt ?? null,
  });
}

export async function updateInterview(
  id: string,
  body: { status?: string; feedback?: string | null; scheduledAt?: string | null },
): Promise<Interview> {
  return patch<Interview>(`/interviews/${id}`, {
    status: body.status,
    feedback: body.feedback ?? null,
    scheduled_at: body.scheduledAt ?? null,
  });
}

export async function deleteInterview(id: string): Promise<void> {
  await del(`/interviews/${id}`);
}

export async function listContracts(params?: ContractFilters): Promise<Contract[]> {
  return get<Contract[]>(
    `/contracts${qs({
      client_id: params?.clientId,
      vendor_id: params?.vendorId,
      status: params?.status,
    })}`,
  );
}

export async function getContract(id: string): Promise<Contract> {
  return get<Contract>(`/contracts/${id}`);
}

export async function createContract(body: ContractInput): Promise<Contract> {
  return post<Contract>("/contracts", {
    match_id: body.matchId,
    contract_type: body.contractType,
    rate: body.rate ?? null,
    start_date: body.startDate ?? null,
    end_date: body.endDate ?? null,
    document_url: body.documentUrl ?? null,
  });
}

export async function updateContract(
  id: string,
  body: Partial<ContractInput> & { status?: string },
): Promise<Contract> {
  return patch<Contract>(`/contracts/${id}`, {
    contract_type: body.contractType,
    rate: body.rate ?? null,
    start_date: body.startDate ?? null,
    end_date: body.endDate ?? null,
    document_url: body.documentUrl ?? null,
    status: body.status,
  });
}

export async function getExpiringContracts(days?: number): Promise<Contract[]> {
  return get<Contract[]>(`/contracts/expiring${qs({ days: days ?? 30 })}`);
}

export async function financeRecords(params?: {
  clientId?: string;
  vendorId?: string;
  month?: string;
  billingStatus?: string;
}): Promise<FinanceRecord[]> {
  return get<FinanceRecord[]>(
    `/finance/records${qs({
      client_id: params?.clientId,
      vendor_id: params?.vendorId,
      month: params?.month,
      billing_status: params?.billingStatus,
    })}`,
  );
}

export async function createFinanceRecord(body: FinanceRecordInput): Promise<FinanceRecord> {
  return post<FinanceRecord>("/finance/records", {
    match_id: body.matchId,
    client_billing_amount: body.clientBillingAmount ?? null,
    vendor_payout_amount: body.vendorPayoutAmount ?? null,
    billing_status: body.billingStatus,
    period: body.period ?? null,
  });
}

export async function updateFinanceRecord(
  id: string,
  body: Partial<FinanceRecordInput>,
): Promise<FinanceRecord> {
  return patch<FinanceRecord>(`/finance/records/${id}`, {
    match_id: body.matchId,
    client_billing_amount: body.clientBillingAmount ?? null,
    vendor_payout_amount: body.vendorPayoutAmount ?? null,
    billing_status: body.billingStatus,
    period: body.period ?? null,
  });
}

export async function financeSummary(month?: string): Promise<{
  totalRevenue: number;
  totalCommission: number;
  pendingReceivables: number;
  pendingVendorPayouts: number;
}> {
  return get(`/finance/summary${qs({ month })}`);
}

export async function financeExport(format?: string, month?: string): Promise<string> {
  const res = await fetch(`/api/v1/finance/export${qs({ format, month })}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.text();
}
