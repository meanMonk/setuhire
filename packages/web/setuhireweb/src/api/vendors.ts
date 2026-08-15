import { del, get, patch, post, qs } from "./client";
import type { Candidate, Vendor } from "./types";

export type VendorFilters = {
  status?: string;
  specialization?: string;
};

export type VendorInput = {
  name: string;
  specialization?: string[];
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: string | null;
  rateNotes?: string | null;
};

export type VendorPerformance = {
  submissions?: number;
  shortlisted?: number;
  placed?: number;
  ratio?: number;
};

export type VendorDetail = Vendor & {
  resourcesSupplied?: {
    matchId?: string;
    matchScore?: number | null;
    stage?: string | null;
    candidateId?: string;
    candidateName?: string;
    jobId?: string;
    jobTitle?: string;
    employmentType?: string | null;
  }[];
  performanceStats?: VendorPerformance;
};

const vendorBody = (body: Partial<VendorInput>) => ({
  name: body.name,
  specialization: body.specialization ?? [],
  contact_person: body.contactPerson ?? null,
  contact_email: body.contactEmail ?? null,
  contact_phone: body.contactPhone ?? null,
  status: body.status,
  rate_notes: body.rateNotes ?? null,
});

export async function listVendors(params?: VendorFilters): Promise<Vendor[]> {
  return get<Vendor[]>(
    `/vendors${qs({ status: params?.status, specialization: params?.specialization })}`,
  );
}

export async function getVendor(id: string): Promise<VendorDetail> {
  return get<VendorDetail>(`/vendors/${id}`);
}

export async function getVendorCandidates(id: string): Promise<Candidate[]> {
  return get<Candidate[]>(`/vendors/${id}/candidates`);
}

export async function getVendorPerformance(id: string): Promise<VendorPerformance> {
  return get<VendorPerformance>(`/vendors/${id}/performance`);
}

export async function createVendor(body: VendorInput): Promise<Vendor> {
  return post<Vendor>("/vendors", vendorBody(body));
}

export async function updateVendor(id: string, body: Partial<VendorInput>): Promise<Vendor> {
  return patch<Vendor>(`/vendors/${id}`, vendorBody(body));
}

export async function deleteVendor(id: string): Promise<void> {
  await del(`/vendors/${id}`);
}
