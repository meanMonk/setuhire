import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createClient, getClientJobs, listClients } from "../../api/clients";
import type { Client, Job } from "../../api/types";
import { Button, ErrorBox, Loading, StatusPill, Table } from "../../components/ui";

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
      <div className="toolbar">
        <h1 className="page-title">Clients</h1>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add Client"}
        </Button>
      </div>

      <div className="toolbar">
        <div className="row">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="lost">Lost</option>
          </select>
          <input
            placeholder="Filter by industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={{ maxWidth: 220 }}
          />
        </div>
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="grid cols-2">
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Industry</label>
              <input value={newIndustry} onChange={(e) => setNewIndustry(e.target.value)} />
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
      ) : (
        <Table headers={["Name", "Industry", "Active Jobs", "Status", "Last Engagement"]}>
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
      <tr onClick={toggle} style={{ cursor: "pointer" }}>
        <td>
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
          <td colSpan={5} style={{ background: "#fafbfc" }}>
            {loadingJobs ? (
              <div className="muted">Loading jobs…</div>
            ) : jobs.length === 0 ? (
              <div className="muted">No jobs for this client.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Status</th>
                    <th>TSC</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <Link to={`/jobs/${j.id}`}>{j.title}</Link>
                      </td>
                      <td>
                        <StatusPill status={j.status} />
                      </td>
                      <td>{j.targetSellingCost ?? "—"}</td>
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
