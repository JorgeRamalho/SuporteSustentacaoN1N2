import { useCallback, useEffect, useState } from "react";
import { api, canLoadData, localLabHelp } from "./api";
import AuthScreen from "./AuthScreen";
import { accessDeniedMessage, canAccessSection, defaultSectionFor, roleFromSession } from "./access";
import { AUTH_LOST_EVENT, clearSession, readSession } from "./auth";
import { AccessDenied } from "./ui";
import { formatClock, formatDay } from "./format";
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
  ["painel", "Painel", "O turno começa aqui: o que tratar, o host e o caminho sugerido."],
  ["logs", "Logs", "Só entra ERROR, FATAL e Exception."],
  ["incidentes", "Incidentes", "Assinatura repetida vira fila N1 ou N2."],
  ["relatorios", "Relatórios", "Exportação e SLA com os filtros que o operador usa no dia a dia."],
  ["automacao", "Automação", "Disco e memória. A ação padrão é ensaio."],
  ["chamados", "Chamados", "SLA das quatro ferramentas de service desk."],
  ["conhecimento", "Conhecimento", "O procedimento que o N1 executa antes de escalar."],
  ["conteudo", "Conteúdo", "Documentação da API: rotas, parâmetros e o Swagger ao vivo."],
  ["fornecedores", "Fornecedores", "Quem acionar, com o contrato e o sinal do log."],
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

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function NavIcon({ id }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    className: "nav-ico",
  };
  if (id === "painel") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (id === "logs") {
    return (
      <svg {...common}>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    );
  }
  if (id === "incidentes") {
    return (
      <svg {...common}>
        <path d="M12 4 3.5 19h17L12 4z" />
        <path d="M12 10v4M12 17h.01" />
      </svg>
    );
  }
  if (id === "relatorios") {
    return (
      <svg {...common}>
        <path d="M6 20V10M12 20V4M18 20v-7" />
      </svg>
    );
  }
  if (id === "automacao") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }
  if (id === "chamados") {
    return (
      <svg {...common}>
        <path d="M5 6h14v9H8l-3 3V6z" />
      </svg>
    );
  }
  if (id === "conhecimento") {
    return (
      <svg {...common}>
        <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5z" />
        <path d="M5 5.5A2.5 2.5 0 0 1 7.5 8H20" />
      </svg>
    );
  }
  if (id === "conteudo") {
    return (
      <svg {...common}>
        <path d="M8 8h8M8 12h8M8 16h5" />
        <rect x="4" y="3" width="16" height="18" rx="2" />
      </svg>
    );
  }
  if (id === "fornecedores") {
    return (
      <svg {...common}>
        <path d="M4 20V9l8-5 8 5v11" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }
  return null;
}

export default function App() {
  const [session, setSession] = useState(() => readSession());
  const [section, setSection] = useState("painel");
  const [health, setHealth] = useState(null);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState(null);

  const notify = useCallback((message, kind = "ok") => {
    setNotice({ message, kind });
  }, []);
  const [tick, setTick] = useState(0);
  const now = useNow();
  const role = roleFromSession(session);
  const visibleNav = NAV.filter(([id]) => canAccessSection(role, id));
  const current = NAV.find(([id]) => id === section) || visibleNav[0] || NAV[0];
  const heading = SECTION_HEADINGS[section] || [current[1], current[2]];
  const Panel = PANELS[section] || PANELS[current[0]];

  function navigate(target) {
    if (!canAccessSection(role, target)) {
      setNotice({ message: accessDeniedMessage(role, target), kind: "error" });
      return;
    }
    setSection(target);
    setNotice(null);
  }

  useEffect(() => {
    function onLost() {
      setSession(null);
    }
    window.addEventListener(AUTH_LOST_EVENT, onLost);
    return () => window.removeEventListener(AUTH_LOST_EVENT, onLost);
  }, []);

  useEffect(() => {
    if (!session?.token) return undefined;
    let active = true;
    api("/api/auth/me")
      .then((user) => {
        if (active) setSession((current) => (current ? { ...current, user } : current));
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          clearSession();
          setSession(null);
        }
      });
    return () => {
      active = false;
    };
  }, [session?.token]);

  useEffect(() => {
    if (!session) return;
    if (!canAccessSection(role, section)) {
      setSection(defaultSectionFor(role));
    }
  }, [role, section, session]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* a sessão local some mesmo se a API já tiver expirado */
    }
    clearSession();
    setSession(null);
    setSection("painel");
    setNotice(null);
  }

  useEffect(() => {
    if (!session || !canLoadData()) return undefined;
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
  }, [tick, session]);

  if (!session) {
    return <AuthScreen onAuthenticated={setSession} />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark" aria-hidden="true">S</span>
          <div>
            <strong>Sentinela</strong>
            <small>Sustentação N1 / N2</small>
          </div>
        </div>
        <nav aria-label="Seções">
          {visibleNav.map(([id, name, blurb]) => (
            <button
              key={id}
              type="button"
              title={blurb}
              aria-current={id === current[0] ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <NavIcon id={id} />
              <span>{name}</span>
              {id === "painel" ? <em className="nav-tag">Início</em> : null}
            </button>
          ))}
        </nav>
        <div className="side-status" role="status">
          <span className={offline ? "live-dot off" : health?.simulate === false ? "live-dot live" : "live-dot safe"} />
          <div>
            <strong>
              {offline ? "API sem resposta" : health ? (health.simulate ? "Modo seguro" : "Ação real ligada") : "Conferindo a API"}
            </strong>
            <small>
              {offline
                ? "O painel espera a API na porta 8010."
                : health?.simulate
                  ? "Ensaio não altera o sistema operacional."
                  : "Limpeza real só dentro de data/sandbox."}
            </small>
          </div>
        </div>
        <p className="side-note">Laboratório de operação. Limpeza real só dentro de data/sandbox, e só com as duas travas desligadas.</p>
      </aside>
      <main className="main">
        <header className="top">
          <div>
            <p className="eyebrow">Console de sustentação · {formatDay(now)}</p>
            <h1>{heading[0]}</h1>
            <p className="muted">{heading[1]}</p>
          </div>
          <div className="top-meta">
            <time className="top-clock" dateTime={now.toISOString()}>{formatClock(now)}</time>
            <div className="who">
              <span>
                {session.user?.name || session.user?.email}
                {session.user?.role || session.user?.sector ? (
                  <>
                    {" "}
                    · {session.user?.role || "N1"} · {session.user?.sector || "Suporte"}
                  </>
                ) : null}
              </span>
              <button type="button" className="ghost" onClick={logout}>
                Sair
              </button>
            </div>
            {health ? (
              <span className={health.simulate ? "pill" : "pill bad"}>{health.simulate ? "Modo seguro" : "Ação real habilitada"}</span>
            ) : null}
          </div>
        </header>
        {offline ? (
          <p className="notice bad" role="alert">
            {localLabHelp()}
          </p>
        ) : null}
        {notice?.message ? (
          <p className={notice.kind === "error" ? "notice bad" : "notice"} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.message}
          </p>
        ) : null}
        <div className={current[0] === "conteudo" ? "workspace docs-workspace" : "workspace"}>
          {canAccessSection(role, section) ? (
            <Panel
              tick={tick}
              notify={notify}
              refresh={() => setTick((value) => value + 1)}
              navigate={navigate}
              now={now}
              userRole={role}
            />
          ) : (
            <AccessDenied role={role} section={current[1]} onBack={() => navigate("painel")} />
          )}
        </div>
      </main>
    </div>
  );
}
