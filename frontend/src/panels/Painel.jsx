import { useEffect, useState } from "react";
import { api } from "../api";
import { formatNumber, label, STATUS } from "../format";
import { Badge, Empty, LoadFailure, Meter } from "../ui";

export default function Painel({ tick, notify, refresh, navigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api("/api/dashboard")
      .then((payload) => {
        if (active) {
          setData(payload);
          setError("");
        }
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

  async function reprocess() {
    setBusy(true);
    try {
      const result = await api("/api/demo/reprocess", { method: "POST" });
      notify(`Amostras relidas: ${result.inserted} evento(s) e ${result.incidents} incidente(s).`);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <LoadFailure />;
  if (!data) return <p className="muted">Carregando a operação...</p>;
  const { kpis, host, services, incidents, alerts } = data;

  return (
    <>
      <div className="toolbar">
        <p className="muted">Os números de chamado e de incidente vêm do banco local. O host é a leitura real desta máquina.</p>
        <div className="toolbar-actions">
          <button className="primary" type="button" onClick={() => navigate?.("registro-n1")}>
            Registrar novo incidente (N1)
          </button>
          <button className="ghost" type="button" onClick={reprocess} disabled={busy}>
            Repetir amostras
          </button>
        </div>
      </div>
      <section className="kpis">
        <article className="kpi"><span>Incidentes abertos</span><strong>{kpis.open_incidents}</strong></article>
        <article className="kpi"><span>P1 abertos</span><strong>{kpis.p1}</strong></article>
        <article className="kpi"><span>Erros coletados</span><strong>{kpis.critical_logs}</strong></article>
        <article className="kpi"><span>SLA em 7 dias</span><strong>{formatNumber(kpis.sla_compliance)}%</strong></article>
      </section>
      <section className="split">
        <article className="panel">
          <h2>Host {host.mount}</h2>
          <div className="meters">
            <Meter label="Disco" value={host.disk_percent} threshold={host.disk_threshold} />
            <Meter label="Memória" value={host.memory_percent} threshold={host.memory_threshold} />
            <Meter label="CPU" value={host.cpu_percent} threshold={90} />
          </div>
          <p className="muted">MTTR da janela: {formatNumber(kpis.mttr_hours)} h. Chamados ainda abertos: {kpis.open_tickets}.</p>
        </article>
        <article className="panel">
          <h2>Serviços</h2>
          <div className="service-list">
            {services.map((service) => (
              <div className="service" key={service.name}>
                <div>
                  <strong>{service.name}</strong>
                  <div className="muted">{service.role} · fila {service.owner_level}</div>
                </div>
                <Badge kind={service.status}>{label(STATUS, service.status)}</Badge>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="split">
        <article className="panel">
          <h2>Incidentes recentes</h2>
          {incidents.length === 0 ? <Empty>Nenhum incidente aberto pelas amostras.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Fila</th><th>Serviço</th><th>Título</th></tr></thead>
                <tbody>
                  {incidents.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}<div><Badge kind={item.severity.toLowerCase()}>{item.severity}</Badge></div></td>
                      <td><Badge kind={item.level.toLowerCase()}>{item.level}</Badge></td>
                      <td>{item.service_name}</td>
                      <td className="clamp" title={item.title}>{item.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
        <article className="panel">
          <h2>Alertas</h2>
          {alerts.length === 0 ? <Empty>Nenhum alerta. O ensaio de disco grava um alerta simulado.</Empty> : alerts.map((alert) => (
            <div className="alert" key={alert.id}>
              <Badge kind={alert.simulate ? "warn" : "ok"}>{alert.simulate ? "Simulado" : alert.channel}</Badge>
              <span>{alert.message}</span>
            </div>
          ))}
        </article>
      </section>
    </>
  );
}
