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
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
