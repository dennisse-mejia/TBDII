const BASE_URL = "http://localhost:3001";

/**
 * Tipos para autocompletado 
 * TableRef: identifica una tabla
 * TableColumn: metadata de columna
 * PrimaryKey: metadata de PK
 * TableDetailsResponse: respuesta del endpoint
 */

/**
 * @typedef {Object} TableRef
 * @property {string} connectionId 
 * @property {string} schema       
 * @property {string} name        
 */

/**
 * @typedef {Object} TableColumn
 * @property {number} column_id
 * @property {string} column_name
 * @property {string} type_name
 * @property {number|null} max_length
 * @property {number|null} precision
 * @property {number|null} scale
 * @property {boolean} is_nullable
 * @property {0|1} is_identity
 * @property {number|null} seed_value
 * @property {number|null} increment_value
 * @property {0|1} is_pk
 * @property {number|null} pk_ordinal
 */

/**
 * @typedef {Object} PrimaryKey
 * // nombre de la constraint PK
 * @property {string|null} name 
 * @property {{name: string, ordinal: number}[]} columns 
 */

/**
 * @typedef {Object} TableDetailsResponse
 * @property {boolean} ok
 * @property {{schema: string, name: string}} table
 * @property {PrimaryKey} primaryKey
 * @property {TableColumn[]} columns
 */

function buildQuery(params) {
  // query string sin campos vacíos
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      qs.set(k, String(v));
    }
  });
  return qs.toString();
}

async function getJson(url, { signal } = {}) {
  const res = await fetch(url, { method: "GET", signal });

  let data = null;
  try {
    data = await res.json();
  } catch {

  }

  if (!res.ok || (data && data.ok === false)) {
    const msg =
      (data && data.error) ||
      `Error ${res.status}: ${res.statusText || "Request failed"}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * detalle de una tabla
 * @param {TableRef} ref
 * @param {{ signal?: AbortSignal }} [options] 
 * @returns {Promise<TableDetailsResponse>}
 */
export async function getTableDetails(ref, options = {}) {
  const { connectionId, schema, name } = ref || {};

  // validaciones 
  if (!connectionId) throw new Error("Falta connectionId");
  if (!schema) throw new Error("Falta schema");
  if (!name) throw new Error("Falta name");

  const query = buildQuery({ connectionId, schema, name });
  const url = `${BASE_URL}/db/table/details?${query}`;

  return getJson(url, options);
}

/**
 * @typedef {Object} ObjectRef
 * @property {string} connectionId
 * @property {string} schema
 * @property {string} name
 */

/**
 * definición SQL de objeto
 * @param {ObjectRef} ref
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ok:boolean, object:any, definition:string, hasDefinition:boolean}>}
 */
export async function getObjectDefinition(ref, options = {}) {
  const { connectionId, schema, name } = ref || {};

  if (!connectionId) throw new Error("Falta connectionId");
  if (!schema) throw new Error("Falta schema");
  if (!name) throw new Error("Falta name");

  const query = buildQuery({ connectionId, schema, name });
  const url = `${BASE_URL}/db/object/definition?${query}`;

  return getJson(url, options);
}

/**
 * ejecutar query y devolver columns + rows
 * @param {{connectionId: string, sqlText: string}} payload
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ok:boolean, columns:string[], rows:any[][]}>}
 */
export async function runQuery(payload, options = {}) {
  const connectionId = String(payload?.connectionId || "").trim();
  const sqlText = String(payload?.sqlText || "").trim();

  if (!connectionId) throw new Error("Falta connectionId");
  if (!sqlText) throw new Error("Falta sqlText");

  const res = await fetch(`${BASE_URL}/db/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId, sqlText }),
    signal: options.signal,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok || (data && data.ok === false)) {
    const msg =
      (data && data.error) ||
      `Error ${res.status}: ${res.statusText || "Request failed"}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}