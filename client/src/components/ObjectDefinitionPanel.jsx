import React from "react";

export default function ObjectDefinitionPanel({
  selectedObj,
  loading,
  error,
  objDef,
  onClear,
}) {
  if (!selectedObj) return null;

  const fullName = `${selectedObj.schema}.${selectedObj.name}`;
  const typeDesc = objDef?.object?.typeDesc || "";

  const canCopy = !!objDef?.definition;

  const onCopy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(objDef.definition);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = objDef.definition;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>DDL</h2>

        <div style={{ opacity: 0.85 }}>
          <strong>{fullName}</strong>
          {typeDesc ? (
            <span style={{ marginLeft: 10, opacity: 0.8 }}>{typeDesc}</span>
          ) : null}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={onCopy}
            disabled={!canCopy}
            style={{ padding: 10, fontWeight: 700, opacity: canCopy ? 1 : 0.5 }}
          >
            Copiar
          </button>

          <button onClick={onClear} style={{ padding: 10, fontWeight: 700 }}>
            Limpiar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 10, opacity: 0.8 }}>Cargando definición...</div>
      ) : error ? (
        <div style={{ marginTop: 10, color: "tomato" }}>{error}</div>
      ) : objDef?.hasDefinition ? (
        <div
          style={{
            marginTop: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <pre
            style={{
              margin: 0,
              padding: 12,
              whiteSpace: "pre",
              overflow: "auto",
              maxHeight: 520,
              lineHeight: 1.45,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 13,
              background: "rgba(0,0,0,0.18)",
            }}
          >
            {objDef.definition}
          </pre>
        </div>
      ) : (
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          Definición no disponible (posible <code>WITH ENCRYPTION</code>)
        </div>
      )}
    </div>
  );
}