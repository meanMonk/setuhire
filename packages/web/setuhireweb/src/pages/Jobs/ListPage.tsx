import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listJobs } from "../../api/jobs";
import type { Job } from "../../api/types";
import { Button, ErrorBox, formatInr, Loading, StatusPill, Table, Tags } from "../../components/ui";

export default function JobsListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState({
    client_id: "",
    tech_stack: "",
    status: "",
    employment_type: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">Jobs</h1>
        <Link to="/jobs/new">
          <Button variant="primary">+ Add Job</Button>
        </Link>
      </div>

      <div className="toolbar">
        <input
          placeholder="Client id"
          value={filters.client_id}
          onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
          style={{ maxWidth: 160 }}
        />
        <input
          placeholder="Tech stack"
          value={filters.tech_stack}
          onChange={(e) => setFilters({ ...filters, tech_stack: e.target.value })}
          style={{ maxWidth: 180 }}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          style={{ width: "auto" }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="on_hold">On Hold</option>
          <option value="filled">Filled</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={filters.employment_type}
          onChange={(e) => setFilters({ ...filters, employment_type: e.target.value })}
          style={{ width: "auto" }}
        >
          <option value="">All types</option>
          <option value="contract">Contract</option>
          <option value="fte">FTE</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <Loading />
      ) : (
        <Table
          headers={["Title", "Client", "Tech Stack", "Experience", "TSC", "Status", "Top Match", "Pipeline"]}
        >
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <Link to={`/jobs/${j.id}`}>{j.title}</Link>
              </td>
              <td>{j.clientName ?? j.clientId ?? "—"}</td>
              <td>
                <Tags items={j.techStack} />
              </td>
              <td>{j.experienceRequired ?? "—"}</td>
              <td>{formatInr(j.targetSellingCost)}</td>
              <td>
                <StatusPill status={j.status} />
              </td>
              <td>{j.topMatchScore != null ? `${j.topMatchScore}%` : "—"}</td>
              <td>{j.candidatesCount ?? 0}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
