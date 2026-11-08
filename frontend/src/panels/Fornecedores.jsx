import { useEffect, useState } from "react";
import { api } from "../api";
import { Empty, LoadFailure } from "../ui";

export default function Fornecedores({ tick, notify }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/api/vendors")
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
    return () => {
      active = false;
    };
  }, [tick]);

  if (error && !items) return <LoadFailure />;
  if (!items) return <p className="muted">Carregando contratos...</p>;
  if (items.length === 0) return <Empty>Nenhum fornecedor cadastrado.</Empty>;

  return (
    <div className="stack">
      {items.map((item) => (
        <article className="panel vendor" key={item.id}>
          <h2>{item.name}</h2>
          <p>{item.product} · {item.category} · contrato de {item.contract_sla_hours} h</p>
          <p>Escalonamento: {item.escalation_contact}</p>
          <p className="muted">Sinais no log: {item.keywords}</p>
          <p>{item.notes}</p>
        </article>
      ))}
    </div>
  );
}
