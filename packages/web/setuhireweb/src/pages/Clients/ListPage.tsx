import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createClient, getClientJobs, listClients } from "../../api/clients";
import type { Client, Job } from "../../api/types";
import { Button, EmptyState, ErrorBox, Icon, Loading, StatusPill, Table } from "../../components/ui";

export default function ClientsListPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [status, setStatus] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setClients(await listClients({ status: status || undefined, industry: industry || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, industry]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createClient({ name, industry: newIndustry || undefined });
      setName("");
      setNewIndustry("");
      setShowForm(false);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            {clients.length} client{clients.length === 1 ? "" : "s"} in your book
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          <Icon name="plus" /> {showForm ? "Cancel" : "Add Client"}
        </Button>
      </div>

      <div className="filter-bar">
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="lost">Lost</option>
        </select>
        <div className="filter-field">
          <Icon name="search" className="filter-icon" />
          <input
            placeholder="Filter by industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={{ width: 220 }}
          />
        </div>
      </div>

      {showForm && (
        <form className="card mb-4" onSubmit={submit}>
          <div className="grid cols-2">
            <div className="field">
              <label>Company Name</label>
              <input
                placeholder="e.g. Finlytics Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Industry</label>
              <input
                placeholder="e.g. Fintech, Healthcare"
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            Save Client
          </Button>
        </form>
      )}

      {error && <ErrorBox message={error} />}
      {loading ? (
        <Loading />
      ) : clients.length === 0 ? (
        <EmptyState
          icon="clients"
          title="No clients yet"
          description={
            status || industry
              ? "No clients match your filters. Try adjusting them."
              : "Add your first client to start managing jobs and placements."
          }
          action={
            !status && !industry ? (
              <Button variant="primary" onClick={() => setShowForm(true)}>
                <Icon name="plus" /> Add Your First Client
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table
          headers={["Name", "Industry", "Active Jobs", "Status", "Last Engagement"]}
          footer={
            <span>
              Showing {clients.length} client{clients.length === 1 ? "" : "s"}
            </span>
          }
        >
          {clients.map((c) => (
            <ClientRow key={c.id} client={c} />
          ))}
        </Table>
      )}
    </div>
  );
}

function ClientRow({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && jobs.length === 0) {
      setLoadingJobs(true);
      try {
        setJobs(await getClientJobs(client.id));
      } catch {
        setJobs([]);
      } finally {
        setLoadingJobs(false);
      }
    }
  }

  return (
    <>
      <tr onClick={toggle}>
        <td className="font-medium">
          <Link to={`/clients/${client.id}`} onClick={(e) => e.stopPropagation()}>
            {client.name}
          </Link>
        </td>
        <td>{client.industry ?? "—"}</td>
        <td>{client.activeJobsCount ?? client.jobsCount ?? 0}</td>
        <td>
          <StatusPill status={client.status} />
        </td>
        <td>
          {client.engagementStartDate
            ? new Date(client.engagementStartDate).toLocaleDateString()
            : "—"}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-surface-bg/50">
            {loadingJobs ? (
              <div className="muted">Loading jobs…</div>
            ) : jobs.length === 0 ? (
              <div className="muted">No jobs for this client.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      Job
                    </th>
                    <th className="px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      Status
                    </th>
                    <th className="px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      TSC
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td className="px-2 py-1">
                        <Link to={`/jobs/${j.id}`}>{j.title}</Link>
                      </td>
                      <td className="px-2 py-1">
                        <StatusPill status={j.status} />
                      </td>
                      <td className="px-2 py-1">{j.targetSellingCost ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
