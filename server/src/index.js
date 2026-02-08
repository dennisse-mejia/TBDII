import express from "express";
import cors from "cors";
import sql from "mssql";

const app = express();
app.use(cors());
app.use(express.json());

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
