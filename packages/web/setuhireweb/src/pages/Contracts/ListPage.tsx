import { useEffect, useState } from "react";
import { getExpiringContracts, listContracts } from "../../api/pipeline";
import type { Contract } from "../../api/types";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBox,
  formatInr,
  Loading,
  StatusPill,
  Table,
} from "../../components/ui";

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="page-subtitle">
            {contracts.length} contract{contracts.length === 1 ? "" : "s"} on file
          </p>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="side-by-side">
        <div>
          {loading ? (
            <Loading />
          ) : contracts.length === 0 ? (
            <EmptyState
              icon="contract"
              title="No contracts yet"
              description="Contracts will appear here once candidates are placed through your pipeline."
            />
          ) : (
            <Table
              headers={["Candidate", "Client", "Vendor", "Type", "Rate", "Start", "End", "Status"]}
              footer={
                <span>
                  Showing {contracts.length} contract
                  {contracts.length === 1 ? "" : "s"}
                </span>
              }
            >
              {contracts.map((c) => (
                <tr key={c.id} onClick={() => setSelected(c)}>
                  <td className="font-medium">{c.candidateName ?? "—"}</td>
                  <td>{c.clientName ?? "—"}</td>
                  <td>{c.vendorName ?? "—"}</td>
                  <td>{c.contractType ?? "—"}</td>
                  <td className="whitespace-nowrap text-right">{formatInr(c.rate)}</td>
                  <td className="whitespace-nowrap">
                    {c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="whitespace-nowrap">
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
            <div className="mb-3 flex items-center justify-between">
              <h3 className="m-0 font-heading text-[13px] font-semibold">Contract Details</h3>
              <Button onClick={() => setSelected(null)}>Close</Button>
            </div>
            <p className="font-medium">{selected.candidateName}</p>
            <div className="muted text-[13px]">
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
          </div>
        )}
      </div>
    </div>
  );
}
