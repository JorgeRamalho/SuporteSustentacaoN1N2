import { useEffect, useState } from "react";
import { api } from "../api";
import { formatWhen, label, STATUS } from "../format";
import { Badge, Empty, LoadFailure } from "../ui";

export default function Incidentes({ tick, notify, refresh, navigate }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api("/api/incidents")
      .then((payload) => {
        if (!active) return;
        setItems(payload.items);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        notify(err.message, "error");
      });
    return () => {
      active = false;
    };
  }, [tick]);

  async function detect() {
    setBusy(true);
    try {
      const result = await api("/api/incidents/detect", { method: "POST" });
      notify(result.created === 0 ? "Nenhum incidente novo. A assinatura já está na fila." : `${result.created} incidente(s) aberto(s).`);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function update(id, status) {
    try {
      await api(`/api/incidents/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify(`Incidente marcado como ${label(STATUS, status)}.`);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="muted">P1 e P2 vão para o N2. P3 com procedimento conhecido fica no N1. O fornecedor entra quando a mensagem contém o sinal cadastrado.</p>
        <div className="toolbar-actions">
          <button className="primary" type="button" onClick={() => navigate?.("registro-n1")}>
            Registrar novo incidente (N1)
          </button>
          <button className="ghost" type="button" onClick={detect} disabled={busy}>
            Detectar incidentes
          </button>
        </div>
      </div>
      {error && !items ? <LoadFailure /> : null}
      {!items && !error ? <p className="muted">Montando a fila...</p> : null}
      {items && items.length === 0 ? <Empty>Nenhum incidente. Leia os logs e rode a detecção.</Empty> : null}
      {items && items.length > 0 ? (
        <div className="stack">
          {items.map((item) => (
            <article className="panel" key={item.id}>
              <div className="toolbar">
                <div>
                  <strong>{item.code}</strong> <Badge kind={item.severity.toLowerCase()}>{item.severity}</Badge> <Badge kind={item.level.toLowerCase()}>{item.level}</Badge>
                  <p>{item.title}</p>
                  <p className="muted">{item.summary} Registrado em {formatWhen(item.opened_at)}.</p>
                </div>
                <label>
                  Situação
                  <select aria-label={`Situação de ${item.code}`} value={item.status} onChange={(event) => update(item.id, event.target.value)}>
                    <option value="aberto">Aberto</option>
                    <option value="em_analise">Em análise</option>
                    <option value="resolvido">Resolvido</option>
                  </select>
                </label>
              </div>
              <p>{item.vendor ? `Fornecedor: ${item.vendor.name} · ${item.vendor.escalation_contact} · contrato ${item.vendor.contract_sla_hours} h` : "Sem fornecedor associado."}</p>
              <details>
                <summary>{item.article ? `Procedimento: ${item.article.title} (${item.article.level})` : "Sem artigo aderente"}</summary>
                <p>{item.article ? item.article.cause : "Escalar ao N2 com a assinatura e vinte linhas de contexto."}</p>
                <p>{item.article ? item.article.resolution : ""}</p>
                <p className="muted">Assinatura: {item.signature}</p>
              </details>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
