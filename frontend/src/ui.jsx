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

export function AccessDenied({ role, section, onBack }) {
  return (
    <section className="panel access-denied">
      <h2>Acesso restrito</h2>
      <p className="muted">
        A função <strong>{role}</strong> não libera esta área do console. A liberação segue a maturidade
        operacional: N1 libera só chamados e incidentes; painel, logs e automação pedem N2; relatórios e documentação da API pedem N3.
      </p>
      {section ? <p className="muted">Seção solicitada: {section}.</p> : null}
      <button type="button" className="primary" onClick={onBack}>
        Voltar ao painel
      </button>
    </section>
  );
}

export function LoadFailure() {
  return (
    <p className="muted" role="status">
      Não foi possível carregar esta seção. Veja o aviso em vermelho no topo; se precisar, suba a API com <code>scripts\subir-api.ps1</code> e recarregue (F5).
    </p>
  );
}
