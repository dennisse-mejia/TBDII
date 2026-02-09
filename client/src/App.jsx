import { useEffect, useMemo, useState } from "react";
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
  // conexión activa
  const [selectedId, setSelectedId] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [msg, setMsg] = useState(null);

  // Mapea opciones del dropdown
  const connectionOptions = useMemo(() => {
    return connections.map((c) => ({
      id: String(c.id),
      label: c.name || `${c.user}@${c.host}:${c.port}/${c.database}`,
    }));
  }, [connections]);

  // Selecciona conexión y llena el form
  const selectConnection = (conn) => {
    if (!conn) return;
    setSelectedId(String(conn.id));
    setForm({
      name: conn.name ?? "",
      host: conn.host ?? "",
      port: conn.port ?? 1433,
      user: conn.user ?? "",
      password: conn.password ?? "",
      database: conn.database ?? "",
    });
  };

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const res = await fetch(`${API}/connections`);
      const data = await res.json();
      const list = data.connections || [];
      setConnections(list);

      // Si no hay selección usa la primera
      if (!selectedId && list.length > 0) {
        selectConnection(list[0]);
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoadingConnections(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const onSelectChange = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    const found = connections.find((c) => String(c.id) === String(id));
    if (found) selectConnection(found);
  };

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

      // Si se borra la seleccionada limpia selección
      if (String(id) === String(selectedId)) {
        setSelectedId("");
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
    <div className="appShell">
      {/* Sidebar: selección */}
      <aside className="sidebar">
        <div className="sectionTitle">Conexión</div>

        <select
          className="control"
          value={selectedId}
          onChange={onSelectChange}
          disabled={loadingConnections || connections.length === 0}
        >
          {connections.length === 0 ? (
            <option value="">Sin conexiones</option>
          ) : (
            connectionOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))
          )}
        </select>

        <div className="sectionTitle" style={{ marginTop: 14 }}>
          Explorer
        </div>

        <div className="list">
          <div className="item itemMuted">Tables</div>
          <div className="item itemMuted">Views</div>
          <div className="item itemMuted">Procedures</div>
          <div className="item itemMuted">Functions</div>
          <div className="item itemMuted">Triggers</div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="brand">DB Manager</div>
          <div className="badge">Conexión en la UI</div>
        </header>

        <div className="content">
          <h1 style={{ marginTop: 0 }}>Connection Manager (MSSQL)</h1>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Nombre
              <input className="control" name="name" value={form.name} onChange={onChange} />
            </label>

            <label>
              Host
              <input className="control" name="host" value={form.host} onChange={onChange} />
            </label>

            <label>
              Port
              <input className="control" name="port" value={form.port} onChange={onChange} />
            </label>

            <label>
              User
              <input className="control" name="user" value={form.user} onChange={onChange} />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Password
              <input
                className="control"
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Database
              <input className="control" name="database" value={form.database} onChange={onChange} />
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
            <p style={{ marginTop: 12, fontWeight: 700, color: msg.type === "ok" ? "limegreen" : "tomato" }}>
              {msg.text}
            </p>
          )}

          <hr style={{ margin: "24px 0", opacity: 0.25 }} />

          <h2>Conexiones guardadas</h2>

          {loadingConnections ? (
            <p>Cargando conexiones...</p>
          ) : connections.length === 0 ? (
            <p>No hay conexiones guardadas.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {connections.map((c) => {
                const isSelected = String(c.id) === String(selectedId);

                return (
                  <button
                    key={c.id}
                    // click selecciona
                    onClick={() => selectConnection(c)} 
                    style={{
                      textAlign: "left",
                      border: isSelected ? "1px solid rgba(59,130,246,0.7)" : "1px solid rgba(255,255,255,0.12)",
                      background: isSelected ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.03)",
                      color: "inherit",
                      borderRadius: 10,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>{c.name}</div>
                      <div style={{ fontSize: 13, opacity: 0.8 }}>
                        {c.user}@{c.host}:{c.port} / {c.database}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        // no seleccionar al eliminar
                        e.stopPropagation(); 
                        deleteConnection(c.id);
                      }}
                      disabled={loading}
                      style={{ padding: 10, fontWeight: 700 }}
                    >
                      Eliminar
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}