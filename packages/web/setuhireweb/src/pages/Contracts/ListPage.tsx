import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createContract, listContracts, updateContract } from "../../api/pipeline";
import { listClients } from "../../api/clients";
import { listVendors } from "../../api/vendors";
import { listMatches } from "../../api/candidates";
import type { Client, Contract, Match, Vendor } from "../../api/types";
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

const CONTRACT_TYPES = ["candidate_vendor", "vendor_client", "direct"];
const CONTRACT_STATUSES = ["active", "expired", "terminated"];
const STAGE_PRIORITY: Record<string, number> = { placed: 0, offer: 1 };

function daysUntil(endDate?: string | null): number | null {
  if (!endDate) return null;
  const t = new Date(endDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function isExpiring(c: Contract, days = 30): boolean {
  const d = daysUntil(c.endDate);
  return d !== null && d >= 0 && d <= days;
}

export default function ContractsListPage() {
  const [searchParams] = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [expiringOnly, setExpiringOnly] = useState(searchParams.get("expiring") === "1");
  const [selected, setSelected] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [contractType, setContractType] = useState("candidate_vendor");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    setError("");
    listContracts()
      .then(setContracts)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load contracts"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    listClients().then(setClients).catch(() => setClients([]));
    listVendors().then(setVendors).catch(() => setVendors([]));
  }, []);

  const filtered = useMemo(
    () =>
      contracts.filter(
        (c) =>
          (!status || c.status === status) &&
          (!clientId || c.clientId === clientId) &&
          (!vendorId || c.vendorId === vendorId) &&
          (!expiringOnly || isExpiring(c)),
      ),
    [contracts, status, clientId, vendorId, expiringOnly],
  );

  async function openForm() {
    setShowForm(true);
    if (matches.length === 0) {
      try {
        const all = await listMatches();
        all.sort(
          (a, b) =>
            (STAGE_PRIORITY[a.stage ?? ""] ?? 2) - (STAGE_PRIORITY[b.stage ?? ""] ?? 2),
        );
        setMatches(all);
      } catch {
        setMatches([]);
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId || !startDate) return;
    setBusy(true);
    setError("");
    try {
      await createContract({
        matchId,
        contractType,
        rate: rate ? Number(rate) : null,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        documentUrl: documentUrl || null,
      });
      setMatchId("");
      setRate("");
      setStartDate("");
      setEndDate("");
      setDocumentUrl("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contract");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="page-subtitle">
            {filtered.length} contract{filtered.length === 1 ? "" : "s"} on file
          </p>
        </div>
        <Button variant="primary" onClick={() => (showForm ? setShowForm(false) : openForm())}>
          {showForm ? "Cancel" : "+ New contract"}
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
          {CONTRACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        >
          <option value="">All vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <label className="mb-0 flex items-center gap-2 text-[13px] text-ink-600">
          <input
            type="checkbox"
            checked={expiringOnly}
            onChange={(e) => setExpiringOnly(e.target.checked)}
          />
          Expiring ≤30d
        </label>
      </div>

      {showForm && (
        <form className="card mb-4" onSubmit={submit}>
          <div className="grid cols-2">
            <div className="field">
              <label>Match (candidate · job)</label>
              <select value={matchId} onChange={(e) => setMatchId(e.target.value)} required>
                <option value="">Select match…</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.candidateName ?? "—"} · {m.jobTitle ?? "—"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Type</label>
              <select value={contractType} onChange={(e) => setContractType(e.target.value)}>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Rate (₹)</label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label>Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Document URL / key</label>
              <input
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="MinIO key or URL (optional)"
              />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            Save Contract
          </Button>
        </form>
      )}

      {error && <ErrorBox message={error} />}

      <div className="side-by-side">
        <div>
          {loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="contract"
              title="No contracts yet"
              description="Contracts will appear here once candidates are placed through your pipeline."
            />
          ) : (
            <Table
              headers={[
                "Candidate",
                "Client",
                "Vendor",
                "Type",
                "Rate",
                "Start",
                "End",
                "Status",
                "Doc",
                "Flags",
              ]}
              footer={
                <span>
                  Showing {filtered.length} contract{filtered.length === 1 ? "" : "s"}
                </span>
              }
            >
              {filtered.map((c) => {
                const d = daysUntil(c.endDate);
                return (
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
                    </td>
                    <td>
                      <StatusPill status={c.status} />
                    </td>
                    <td>{c.documentUrl ? "📄" : "—"}</td>
                    <td className="whitespace-nowrap">
                      {isExpiring(c) && <Badge tone="red">Ends in {d}d</Badge>}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>

        {selected && (
          <ContractPanel
            contract={selected}
            onClose={() => setSelected(null)}
            onChanged={() => {
              setSelected(null);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function ContractPanel({
  contract,
  onClose,
  onChanged,
}: {
  contract: Contract;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState(contract.status ?? "active");
  const [extendTo, setExtendTo] = useState(
    contract.endDate ? contract.endDate.slice(0, 10) : "",
  );
  const [busy, setBusy] = useState(false);

  async function patch(body: { status?: string; endDate?: string | null }) {
    setBusy(true);
    try {
      await updateContract(contract.id, body);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ alignSelf: "start" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 font-heading text-[13px] font-semibold">Contract Details</h3>
        <Button onClick={onClose}>Close</Button>
      </div>
      <p className="font-medium">{contract.candidateName}</p>
      <div className="muted text-[13px]">
        <div>Client: {contract.clientName ?? "—"}</div>
        <div>Vendor: {contract.vendorName ?? "—"}</div>
        <div>Type: {contract.contractType ?? "—"}</div>
        <div>Rate: {formatInr(contract.rate)}</div>
        <div>
          Term:{" "}
          {contract.startDate ? new Date(contract.startDate).toLocaleDateString() : "—"} →{" "}
          {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "—"}
        </div>
        <div>
          Document:{" "}
          {contract.documentUrl ? (
            <a href={contract.documentUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          ) : (
            "No document on file"
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="field">
          <label>Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              patch({ status: e.target.value });
            }}
            disabled={busy}
          >
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Extend end date</label>
          <div className="row">
            <input
              type="date"
              value={extendTo}
              onChange={(e) => setExtendTo(e.target.value)}
              style={{ width: "auto" }}
            />
            <Button onClick={() => patch({ endDate: new Date(extendTo).toISOString() })} disabled={busy || !extendTo}>
              Extend
            </Button>
          </div>
        </div>
        <Button onClick={() => patch({ status: "terminated" })} disabled={busy}>
          Mark terminated
        </Button>
      </div>
    </div>
  );
}
