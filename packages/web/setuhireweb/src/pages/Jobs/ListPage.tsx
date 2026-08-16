import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listJobs } from "../../api/jobs";
import { listClients } from "../../api/clients";
import type { Client, Job } from "../../api/types";
import {
  Button,
  EmptyState,
  ErrorBox,
  formatInr,
  Icon,
  Loading,
  ScoreBadge,
  StatusPill,
  Table,
  TechPills,
} from "../../components/ui";

export default function JobsListPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filters, setFilters] = useState({
    client_id: "",
    tech_stack: "",
    status: "",
    employment_type: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    listJobs({
      clientId: filters.client_id || undefined,
      techStack: filters.tech_stack || undefined,
      status: filters.status || undefined,
      employmentType: filters.employment_type || undefined,
    })
      .then(setJobs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, [filters]);

  const openCount = useMemo(
    () => jobs.filter((j) => j.status === "open").length,
    [jobs],
  );
  const clientCount = useMemo(
    () => new Set(jobs.map((j) => j.clientId).filter(Boolean)).size,
    [jobs],
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">
            {openCount} open requirement{openCount === 1 ? "" : "s"} across {clientCount}{" "}
            client{clientCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate("/jobs/new")}>
          <Icon name="plus" /> Add Job
        </Button>
      </div>

      <div className="filter-bar">
        <ClientCombobox
          clients={clients}
          value={filters.client_id}
          onChange={(id) => setFilters((f) => ({ ...f, client_id: id }))}
        />
        <div className="filter-field">
          <Icon name="search" className="filter-icon" />
          <input
            placeholder="Search by skill (e.g. React)"
            value={filters.tech_stack}
            onChange={(e) => setFilters((f) => ({ ...f, tech_stack: e.target.value }))}
            style={{ width: 200 }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="on_hold">On Hold</option>
          <option value="filled">Filled</option>
          <option value="closed">Closed</option>
        </select>
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={filters.employment_type}
          onChange={(e) => setFilters((f) => ({ ...f, employment_type: e.target.value }))}
        >
          <option value="">All types</option>
          <option value="contract">Contract</option>
          <option value="fte">Full-time</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="jobs"
          title="No jobs yet"
          description={
            filters.client_id || filters.tech_stack || filters.status || filters.employment_type
              ? "No jobs match your filters. Try adjusting them."
              : "Create your first job to start matching candidates."
          }
          action={
            !filters.client_id && !filters.tech_stack && !filters.status && !filters.employment_type ? (
              <Button variant="primary" onClick={() => navigate("/jobs/new")}>
                <Icon name="plus" /> Add Your First Job
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table
          headers={["Title", "Client", "Skills", "Experience", "Target Cost", "Status", "Top Match", "Pipeline"]}
          footer={
            <span>
              Showing {jobs.length} job{jobs.length === 1 ? "" : "s"}
            </span>
          }
        >
          {jobs.map((j) => (
            <tr key={j.id} onClick={() => navigate(`/jobs/${j.id}`)}>
              <td className="font-medium text-ink-900">{j.title}</td>
              <td>
                <span title={j.clientId}>{j.clientName ?? "—"}</span>
              </td>
              <td>
                <TechPills items={j.techStack} />
              </td>
              <td className="whitespace-nowrap">{j.experienceRequired ?? "—"}</td>
              <td className="whitespace-nowrap text-right">{formatInr(j.targetSellingCost)}</td>
              <td>
                <StatusPill status={j.status} />
              </td>
              <td>
                <ScoreBadge score={j.topMatchScore} />
              </td>
              <td className="whitespace-nowrap text-right">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-600">
                  <Icon name="users" />
                  {j.candidatesCount ?? 0} candidate
                  {(j.candidatesCount ?? 0) === 1 ? "" : "s"}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function ClientCombobox({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = clients.find((c) => c.id === value);
  const filtered = clients.filter(
    (c) => !query || c.name.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <div className="filter-field">
        <Icon name="search" className="filter-icon" />
        <input
          placeholder="Filter by client"
          value={open ? query : selected?.name ?? ""}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          style={{ width: 220 }}
        />
      </div>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-72 overflow-auto rounded-md border border-surface-border bg-white py-1 shadow-card">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[13px] text-ink-600 hover:bg-surface-bg"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            All clients
          </button>
          {filtered.map((c) => (
            <button
              type="button"
              key={c.id}
              className="block w-full px-3 py-2 text-left text-[13px] text-ink-900 hover:bg-surface-bg"
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
            >
              {c.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-ink-400">No clients found</div>
          )}
        </div>
      )}
    </div>
  );
}
