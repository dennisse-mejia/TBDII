import { useEffect, useState } from "react";
import "./App.css";

export default function App() {
  const [api, setApi] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    fetch("http://localhost:3001/health")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setApi({ loading: false, data, error: null }))
      .catch((err) =>
        setApi({ loading: false, data: null, error: err.message })
      );
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>DB Manager</h1>
      <p>Client: 5173 | Server: 3001</p>

      {api.loading && <p>Cargando API...</p>}
      {api.error && <p style={{ color: "crimson" }}>Error: {api.error}</p>}
      {api.data && (
        <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8 }}>
          {JSON.stringify(api.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
