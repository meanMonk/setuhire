import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCandidates } from "../../api/candidates";
import type { Candidate } from "../../api/types";
import { Button, ErrorBox, formatInr, Loading, StatusPill, Table, Tags } from "../../components/ui";

export default function CandidatesListPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filters, setFilters] = useState({ skill: "", status: "", source: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    listCandidates({
      skill: filters.skill || undefined,
      status: filters.status || undefined,
      source: filters.source || undefined,
    })
      .then(setCandidates)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load candidates"))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title">Candidates</h1>
        <Link to="/candidates/new">
          <Button variant="primary">+ Add Candidate</Button>
        </Link>
      </div>

      <div className="toolbar">
        <input
          placeholder="Filter by skill"
          value={filters.skill}
          onChange={(e) => setFilters({ ...filters, skill: e.target.value })}
          style={{ maxWidth: 180 }}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          style={{ width: "auto" }}
        >
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="engaged">Engaged</option>
          <option value="not_looking">Not Looking</option>
        </select>
        <select
          value={filters.source}
          onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          style={{ width: "auto" }}
        >
          <option value="">All sources</option>
          <option value="direct">Direct</option>
          <option value="vendor">Vendor</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <Loading />
      ) : (
        <Table headers={["Name", "Skills", "Experience", "Status", "Source", "Rate"]}>
          {candidates.map((c) => (
            <tr key={c.id}>
              <td>
                <Link to={`/candidates/${c.id}`}>{c.name}</Link>
              </td>
              <td>
                <Tags items={c.skills} />
              </td>
              <td>{c.experienceYears ?? "—"} yrs</td>
              <td>
                <StatusPill status={c.currentStatus} />
              </td>
              <td>{c.sourceType === "vendor" ? c.sourceVendorName ?? "Vendor" : "Direct"}</td>
              <td>{formatInr(c.rateExpectation)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
