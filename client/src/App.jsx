import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getTableDetails } from "./api/db";
import TableDetailsPanel from "./components/TableDetailsPanel";


const API = "http://localhost:3001";

const SECCIONES = [
  { key: "tables", label: "Tables" },
  { key: "views", label: "Views" },
  { key: "procedures", label: "Procedures" },
  { key: "functions", label: "Functions" },
  { key: "triggers", label: "Triggers" },
];

// normaliza forma del backend
function normalizarObjetos(payload) {
  const p = payload ?? {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    tables: arr(p.tables ?? p.tablas),
    views: arr(p.views ?? p.vistas),
    procedures: arr(p.procedures ?? p.procs ?? p.procedimientos),
    functions: arr(p.functions ?? p.funcs ?? p.funciones),
    triggers: arr(p.triggers ?? p.trigs ?? p.disparadores),
  };
}

// muestra schema.nombre
function mostrarObjeto(o) {
  if (typeof o === "string") return o;

  const schema =
    o.schema ??
    o.table_schema ??
    o.view_schema ??
    o.routine_schema ??
    o.trigger_schema ??
    "dbo";

  const name =
    o.name ??
    o.table_name ??
    o.view_name ??
    o.routine_name ??
    o.trigger_name ??
    "obj";

  return `${schema}.${name}`;
}


function extraerSchemaNombre(o) {
  if (typeof o === "string") {
    const [schema, ...rest] = o.split(".");
    return { schema: schema || "dbo", name: rest.join(".") || o };
  }

  const schema =
    o.schema ??
    o.table_schema ??
    o.view_schema ??
    o.routine_schema ??
    o.trigger_schema ??
    "dbo";

  const name =
    o.name ??
    o.table_name ??
    o.view_name ??
    o.routine_name ??
    o.trigger_name ??
    "obj";

  return { schema, name };
}


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

  // explorer
  const [objects, setObjects] = useState(() =>
    normalizarObjetos({
      tables: [],
      views: [],
      procedures: [],
      functions: [],
      triggers: [],
    })
  );
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [objectsError, setObjectsError] = useState("");
  const [expanded, setExpanded] = useState(() => ({
    tables: true,
    views: true,
    procedures: false,
    functions: false,
    triggers: false,
  }));

  // Detalle de tabla (panel derecho)
const [selectedTable, setSelectedTable] = useState(null); 
const [tableDetails, setTableDetails] = useState(null);
const [loadingTableDetails, setLoadingTableDetails] = useState(false);
const [tableDetailsError, setTableDetailsError] = useState("");


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

  // carga objetos por conexión
  const loadObjects = async (connectionId) => {
    if (!connectionId) return;

    setLoadingObjects(true);
    setObjectsError("");
    try {
      const res = await fetch(
        `${API}/db/objects?connectionId=${encodeURIComponent(connectionId)}`
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`No se pudo cargar objetos (${res.status}) ${text}`);
      }

      const data = await res.json();
      setObjects(normalizarObjetos(data));
    } catch (err) {
      setObjectsError(err.message || "Error al cargar objetos");
      setObjects(
        normalizarObjetos({
          tables: [],
          views: [],
          procedures: [],
          functions: [],
          triggers: [],
        })
      );
    } finally {
      setLoadingObjects(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  // refresca explorer cuando cambia conexión
  useEffect(() => {
    if (!selectedId) return;
    loadObjects(selectedId);
  }, [selectedId]);
  
  // trae detalle cuando cambia la tabla
useEffect(() => {
  if (!selectedId || !selectedTable) {
    setTableDetails(null);
    setTableDetailsError("");
    setLoadingTableDetails(false);
    return;
  }

  const controller = new AbortController();

  (async () => {
    try {
      setLoadingTableDetails(true);
      setTableDetailsError("");

      const data = await getTableDetails(
        {
          connectionId: selectedId,
          schema: selectedTable.schema,
          name: selectedTable.name,
        },
        { signal: controller.signal }
      );

      setTableDetails(data);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setTableDetails(null);
      setTableDetailsError(e?.message || "Error cargando detalle");
    } finally {
      setLoadingTableDetails(false);
    }
  })();

  return () => controller.abort();
}, [selectedId, selectedTable]);


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

  const toggle = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearSelectedTable = () => {
  setSelectedTable(null);
  setTableDetails(null);
  setTableDetailsError("");
  setLoadingTableDetails(false);
};

const onTableClick = (obj) => {
  const { schema, name } = extraerSchemaNombre(obj);
  setSelectedTable({ schema, name });
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
          Explorer {loadingObjects ? "(cargando...)" : ""}
        </div>

        {objectsError ? (
          <div style={{ color: "tomato", fontSize: 13, marginBottom: 10 }}>
            {objectsError}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            onClick={() => loadObjects(selectedId)}
            disabled={!selectedId || loadingObjects}
            style={{ padding: 10, fontWeight: 700 }}
            title="Recargar"
          >
            {loadingObjects ? "..." : "Refrescar"}
          </button>
        </div>

       <div className="list">
  {SECCIONES.map((s) => {
    const list = objects[s.key] ?? [];
    const open = !!expanded[s.key];

    return (
      <div key={s.key} style={{ display: "grid", gap: 6 }}>
        <div
          className="item"
          onClick={() => toggle(s.key)}
          style={{ cursor: "pointer" }}
          title="Abrir/cerrar"
        >
          <span style={{ opacity: 0.8 }}>{open ? "▾" : "▸"}</span>
          <span style={{ fontWeight: 700 }}>{s.label}</span>
          <span style={{ marginLeft: "auto", opacity: 0.7 }}>
            {list.length}
          </span>
        </div>

        {open ? (
          list.length === 0 ? (
            <div className="item itemMuted" style={{ paddingLeft: 22 }}>
              — vacío —
            </div>
          ) : (
            list.slice(0, 200).map((obj, idx) => {
              const isTable = s.key === "tables";
              const { schema, name } = extraerSchemaNombre(obj);

              const isSelected =
                isTable &&
                selectedTable &&
                selectedTable.schema === schema &&
                selectedTable.name === name;

              return (
                <div
                  key={`${s.key}-${idx}-${mostrarObjeto(obj)}`}
                  className="item itemMuted"
                  onClick={() => (isTable ? onTableClick(obj) : null)}
                  style={{
                    paddingLeft: 22,
                    border: isSelected
                      ? "1px solid rgba(59,130,246,0.7)"
                      : "1px solid rgba(255,255,255,0.06)",
                    background: isSelected
                      ? "rgba(59,130,246,0.10)"
                      : "rgba(255,255,255,0.02)",
                    cursor: isTable ? "pointer" : "default",
                  }}
                  title={mostrarObjeto(obj)}
                >
                  <span style={{ opacity: 0.7 }}>•</span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mostrarObjeto(obj)}
                  </span>
                </div>
              );
            })
          )
        ) : null}
      </div>
    );
  })}
</div>
</aside>


      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="brand">DB Manager</div>
          <div className="badge">Conexión en la UI</div>
        </header>

        <div className="content">
          <TableDetailsPanel
  selected={selectedTable}
  details={tableDetails}
  loading={loadingTableDetails}
  error={tableDetailsError}
  onClear={clearSelectedTable}
/>

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