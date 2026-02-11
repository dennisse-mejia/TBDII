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

// definición SQL
app.get("/db/object/definition", async (req, res) => {
  const connectionId = String(req.query.connectionId || "").trim();
  const schema = String(req.query.schema || "").trim();
  const name = String(req.query.name || "").trim();

  if (!connectionId) {
    return res.status(400).json({ ok: false, error: "Falta connectionId" });
  }
  if (!schema || !name) {
    return res.status(400).json({ ok: false, error: "Falta schema o name" });
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

  let pool;
  try {
    pool = await sql.connect(cfg);

    const defQ = await pool
      .request()
      .input("schema", sql.NVarChar, schema)
      .input("name", sql.NVarChar, name)
      .query(`
        SELECT
          s.name AS schema_name,
          o.name AS object_name,
          o.type AS object_type,
          o.type_desc AS object_type_desc,
          m.definition
        FROM sys.objects o
        INNER JOIN sys.schemas s
          ON s.schema_id = o.schema_id
        LEFT JOIN sys.sql_modules m
          ON m.object_id = o.object_id
        WHERE o.is_ms_shipped = 0
          AND s.name = @schema
          AND o.name = @name
          AND o.type IN ('V','P','FN','IF','TF','TR')
        ORDER BY o.name;
      `);

    const row = defQ.recordset?.[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: "Objeto no encontrado" });
    }

    // Si objeto WITH ENCRYPTION puede venir NULL
    return res.json({
      ok: true,
      object: {
        schema: row.schema_name,
        name: row.object_name,
        type: row.object_type,
        typeDesc: row.object_type_desc,
      },
      definition: row.definition ?? "",
      hasDefinition: row.definition != null,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  } finally {
    try {
      if (pool) await pool.close();
    } catch {}
  }
});


// Detalle de tabla
app.get("/db/table/details", async (req, res) => {
  const connectionId = String(req.query.connectionId || "").trim();
  const schema = String(req.query.schema || "").trim();
  const name = String(req.query.name || "").trim();

  if (!connectionId) {
    return res.status(400).json({ ok: false, error: "Falta connectionId" });
  }
  if (!schema || !name) {
    return res.status(400).json({ ok: false, error: "Falta schema o name" });
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

  let pool;
  try {
    pool = await sql.connect(cfg);

    // validar tabla y obtener object_id
    const objQ = await pool
      .request()
      .input("schema", sql.NVarChar, schema)
      .input("name", sql.NVarChar, name)
      .query(`
        SELECT t.object_id
        FROM sys.tables t
        INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
        WHERE t.is_ms_shipped = 0
          AND s.name = @schema
          AND t.name = @name;
      `);

    const objId = objQ.recordset?.[0]?.object_id;
    if (!objId) {
      return res.status(404).json({ ok: false, error: "Tabla no encontrada" });
    }

    // PK (nombre + columnas)
    const pkQ = await pool
      .request()
      .input("objId", sql.Int, objId)
      .query(`
        SELECT
          kc.name AS pk_name,
          col.name AS column_name,
          ic.key_ordinal
        FROM sys.key_constraints kc
        INNER JOIN sys.indexes i
          ON i.object_id = kc.parent_object_id
         AND i.index_id = kc.unique_index_id
        INNER JOIN sys.index_columns ic
          ON ic.object_id = i.object_id
         AND ic.index_id = i.index_id
        INNER JOIN sys.columns col
          ON col.object_id = ic.object_id
         AND col.column_id = ic.column_id
        WHERE kc.type = 'PK'
          AND kc.parent_object_id = @objId
        ORDER BY ic.key_ordinal;
      `);

    const pkName = pkQ.recordset?.[0]?.pk_name || null;
    const pkColumns = (pkQ.recordset || []).map((r) => ({
      name: r.column_name,
      ordinal: r.key_ordinal,
    }));

    // columnas + tipo + identity + marca de PK
    const colsQ = await pool
      .request()
      .input("objId", sql.Int, objId)
      .query(`
        WITH pk_cols AS (
          SELECT ic.column_id, ic.key_ordinal
          FROM sys.key_constraints kc
          INNER JOIN sys.indexes i
            ON i.object_id = kc.parent_object_id
           AND i.index_id = kc.unique_index_id
          INNER JOIN sys.index_columns ic
            ON ic.object_id = i.object_id
           AND ic.index_id = i.index_id
          WHERE kc.type = 'PK'
            AND kc.parent_object_id = @objId
        )
        SELECT
          c.column_id,
          c.name AS column_name,
          t.name AS type_name,
          CASE
            WHEN t.name IN ('nchar','nvarchar') AND c.max_length > 0 THEN c.max_length / 2
            ELSE c.max_length
          END AS max_length,
          c.precision,
          c.scale,
          c.is_nullable,
          CASE WHEN idc.column_id IS NULL THEN 0 ELSE 1 END AS is_identity,
          idc.seed_value,
          idc.increment_value,
          CASE WHEN pk.column_id IS NULL THEN 0 ELSE 1 END AS is_pk,
          pk.key_ordinal AS pk_ordinal
        FROM sys.columns c
        INNER JOIN sys.types t
          ON t.user_type_id = c.user_type_id
        LEFT JOIN sys.identity_columns idc
          ON idc.object_id = c.object_id
         AND idc.column_id = c.column_id
        LEFT JOIN pk_cols pk
          ON pk.column_id = c.column_id
        WHERE c.object_id = @objId
        ORDER BY c.column_id;
      `);

    return res.json({
      ok: true,
      table: { schema, name },
      primaryKey: {
        name: pkName,
        columns: pkColumns,
      },
      columns: colsQ.recordset,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  } finally {
    try {
      if (pool) await pool.close();
    } catch {

    }
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

// query runner, ejecutar SQL
app.post("/db/query", async (req, res) => {
  const connectionId = String(req.body?.connectionId || "").trim();
  const sqlText = String(req.body?.sqlText || "").trim();

  if (!connectionId || !sqlText) {
    return res
      .status(400)
      .json({ ok: false, error: "Falta connectionId o sqlText" });
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

  let pool;
  try {
    pool = await sql.connect(cfg);

    const result = await pool.request().query(sqlText);

    const recordset = result?.recordset || [];
    const metaCols = result?.recordset?.columns
      ? Object.keys(result.recordset.columns)
      : [];

    const columns =
      metaCols.length > 0
        ? metaCols
        : recordset[0]
        ? Object.keys(recordset[0])
        : [];

    const rows = recordset.map((r) => columns.map((c) => r?.[c]));

    return res.json({ ok: true, columns, rows });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  } finally {
    try {
      if (pool) await pool.close();
    } catch {}
  }
});

app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));