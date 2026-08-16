import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCandidates } from "../../api/candidates";
import type { Candidate } from "../../api/types";
import {
  Button,
  EmptyState,
  ErrorBox,
  formatInr,
  Icon,
  Loading,
  StatusPill,
  Table,
  TechPills,
} from "../../components/ui";

export default function CandidatesListPage() {
  const navigate = useNavigate();
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidates</h1>
          <p className="page-subtitle">
            {candidates.length} candidate{candidates.length === 1 ? "" : "s"} in your talent pool
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate("/candidates/new")}>
          <Icon name="plus" /> Add Candidate
        </Button>
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <Icon name="search" className="filter-icon" />
          <input
            placeholder="Filter by skill"
            value={filters.skill}
            onChange={(e) => setFilters((f) => ({ ...f, skill: e.target.value }))}
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
          <option value="available">Available</option>
          <option value="engaged">Engaged</option>
          <option value="not_looking">Not Looking</option>
        </select>
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={filters.source}
          onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
        >
          <option value="">All sources</option>
          <option value="direct">Direct</option>
          <option value="vendor">Vendor</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <Loading />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon="candidate"
          title="No candidates yet"
          description={
            filters.skill || filters.status || filters.source
              ? "No candidates match your filters. Try adjusting them."
              : "Add your first candidate or upload resumes to build your talent pool."
          }
          action={
            !filters.skill && !filters.status && !filters.source ? (
              <Button variant="primary" onClick={() => navigate("/candidates/new")}>
                <Icon name="plus" /> Add Your First Candidate
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table
          headers={["Name", "Skills", "Experience", "Status", "Source", "Rate"]}
          footer={
            <span>
              Showing {candidates.length} candidate
              {candidates.length === 1 ? "" : "s"}
            </span>
          }
        >
          {candidates.map((c) => (
            <tr key={c.id} onClick={() => navigate(`/candidates/${c.id}`)}>
              <td className="font-medium">{c.name}</td>
              <td>
                <TechPills items={c.skills} />
              </td>
              <td className="whitespace-nowrap">{c.experienceYears ?? "—"} yrs</td>
              <td>
                <StatusPill status={c.currentStatus} />
              </td>
              <td>{c.sourceType === "vendor" ? c.sourceVendorName ?? "Vendor" : "Direct"}</td>
              <td className="whitespace-nowrap text-right">{formatInr(c.rateExpectation)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
