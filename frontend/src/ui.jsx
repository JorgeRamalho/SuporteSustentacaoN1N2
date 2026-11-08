export function Badge({ kind, children }) {
  return <span className={`badge ${kind || ""}`}>{children}</span>;
}

export function Meter({ label, value, threshold }) {
  const number = Number(value) || 0;
  const hot = number >= Number(threshold);
  return (
    <div className="meter">
      <div className="meter-top">
        <span>{label}</span>
        <strong>{number.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
      </div>
      <div className="meter-track" aria-hidden="true">
        <div className={hot ? "meter-fill hot" : "meter-fill"} style={{ width: `${Math.min(number, 100)}%` }} />
      </div>
      <small>Limiar {threshold}%</small>
    </div>
  );
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

export function LoadFailure() {
  return (
    <p className="muted" role="status">
      Não foi possível carregar esta seção. Veja o aviso em vermelho no topo; se precisar, suba a API com <code>scripts\subir-api.ps1</code> e recarregue (F5).
    </p>
  );
}
