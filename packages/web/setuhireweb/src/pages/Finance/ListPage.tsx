import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createFinanceRecord,
  financeExport,
  financeRecords,
  financeSummary,
  updateFinanceRecord,
} from "../../api/pipeline";
import { listClients } from "../../api/clients";
import { listVendors } from "../../api/vendors";
import { listMatches } from "../../api/candidates";
import type { Client, FinanceRecord, Match, Vendor } from "../../api/types";
import { Button, EmptyState, ErrorBox, formatInr, Loading, StatusPill, Table } from "../../components/ui";

const BILLING_STATUSES = ["pending", "invoiced", "payment_received"];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinanceListPage() {
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<{
    totalRevenue?: number;
    totalCommission?: number;
    pendingReceivables?: number;
    pendingVendorPayouts?: number;
  } | null>(null);
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [clientId, setClientId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [billingStatus, setBillingStatus] = useState(searchParams.get("billing_status") ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinanceRecord | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [billing, setBilling] = useState("");
  const [payout, setPayout] = useState("");
  const [status, setStatus] = useState("pending");
  const [period, setPeriod] = useState(month);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    setError("");
    Promise.all([
      financeSummary(month || undefined),
      financeRecords({
        month: month || undefined,
        clientId: clientId || undefined,
        vendorId: vendorId || undefined,
        billingStatus: billingStatus || undefined,
      }),
    ])
      .then(([s, r]) => {
        setSummary(s);
        setRecords(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load finance"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, clientId, vendorId, billingStatus]);

  useEffect(() => {
    listClients().then(setClients).catch(() => setClients([]));
    listVendors().then(setVendors).catch(() => setVendors([]));
  }, []);

  const commissionPreview = useMemo(() => {
    const b = billing ? Number(billing) : 0;
    const p = payout ? Number(payout) : 0;
    return Number.isNaN(b) || Number.isNaN(p) ? null : b - p;
  }, [billing, payout]);

  async function openForm(record?: FinanceRecord) {
    setEditing(record ?? null);
    setShowForm(true);
    if (record) {
      setMatchId(record.matchId ?? "");
      setBilling(record.clientBillingAmount != null ? String(record.clientBillingAmount) : "");
      setPayout(record.vendorPayoutAmount != null ? String(record.vendorPayoutAmount) : "");
      setStatus(record.billingStatus ?? "pending");
      setPeriod(record.period ?? month);
    } else {
      setMatchId("");
      setBilling("");
      setPayout("");
      setStatus("pending");
      setPeriod(month);
    }
    if (matches.length === 0) {
      try {
        setMatches(await listMatches());
      } catch {
        setMatches([]);
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId || !period) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        matchId,
        clientBillingAmount: billing ? Number(billing) : null,
        vendorPayoutAmount: payout ? Number(payout) : null,
        billingStatus: status,
        period,
      };
      if (editing) await updateFinanceRecord(editing.id, body);
      else await createFinanceRecord(body);
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record");
    } finally {
      setBusy(false);
    }
  }

  async function onStatusChange(id: string, next: string) {
    setError("");
    try {
      await updateFinanceRecord(id, { billingStatus: next });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  async function onExport() {
    setError("");
    try {
      const csv = await financeExport("csv", month || undefined);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `setuhire-finance-${month || "all"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  const cards: [string, keyof NonNullable<typeof summary>][] = [
    ["Total Revenue", "totalRevenue"],
    ["Total Commission", "totalCommission"],
    ["Pending Receivables", "pendingReceivables"],
    ["Pending Vendor Payouts", "pendingVendorPayouts"],
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="page-subtitle">
            {records.length} record{records.length === 1 ? "" : "s"} in view
          </p>
        </div>
        <div className="row">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: "auto" }}
          />
          <Button variant="primary" onClick={() => openForm()}>
            + Add record
          </Button>
          <Button onClick={onExport}>Export CSV</Button>
        </div>
      </div>

      <div className="filter-bar">
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
        <select
          className="h-9 rounded-md border border-surface-border bg-white px-3 text-[13px]"
          style={{ width: "auto" }}
          value={billingStatus}
          onChange={(e) => setBillingStatus(e.target.value)}
        >
          <option value="">All billing statuses</option>
          {BILLING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorBox message={error} />}

      {summary && (
        <div className="grid cols-4 mb-4">
          {cards.map(([label, key]) => (
            <div key={label} className="stat-card">
              <div className="value">{formatInr(summary[key])}</div>
              <div className="label">{label}</div>
            </div>
          ))}
        </div>
      )}

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
              <label>Client Billing (₹)</label>
              <input
                type="number"
                value={billing}
                onChange={(e) => setBilling(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Vendor Payout (₹)</label>
              <input type="number" value={payout} onChange={(e) => setPayout(e.target.value)} />
            </div>
            <div className="field">
              <label>Commission preview</label>
              <div className="font-medium">{formatInr(commissionPreview)}</div>
            </div>
            <div className="field">
              <label>Billing status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {BILLING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Period</label>
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {editing ? "Update Record" : "Add Record"}
          </Button>
        </form>
      )}

      {loading ? (
        <Loading />
      ) : records.length === 0 ? (
        <EmptyState
          icon="finance"
          title="No finance records yet"
          description={
            month || clientId || vendorId || billingStatus
              ? "No records match your filters. Try adjusting them."
              : "Finance records will appear here as placements are invoiced and payments are processed."
          }
        />
      ) : (
        <Table
          headers={[
            "Candidate",
            "Client",
            "Job",
            "Type",
            "Client Billing",
            "Vendor Payout",
            "Commission",
            "Status",
            "Period",
            "Actions",
          ]}
          footer={
            <span>
              Showing {records.length} record{records.length === 1 ? "" : "s"}
            </span>
          }
        >
          {records.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.candidateName ?? "—"}</td>
              <td>{r.clientName ?? "—"}</td>
              <td>{r.jobTitle ?? "—"}</td>
              <td>{r.employmentType?.toUpperCase() ?? "—"}</td>
              <td className="whitespace-nowrap text-right">{formatInr(r.clientBillingAmount)}</td>
              <td className="whitespace-nowrap text-right">{formatInr(r.vendorPayoutAmount)}</td>
              <td className="whitespace-nowrap text-right font-medium">
                {formatInr(r.commission)}
              </td>
              <td>
                <select
                  className="h-8 rounded-md border border-surface-border bg-white px-2 text-[12px]"
                  value={r.billingStatus ?? "pending"}
                  onChange={(e) => onStatusChange(r.id, e.target.value)}
                >
                  {BILLING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td>{r.period ?? "—"}</td>
              <td>
                <Button onClick={() => openForm(r)}>Edit</Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
