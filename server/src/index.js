import express from "express";
import cors from "cors";
import sql from "mssql";
import fs from "fs";
import path from "path";
import crypto from "crypto";


const app = express();
app.use(cors());
app.use(express.json());

const DATA_PATH = path.join(process.cwd(), "data", "connections.json");

function readConnections() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function writeConnections(conns) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(conns, null, 2), "utf8");
}


app.get("/connections", (_req, res) => {
  res.json({ ok: true, connections: readConnections() });
});

app.post("/connections", (req, res) => {
  const { name, host, port, user, password, database } = req.body;

  if (!name) return res.status(400).json({ ok: false, error: "name requerido" });

  const conns = readConnections();
  const newConn = {
    id: crypto.randomUUID(),
    name,
    host,
    port: Number(port || 1433),
    user,
    password,
    database: database || "master",
    createdAt: new Date().toISOString(),
  };

  conns.push(newConn);
  writeConnections(conns);

  res.json({ ok: true, connection: newConn });
});

app.delete("/connections/:id", (req, res) => {
  const { id } = req.params;
  const conns = readConnections();
  const next = conns.filter((c) => c.id !== id);

  writeConnections(next);
  res.json({ ok: true });
});


app.get("/health", (_req, res) =>
  res.json({ ok: true, message: "API running" })
);

app.post("/connections/test", async (req, res) => {
  const { host, port, user, password, database } = req.body;

  const config = {
    user,
    password,
    server: host,
    port: Number(port || 1433),
    database: database || "master",
    options: {
      encrypt: false,              
      trustServerCertificate: true 
    }
  };

  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT 1 AS ok");
    await pool.close();
    res.json({ ok: true, result: result.recordset[0] });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

// Lista objetos de la DB 
app.get("/db/objects", async (req, res) => {
  const connectionId = String(req.query.connectionId || "").trim();

  if (!connectionId) {
    return res.status(400).json({ ok: false, error: "Falta connectionId" });
  }

  const conns = readConnections();
  const conn = conns.find((c) => c.id === connectionId);

  if (!conn) {
    return res.status(404).json({ ok: false, error: "Conexión no encontrada" });
  }

  const cfg = {
    user: conn.user,
    password: conn.password,
    server: conn.host,
    port: Number(conn.port || 1433),
    database: conn.database || "master",
    options: { encrypt: false, trustServerCertificate: true },
  };

  try {
    const pool = await sql.connect(cfg);

    const tablesQ = await pool.request().query(`
      SELECT s.name AS schema_name, t.name AS object_name
      FROM sys.tables t
      INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE t.is_ms_shipped = 0
      ORDER BY s.name, t.name;
    `);

    const viewsQ = await pool.request().query(`
      SELECT s.name AS schema_name, v.name AS object_name
      FROM sys.views v
      INNER JOIN sys.schemas s ON s.schema_id = v.schema_id
      WHERE v.is_ms_shipped = 0
      ORDER BY s.name, v.name;
    `);

    const procsQ = await pool.request().query(`
      SELECT s.name AS schema_name, p.name AS object_name
      FROM sys.procedures p
      INNER JOIN sys.schemas s ON s.schema_id = p.schema_id
      WHERE p.is_ms_shipped = 0
      ORDER BY s.name, p.name;
    `);

    const funcsQ = await pool.request().query(`
      SELECT s.name AS schema_name, o.name AS object_name, o.type AS object_type
      FROM sys.objects o
      INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
      WHERE o.is_ms_shipped = 0
        AND o.type IN ('FN','IF','TF')
      ORDER BY s.name, o.name;
    `);

    const trigsQ = await pool.request().query(`
      SELECT s.name AS schema_name, tr.name AS object_name
      FROM sys.triggers tr
      INNER JOIN sys.objects o ON o.object_id = tr.parent_id
      INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
      WHERE tr.is_ms_shipped = 0
      ORDER BY s.name, tr.name;
    `);

    await pool.close();

    return res.json({
      ok: true,
      tables: tablesQ.recordset,
      views: viewsQ.recordset,
      procedures: procsQ.recordset,
      functions: funcsQ.recordset,
      triggers: trigsQ.recordset,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Ejecutar SQL 
app.post("/db/exec", async (req, res) => {
  const { connectionId, sqlText } = req.body;

  if (!connectionId || !sqlText) {
    return res.status(400).json({ ok: false, error: "Falta connectionId o sqlText" });
  }

  const conns = readConnections();
  const conn = conns.find((c) => c.id === connectionId);

  if (!conn) {
    return res.status(404).json({ ok: false, error: "Conexión no encontrada" });
  }

  const cfg = {
    user: conn.user,
    password: conn.password,
    server: conn.host,
    port: Number(conn.port || 1433),
    database: conn.database || "master",
    options: { encrypt: false, trustServerCertificate: true },
  };

  try {
    const pool = await sql.connect(cfg);
    await pool.request().query(sqlText);
    await pool.close();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});


app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
