import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createJob,
  fetchJobFromUrl,
  parseJobText,
  type JobPreview,
} from "../../api/jobs";
import { listClients } from "../../api/clients";
import type { Client } from "../../api/types";
import { Button, EmptyState, ErrorBox, Tags } from "../../components/ui";

export default function AddJobPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<JobPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [experience, setExperience] = useState("");
  const [employmentType, setEmploymentType] = useState("contract");
  const [tsc, setTsc] = useState("");
  const [techStack, setTechStack] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listClients()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  async function onParse() {
    setParsing(true);
    setError("");
    try {
      const p =
        mode === "url" ? await fetchJobFromUrl(url) : await parseJobText(rawText);
      setPreview(p);
      setTitle(p.title ?? "");
      setExperience(p.min_experience != null ? `${p.min_experience}+ years` : "");
      setEmploymentType(p.employment_type ?? "contract");
      setTechStack(
        [...(p.skills?.must_have ?? []), ...(p.skills?.nice_to_have ?? [])].join(", "),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parsing failed");
    } finally {
      setParsing(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !title) {
      setError("Client and title are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createJob({
        clientId,
        title,
        techStack: techStack
          ? techStack.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        experienceRequired: experience || undefined,
        employmentType,
        targetSellingCost: tsc ? Number(tsc) : undefined,
        rawJdText: rawText || undefined,
        sourceUrl: url || undefined,
      });
      navigate(`/jobs/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setSaving(false);
    }
  }

  if (clients.length === 0) {
    return (
      <div>
        <h1 className="page-title">Add Job</h1>
        <EmptyState
          icon="clients"
          title="Add a client first"
          description="You need at least one client before you can create a job. Go to Clients to add one."
          action={
            <Button variant="primary" onClick={() => navigate("/clients")}>
              Go to Clients
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Add Job</h1>
      <p className="page-subtitle">Import a job from a URL or paste the description, then save it.</p>

      <div className="row" style={{ marginBottom: "1rem" }}>
        <Button variant={mode === "url" ? "primary" : undefined} onClick={() => setMode("url")}>
          From URL
        </Button>
        <Button variant={mode === "text" ? "primary" : undefined} onClick={() => setMode("text")}>
          Paste JD Text
        </Button>
      </div>

      {mode === "url" ? (
        <div className="card">
          <div className="row">
            <input
              placeholder="https://… job posting URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={onParse} disabled={parsing || !url}>
              {parsing ? "Parsing…" : "Fetch & Parse"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="card">
          <textarea
            rows={6}
            placeholder="Paste the job description here…"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <Button onClick={onParse} disabled={parsing || !rawText} style={{ marginTop: "0.5rem" }}>
            {parsing ? "Parsing…" : "Parse Text"}
          </Button>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {preview && (
        <div className="panel">
          <h3>Preview</h3>
          <p>
            <strong>{preview.title}</strong>
            {preview.employment_type && (
              <span className="muted"> · {preview.employment_type.toUpperCase()}</span>
            )}
          </p>
          {preview.skills?.must_have && preview.skills.must_have.length > 0 && (
            <div>
              <span className="muted">Must have: </span>
              <Tags items={preview.skills.must_have} />
            </div>
          )}
          {preview.skills?.nice_to_have && preview.skills.nice_to_have.length > 0 && (
            <div>
              <span className="muted">Nice to have: </span>
              <Tags items={preview.skills.nice_to_have} />
            </div>
          )}
        </div>
      )}

      <form className="card" onSubmit={onSave}>
        <h3>Save Job</h3>
        <div className="grid cols-2">
          <div className="field">
            <label>Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Job Title</label>
            <input
              placeholder="e.g. Senior React Developer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Experience Required</label>
            <input
              placeholder="e.g. 5+ years"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Employment Type</label>
            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              <option value="contract">Contract</option>
              <option value="fte">Full-time (FTE)</option>
            </select>
          </div>
          <div className="field">
            <label>Target Cost (₹)</label>
            <input
              placeholder="e.g. 1500000"
              value={tsc}
              onChange={(e) => setTsc(e.target.value)}
              type="number"
            />
          </div>
          <div className="field">
            <label>Key Skills</label>
            <input
              placeholder="e.g. React, Node.js, TypeScript"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save Job"}
        </Button>
      </form>
    </div>
  );
}
