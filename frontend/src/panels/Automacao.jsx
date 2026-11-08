import { useEffect, useState } from "react";
import { api } from "../api";
import { formatWhen, label, STATUS } from "../format";
import { Badge, Empty, LoadFailure, Meter } from "../ui";

export default function Automacao({ tick, notify, refresh }) {
  const [host, setHost] = useState(null);
  const [runs, setRuns] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api("/api/automation/host"), api("/api/automation/runs")])
      .then(([hostPayload, runsPayload]) => {
        if (!active) return;
        setHost(hostPayload);
        setRuns(runsPayload.items);
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

  async function run(body, message) {
    setBusy(true);
    try {
      const payload = await api("/api/automation/run", { method: "POST", body: JSON.stringify(body) });
      setResult(payload);
      notify(message);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !host) return <LoadFailure />;
  if (!host) return <p className="muted">Lendo disco e memória...</p>;

  return (
    <>
      <div className="toolbar">
        <p className="muted">A leitura do host é real. O ensaio troca só o cenário da decisão. Com o modo seguro ligado, nenhum arquivo sai da sandbox e nenhum serviço do Windows é reiniciado.</p>
        <div className="actions">
          <button className="ghost" type="button" disabled={busy} onClick={() => run({}, "Verificação registrada com a leitura real.")}>Ler o host</button>
          <button className="primary" type="button" disabled={busy} onClick={() => run({ disk_percent: 96, memory_percent: 93 }, "Ensaio registrado. Nada foi apagado e nenhum serviço foi reiniciado.")}>Ensaiar pressão</button>
        </div>
      </div>
      <section className="split">
        <article className="panel">
          <h2>Leitura real · {host.mount}</h2>
          <Meter label="Disco" value={host.disk_percent} threshold={host.disk_threshold} />
          <Meter label="Memória" value={host.memory_percent} threshold={host.memory_threshold} />
        </article>
        <article className="panel">
          <h2>Última decisão</h2>
          {!result ? <Empty>Rode a leitura ou o ensaio para ver a ação proposta.</Empty> : (
            <>
              <p>{result.pressure ? `Cenário de ensaio: disco ${result.scenario.disk_percent}% e memória ${result.scenario.memory_percent}%. A barra ao lado continua sendo o host real.` : "Decisão em cima da leitura real."}</p>
              {result.actions.length === 0 ? <p>Nenhuma ação. Os dois recursos estão abaixo do limiar.</p> : result.actions.map((action) => (
                <p key={action.kind}><Badge kind="warn">{label(STATUS, action.status)}</Badge> {action.kind}: {action.detail}</p>
              ))}
              {result.alert ? <p className="report">{result.alert.message}</p> : null}
            </>
          )}
        </article>
      </section>
      <section className="panel stack">
        <h2>Histórico</h2>
        {runs.length === 0 ? <Empty>Ainda não houve verificação.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Quando</th><th>Ação</th><th>Situação</th><th>Detalhe</th></tr></thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{formatWhen(run.created_at)}</td>
                    <td>{run.kind}</td>
                    <td><Badge kind={run.simulate ? "warn" : "ok"}>{label(STATUS, run.status)}</Badge></td>
                    <td className="clamp" title={run.detail}>{run.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
