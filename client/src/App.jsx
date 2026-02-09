import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:3001";

export default function App() {
  const [form, setForm] = useState({
    name: "Local Docker",
    host: "localhost",
    port: 1433,
    user: "sa",
    password: "Strong!Passw0rd",
    database: "master",
  });

  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadConnections = async () => {
    const res = await fetch(`${API}/connections`);
    const data = await res.json();
    setConnections(data.connections || []);
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const saveConnection = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMsg({ type: "error", text: data?.error || "No se pudo guardar" });
        return;
      }

      setMsg({ type: "ok", text: "Conexión guardada" });
      await loadConnections();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const deleteConnection = async (id) => {
    if (!confirm("¿Eliminar esta conexión?")) return;

    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/connections/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMsg({ type: "error", text: data?.error || "No se pudo eliminar" });
        return;
      }

      setMsg({ type: "ok", text: "Conexión eliminada" });
      await loadConnections();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/connections/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMsg({ type: "error", text: data?.error || "Conexión fallida" });
        return;
      }

      setMsg({ type: "ok", text: "Conexión exitosa" });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900 }}>
      <h1>DB Manager</h1>
      <p>Connection Manager (MSSQL)</p>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <label>
          Nombre
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Host
          <input
            name="host"
            value={form.host}
            onChange={onChange}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Port
          <input
            name="port"
            value={form.port}
            onChange={onChange}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          User
          <input
            name="user"
            value={form.user}
            onChange={onChange}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          Password
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          Database
          <input
            name="database"
            value={form.database}
            onChange={onChange}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={testConnection} disabled={loading} style={{ padding: 12, fontWeight: 700 }}>
          {loading ? "..." : "Probar conexión"}
        </button>
        <button onClick={saveConnection} disabled={loading} style={{ padding: 12, fontWeight: 700 }}>
          {loading ? "..." : "Guardar conexión"}
        </button>
      </div>

      {msg && (
        <p style={{ marginTop: 12, fontWeight: 700, color: msg.type === "ok" ? "green" : "crimson" }}>
          {msg.text}
        </p>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2>Conexiones guardadas</h2>

      {connections.length === 0 ? (
        <p>No hay conexiones guardadas.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {connections.map((c) => (
            <div
              key={c.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{c.name}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {c.user}@{c.host}:{c.port} / {c.database}
                </div>
              </div>

              <button
                onClick={() => deleteConnection(c.id)}
                disabled={loading}
                style={{ padding: 10, fontWeight: 700 }}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
