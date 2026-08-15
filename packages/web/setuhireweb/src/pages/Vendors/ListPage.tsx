import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createVendor, getVendorCandidates, listVendors } from "../../api/vendors";
import type { Candidate, Vendor } from "../../api/types";
import { Button, ErrorBox, Loading, StatusPill, Table, Tags } from "../../components/ui";

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
      <div className="toolbar">
        <h1 className="page-title">Vendors</h1>
        <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add Vendor"}
        </Button>
      </div>

      <div className="toolbar">
        <input
          placeholder="Filter by specialization"
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="grid cols-2">
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Specialization (comma-separated)</label>
              <input value={specs} onChange={(e) => setSpecs(e.target.value)} />
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
      ) : (
        <Table headers={["Name", "Specialization", "Status"]}>
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
      <tr onClick={toggle} style={{ cursor: "pointer" }}>
        <td>
          <Link to={`/vendors/${vendor.id}`} onClick={(e) => e.stopPropagation()}>
            {vendor.name}
          </Link>
        </td>
        <td>
          <Tags items={vendor.specialization} />
        </td>
        <td>
          <StatusPill status={vendor.status} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={3} style={{ background: "#fafbfc" }}>
            {loadingCands ? (
              <div className="muted">Loading candidates…</div>
            ) : candidates.length === 0 ? (
              <div className="muted">No candidates sourced by this vendor.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
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
