import { useEffect, useState } from "react";
import { api, apiRoot } from "../api";
import { firstLine, formatWhen } from "../format";
import { Badge, Empty, LoadFailure } from "../ui";

export default function Logs({ tick, notify, refresh }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api("/api/logs")
      .then((payload) => {
        if (!active) return;
        setData(payload);
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

  async function scan() {
    setBusy(true);
    try {
      const result = await api("/api/logs/scan", { method: "POST", body: "{}" });
      notify(result.inserted === 0 ? "Nenhuma linha nova. A coleta não duplica o mesmo evento." : `${result.inserted} evento(s) novo(s).`);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <LoadFailure />;
  if (!data) return <p className="muted">Lendo a base de logs...</p>;

  const exportBase = `${apiRoot()}/api/logs/export`;

  return (
    <>
      <div className="toolbar">
        <p className="muted">{data.total} evento(s) críticos. INFO e DEBUG ficam de fora. A segunda leitura da mesma linha não cria outro registro.</p>
        <div className="actions">
          <button className="primary" type="button" onClick={scan} disabled={busy}>Ler amostras</button>
          <a className="ghost" href={`${exportBase}?format=csv`}>Baixar CSV</a>
          <a className="ghost" href={`${exportBase}?format=json`}>Baixar JSON</a>
        </div>
      </div>
      {data.items.length === 0 ? <Empty>Nenhum erro nas amostras.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Quando</th><th>Nível</th><th>Serviço</th><th>Mensagem</th></tr></thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>{formatWhen(item.logged_at)}</td>
                  <td><Badge kind={item.level === "FATAL" ? "p1" : "p2"}>{item.level}</Badge></td>
                  <td>{item.service_name}</td>
                  <td className="clamp" title={item.message}>{firstLine(item.message)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
