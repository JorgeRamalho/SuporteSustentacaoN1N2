import { useCallback, useEffect, useState } from "react";
import { api, isLocalLab, isPublishedSite, localLabHelp, PUBLISHED_SITE_HELP } from "./api";
import Automacao from "./panels/Automacao";
import Chamados from "./panels/Chamados";
import Conhecimento from "./panels/Conhecimento";
import Conteudo from "./panels/Conteudo";
import Fornecedores from "./panels/Fornecedores";
import Incidentes from "./panels/Incidentes";
import Logs from "./panels/Logs";
import Painel from "./panels/Painel";
import RegistroIncidenteN1 from "./panels/RegistroIncidenteN1";
import Relatorios from "./panels/Relatorios";

const NAV = [
  ["painel", "Painel", "Leitura da manhã: fila, host e evidência."],
  ["relatorios", "Relatórios", "Exportação e SLA com os filtros que o operador usa no dia a dia."],
  ["logs", "Logs", "Só entra ERROR, FATAL e Exception."],
  ["incidentes", "Incidentes", "Assinatura repetida vira fila N1 ou N2."],
  ["automacao", "Automação", "Disco e memória. A ação padrão é ensaio."],
  ["chamados", "Chamados", "SLA das quatro ferramentas de service desk."],
  ["conhecimento", "Conhecimento", "O procedimento que o N1 executa antes de escalar."],
  ["fornecedores", "Fornecedores", "Quem acionar, com o contrato e o sinal do log."],
  ["conteudo", "Conteúdo", "Documentação da API: rotas, parâmetros e o Swagger ao vivo."],
];

const PANELS = {
  painel: Painel,
  relatorios: Relatorios,
  logs: Logs,
  incidentes: Incidentes,
  automacao: Automacao,
  chamados: Chamados,
  conhecimento: Conhecimento,
  fornecedores: Fornecedores,
  conteudo: Conteudo,
  "registro-n1": RegistroIncidenteN1,
};

const SECTION_HEADINGS = {
  "registro-n1": ["Registro de incidente", "Formulário N1: título, sintoma em produção e nível (Crítico a Baixo)."],
};

export default function App() {
  const [section, setSection] = useState("painel");
  const [health, setHealth] = useState(null);
  const [offline, setOffline] = useState(() => isPublishedSite());
  const [notice, setNotice] = useState(null);
  const published = isPublishedSite();

  const notify = useCallback((message, kind = "ok") => {
    setNotice({ message, kind });
  }, []);
  const [tick, setTick] = useState(0);
  const current = NAV.find(([id]) => id === section) || NAV[0];
  const heading = SECTION_HEADINGS[section] || [current[1], current[2]];
  const Panel = PANELS[section] || PANELS[current[0]];

  function navigate(target) {
    setSection(target);
    setNotice(null);
  }

  useEffect(() => {
    if (!isLocalLab()) return undefined;
    let active = true;
    api("/api/health")
      .then((data) => {
        if (!active) return;
        setHealth(data);
        setOffline(false);
      })
      .catch(() => {
        if (active) setOffline(true);
      });
    return () => {
      active = false;
    };
  }, [tick]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">S</span>
          <div>
            <strong>Sentinela</strong>
            <small>Sustentação N1 / N2</small>
          </div>
        </div>
        <nav aria-label="Seções">
          {NAV.map(([id, name]) => (
            <button key={id} type="button" aria-current={id === current[0] ? "page" : undefined} onClick={() => {
                setSection(id);
                setNotice(null);
              }}>
              {name}
            </button>
          ))}
        </nav>
        <p className="side-note">Laboratório de operação. Limpeza real só dentro de data/sandbox, e só com as duas travas desligadas.</p>
      </aside>
      <main className="main">
        <header className="top">
          <div>
            <h1>{heading[0]}</h1>
            <p className="muted">{heading[1]}</p>
          </div>
          {health ? (
            <span className={health.simulate ? "pill" : "pill bad"}>{health.simulate ? "Modo seguro" : "Ação real habilitada"}</span>
          ) : null}
        </header>
        {offline ? (
          <p className="notice bad" role="alert">
            {published ? PUBLISHED_SITE_HELP : localLabHelp()}
          </p>
        ) : null}
        {notice?.message ? (
          <p className={notice.kind === "error" ? "notice bad" : "notice"} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.message}
          </p>
        ) : null}
        <div className={current[0] === "conteudo" ? "workspace docs-workspace" : "workspace"}>
          {published ? (
            <p className="empty">Nenhum dado aqui — use o console local conforme o aviso acima.</p>
          ) : (
            <Panel tick={tick} notify={notify} refresh={() => setTick((value) => value + 1)} navigate={navigate} />
          )}
        </div>
      </main>
    </div>
  );
}
