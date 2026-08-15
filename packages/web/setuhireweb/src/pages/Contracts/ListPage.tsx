import { useEffect, useState } from "react";
import { getExpiringContracts, listContracts } from "../../api/pipeline";
import type { Contract } from "../../api/types";
import { Badge, ErrorBox, formatInr, Loading, StatusPill, Table } from "../../components/ui";

export default function ContractsListPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [expiringIds, setExpiringIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([listContracts(), getExpiringContracts(30).catch(() => [])])
      .then(([list, expiring]) => {
        setContracts(list);
        setExpiringIds(new Set(expiring.map((c) => c.id)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load contracts"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="page-title">Contracts</h1>
      {error && <ErrorBox message={error} />}

      <div className="side-by-side">
        <div>
          {loading ? (
            <Loading />
          ) : (
            <Table
              headers={["Candidate", "Client", "Vendor", "Type", "Rate", "Start", "End", "Status"]}
            >
              {contracts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{c.candidateName ?? "—"}</td>
                  <td>{c.clientName ?? "—"}</td>
                  <td>{c.vendorName ?? "—"}</td>
                  <td>{c.contractType ?? "—"}</td>
                  <td>{formatInr(c.rate)}</td>
                  <td>{c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"}</td>
                  <td>
                    {c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}
                    {expiringIds.has(c.id) && <Badge tone="red">Expiring</Badge>}
                  </td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        {selected && (
          <div className="panel" style={{ alignSelf: "start" }}>
            <h3>Contract Details</h3>
            <p>
              <strong>{selected.candidateName}</strong>
            </p>
            <div className="muted">
              <div>Client: {selected.clientName ?? "—"}</div>
              <div>Vendor: {selected.vendorName ?? "—"}</div>
              <div>Type: {selected.contractType ?? "—"}</div>
              <div>Rate: {formatInr(selected.rate)}</div>
              <div>
                Term:{" "}
                {selected.startDate
                  ? new Date(selected.startDate).toLocaleDateString()
                  : "—"}{" "}
                →{" "}
                {selected.endDate ? new Date(selected.endDate).toLocaleDateString() : "—"}
              </div>
              <div>
                Document:{" "}
                {selected.documentUrl ? (
                  <span>{selected.documentUrl}</span>
                ) : (
                  <span className="muted">No document on file</span>
                )}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ marginTop: "0.75rem" }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
