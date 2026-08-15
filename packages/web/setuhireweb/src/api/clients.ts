import { del, get, patch, post, qs } from "./client";
import type { Client, Job } from "./types";

export type ClientFilters = {
  status?: string;
  industry?: string;
};

export type ClientInput = {
  name: string;
  industry?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: string | null;
};

export type ClientDetail = Client & {
  jobs?: Job[];
  resourcesHired?: {
    matchId?: string;
    matchScore?: number | null;
    stage?: string | null;
    candidateId?: string;
    candidateName?: string;
    jobId?: string;
    jobTitle?: string;
    employmentType?: string | null;
  }[];
  engagementHistory?: {
    id: string;
    note: string;
    createdAt?: string | null;
    createdByName?: string | null;
  }[];
};

const clientBody = (body: Partial<ClientInput>) => ({
  name: body.name,
  industry: body.industry ?? null,
  contact_person: body.contactPerson ?? null,
  contact_email: body.contactEmail ?? null,
  contact_phone: body.contactPhone ?? null,
  status: body.status,
});

export async function listClients(params?: ClientFilters): Promise<Client[]> {
  return get<Client[]>(
    `/clients${qs({ status: params?.status, industry: params?.industry })}`,
  );
}

export async function getClient(id: string): Promise<ClientDetail> {
  return get<ClientDetail>(`/clients/${id}`);
}

export async function getClientJobs(id: string): Promise<Job[]> {
  return get<Job[]>(`/clients/${id}/jobs`);
}

export async function createClient(body: ClientInput): Promise<Client> {
  return post<Client>("/clients", clientBody(body));
}

export async function updateClient(id: string, body: Partial<ClientInput>): Promise<Client> {
  return patch<Client>(`/clients/${id}`, clientBody(body));
}

export async function deleteClient(id: string): Promise<void> {
  await del(`/clients/${id}`);
}

export async function addClientNote(id: string, note: string): Promise<unknown> {
  return post(`/clients/${id}/notes`, { note });
}
