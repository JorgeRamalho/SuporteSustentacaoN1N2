import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Empty, LoadFailure } from "../ui";

export default function Conhecimento({ tick, notify }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      api(`/api/kb?q=${encodeURIComponent(q)}`)
        .then((payload) => {
          if (!active) return;
          setItems(payload.items);
          setError("");
        })
        .catch((err) => {
          if (!active) return;
          setError(err.message);
          notify?.(err.message, "error");
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [q, tick]);

  return (
    <>
      <label className="search">
        Buscar procedimento
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="oracle, disco, certificado" />
      </label>
      {error && !items ? <LoadFailure /> : null}
      {!items && !error ? <p className="muted">Abrindo a base...</p> : null}
      {items && items.length === 0 ? <Empty>Nenhum artigo com esses termos.</Empty> : null}
      {items && items.length > 0 ? (
        <div className="stack">
          {items.map((item) => (
            <article className="panel article" key={item.id}>
              <div><Badge kind={item.level.toLowerCase()}>{item.level}</Badge> {item.vendor ? <span className="muted">{item.vendor}</span> : null}</div>
              <h2>{item.title}</h2>
              <p>{item.symptoms}</p>
              <p><strong>Causa provável. </strong>{item.cause}</p>
              <p className="report">{item.resolution}</p>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
