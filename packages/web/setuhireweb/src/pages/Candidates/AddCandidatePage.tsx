import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCandidate,
  uploadResume,
  type CandidatePreview,
} from "../../api/candidates";
import { Button, ErrorBox, Tags } from "../../components/ui";

export default function AddCandidatePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"upload" | "manual">("upload");

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<CandidatePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [rate, setRate] = useState("");
  const [sourceType, setSourceType] = useState("direct");
  const [saving, setSaving] = useState(false);

  async function onUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const parsed = await uploadResume(files);
      setPreviews(parsed);
      if (parsed.length > 0) {
        setName(parsed[0]?.name ?? "");
        setEmail(parsed[0]?.email ?? "");
        setSkills((parsed[0]?.skills ?? []).join(", "));
        setExperience(parsed[0]?.experience_years != null ? String(parsed[0].experience_years) : "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createCandidate({
        name,
        email: email || undefined,
        phone: phone || undefined,
        skills: skills ? skills.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        experienceYears: experience ? Number(experience) : undefined,
        rateExpectation: rate ? Number(rate) : undefined,
        sourceType,
        resumeUrl: previews.length > 0 ? "uploaded" : undefined,
      });
      navigate(`/candidates/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create candidate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Add Candidate</h1>

      <div className="row" style={{ marginBottom: "1rem" }}>
        <Button
          variant={mode === "upload" ? "primary" : undefined}
          onClick={() => setMode("upload")}
        >
          Resume Upload
        </Button>
        <Button
          variant={mode === "manual" ? "primary" : undefined}
          onClick={() => setMode("manual")}
        >
          Manual Entry
        </Button>
      </div>

      {mode === "upload" && (
        <div className="card">
          <div className="row">
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              style={{ maxWidth: 420 }}
            />
            <Button onClick={onUpload} disabled={uploading || files.length === 0}>
              {uploading ? "Parsing…" : "Upload & Parse"}
            </Button>
          </div>
          {previews.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              {previews.map((p, i) => (
                <div key={i} className="panel">
                  <strong>{p.name ?? "Candidate"}</strong>
                  {p.skills && p.skills.length > 0 && <Tags items={p.skills} />}
                  {p.experience_years != null && (
                    <div className="muted">{p.experience_years} years</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <ErrorBox message={error} />}

      <form className="card" onSubmit={onSave}>
        <h3>Candidate Details</h3>
        <div className="grid cols-2">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>Skills (comma-separated)</label>
            <input value={skills} onChange={(e) => setSkills(e.target.value)} />
          </div>
          <div className="field">
            <label>Experience (years)</label>
            <input value={experience} onChange={(e) => setExperience(e.target.value)} type="number" />
          </div>
          <div className="field">
            <label>Rate Expectation (INR)</label>
            <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" />
          </div>
          <div className="field">
            <label>Source Type</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              <option value="direct">Direct</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
        </div>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save Candidate"}
        </Button>
      </form>
    </div>
  );
}
