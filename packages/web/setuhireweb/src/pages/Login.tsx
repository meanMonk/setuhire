import { useState, type FormEvent } from "react";

const DEMO_ACCOUNTS = [
  { role: "CEO", email: "ceo@setuhire.com" },
  { role: "Recruiter", email: "priya.recruiter@setuhire.com" },
  { role: "Admin", email: "admin@setuhire.com" },
];

const DEMO_PASSWORD = "Passw0rd!";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError("");
  }

  return (
    <div className="login-wrap">
      <h1>SetuHire</h1>
      <p className="muted">Sign in to continue</p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="error-box">{error}</div>}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="demo-accounts">
        <p className="muted">Demo accounts (password: {DEMO_PASSWORD})</p>
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            className="demo-account"
            onClick={() => fillDemo(a.email)}
          >
            {a.role} — {a.email}
          </button>
        ))}
      </div>
    </div>
  );
}
