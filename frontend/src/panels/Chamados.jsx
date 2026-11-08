import { useEffect, useState } from "react";
import { api } from "../api";
import { formatNumber, formatWhen, label, outsideSla, PROVIDER, STATUS } from "../format";
import { Badge, Empty, LoadFailure } from "../ui";

export default function Chamados({ tick, notify, refresh }) {
  const [tickets, setTickets] = useState(null);
  const [sla, setSla] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api("/api/tickets"), api("/api/tickets/sla?days=7")])
      .then(([ticketPayload, slaPayload]) => {
        if (!active) return;
        setTickets(ticketPayload.items);
        setSla(slaPayload);
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

  async function sync() {
    setBusy(true);
    try {
      const result = await api("/api/tickets/sync", { method: "POST" });
      notify(`${result.synced} chamado(s) sincronizados. Sem token, a origem é o catálogo de demonstração.`);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    setBusy(true);
    try {
      const result = await api("/api/tickets/report", { method: "POST", body: JSON.stringify({ days: 7 }) });
      setPreview(result.preview);
      notify(result.simulate ? `Relatório salvo (${result.files.txt}). O e-mail não saiu: modo seguro ou SMTP vazio.` : `Relatório enviado. Cópia em ${result.files.txt}.`);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error && (!tickets || !sla)) return <LoadFailure />;
  if (!tickets || !sla) return <p className="muted">Calculando o SLA...</p>;

  return (
    <>
      <div className="toolbar">
        <p className="muted">Jira, ServiceNow, GLPI e Zendesk. Sem URL e token, o laboratório usa oito chamados fictícios para o relatório existir na entrevista.</p>
        <div className="actions">
          <button className="ghost" type="button" disabled={busy} onClick={sync}>Atualizar chamados</button>
          <button className="primary" type="button" disabled={busy} onClick={report}>Gerar relatório</button>
        </div>
      </div>
      <section className="kpis">
        <article className="kpi"><span>Abertos na janela</span><strong>{sla.opened}</strong></article>
        <article className="kpi"><span>Fechados na janela</span><strong>{sla.closed}</strong></article>
        <article className="kpi"><span>Backlog</span><strong>{sla.backlog}</strong></article>
        <article className="kpi"><span>Conformidade</span><strong>{formatNumber(sla.compliance_percent)}%</strong></article>
      </section>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Ferramenta</th><th>Prioridade</th><th>Situação</th><th>SLA</th><th>Título</th></tr></thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>{ticket.external_id}</td>
                <td>{label(PROVIDER, ticket.provider)}</td>
                <td>{ticket.priority}</td>
                <td>{label(STATUS, ticket.status)}<div className="muted">{formatWhen(ticket.opened_at)}</div></td>
                <td><Badge kind={outsideSla(ticket) ? "bad" : "ok"}>{outsideSla(ticket) ? "Fora do SLA" : "No prazo"}</Badge></td>
                <td className="clamp" title={ticket.title}>{ticket.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="panel stack">
        <h2>Compilado</h2>
        {preview ? <pre className="report">{preview}</pre> : <Empty>O botão Gerar relatório grava o texto e, em modo seguro, não envia e-mail.</Empty>}
      </section>
    </>
  );
}
