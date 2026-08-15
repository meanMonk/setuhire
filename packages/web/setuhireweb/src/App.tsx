import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export default function App() {
  const [health, setHealth] = useState<string>("checking...");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) => setHealth(JSON.stringify(d)))
      .catch(() => setHealth("api not reachable — set VITE_API_URL"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "720px" }}>
      <h1>setuhireweb</h1>
      <p>API health: <code>{health}</code></p>
      <p>
        Edit <code>packages/web/setuhireweb/src/App.tsx</code> and start building.
      </p>
    </main>
  );
}
