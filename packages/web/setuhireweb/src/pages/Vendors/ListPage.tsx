import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createVendor, getVendorCandidates, listVendors } from "../../api/vendors";
import type { Candidate, Vendor } from "../../api/types";
import { Button, EmptyState, ErrorBox, Icon, Loading, StatusPill, Table, TechPills } from "../../components/ui";

export default function VendorsListPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [specialization, setSpecialization] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [specs, setSpecs] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setVendors(await listVendors({ specialization: specialization || undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialization]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createVendor({
        name,
        specialization: specs
          ? specs.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      });
      setName("");
      setSpecs("");
      setShowForm(false);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add vendor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-subtitle">
            {vendors.length} vendor{vendors.length === 1 ? "" : "s"} on your bench
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          <Icon name="plus" /> {showForm ? "Cancel" : "Add Vendor"}
        </Button>
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <Icon name="search" className="filter-icon" />
          <input
            placeholder="Filter by specialization"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            style={{ width: 280 }}
          />
        </div>
      </div>

      {showForm && (
        <form className="card mb-4" onSubmit={submit}>
          <div className="grid cols-2">
            <div className="field">
              <label>Vendor Name</label>
              <input
                placeholder="e.g. TalentBridge Solutions"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Specializations</label>
              <input
                placeholder="e.g. React, Node.js, DevOps"
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            Save Vendor
          </Button>
        </form>
      )}

      {error && <ErrorBox message={error} />}
      {loading ? (
        <Loading />
      ) : vendors.length === 0 ? (
        <EmptyState
          icon="vendors"
          title="No vendors yet"
          description={
            specialization
              ? "No vendors match your search. Try a different specialization."
              : "Add your first vendor to start receiving candidate submissions."
          }
          action={
            !specialization ? (
              <Button variant="primary" onClick={() => setShowForm(true)}>
                <Icon name="plus" /> Add Your First Vendor
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table
          headers={["Name", "Specialization", "Status"]}
          footer={
            <span>
              Showing {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
            </span>
          }
        >
          {vendors.map((v) => (
            <VendorRow key={v.id} vendor={v} />
          ))}
        </Table>
      )}
    </div>
  );
}

function VendorRow({ vendor }: { vendor: Vendor }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCands, setLoadingCands] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && candidates.length === 0) {
      setLoadingCands(true);
      try {
        setCandidates(await getVendorCandidates(vendor.id));
      } catch {
        setCandidates([]);
      } finally {
        setLoadingCands(false);
      }
    }
  }

  return (
    <>
      <tr onClick={toggle}>
        <td className="font-medium">
          <Link to={`/vendors/${vendor.id}`} onClick={(e) => e.stopPropagation()}>
            {vendor.name}
          </Link>
        </td>
        <td>
          <TechPills items={vendor.specialization} />
        </td>
        <td>
          <StatusPill status={vendor.status} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={3} className="bg-surface-bg/50">
            {loadingCands ? (
              <div className="muted">Loading candidates…</div>
            ) : candidates.length === 0 ? (
              <div className="muted">No candidates sourced by this vendor.</div>
            ) : (
              <ul className="m-0 pl-5">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <Link to={`/candidates/${c.id}`}>{c.name}</Link>
                    {c.currentStatus && <span className="muted"> · {c.currentStatus}</span>}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
