import { useEffect, useState } from "react";
import { canAccessSection } from "../access";
import { api } from "../api";
import { formatNumber, formatWhen, label, STATUS } from "../format";
import { Badge, Empty, LoadFailure } from "../ui";

const ROUTE = [
  {
    id: "logs",
    step: "01",
    title: "Ler a evidência",
    detail: "ERROR, FATAL e Exception. INFO fica de fora. Reler as amostras não duplica a mesma linha.",
  },
  {
    id: "incidentes",
    step: "02",
    title: "Classificar a fila",
    detail: "A assinatura repetida define N1 ou N2. Trate P1 antes de P2 e P3.",
  },
  {
    id: "conhecimento",
    step: "03",
    title: "Executar o procedimento",
    detail: "O artigo traz causa e resolução. O N1 segue isso antes de escalar.",
  },
  {
    id: "automacao",
    step: "04",
    title: "Ensaiar o host",
    detail: "Disco e memória desta máquina. No modo seguro o alerta nasce simulado.",
  },
  {
    id: "chamados",
    step: "05",
    title: "Medir o SLA",
    detail: "Abertos, fechados, MTTR e primeira resposta nas quatro ferramentas.",
  },
  {
    id: "relatorios",
    step: "06",
    title: "Exportar o turno",
    detail: "Os mesmos filtros do dia a dia, prontos para o compilado da semana.",
  },
];

const STATUS_ORDER = ["indisponivel", "degradado", "atencao", "operacional"];

function countLabel(count, singular, plural) {
  const value = Number(count) || 0;
  return `${value.toLocaleString("pt-BR")} ${value === 1 ? singular : plural}`;
}

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function hotHost(host) {
  return {
    disk: Number(host.disk_percent) >= Number(host.disk_threshold),
    memory: Number(host.memory_percent) >= Number(host.memory_threshold),
  };
}

function buildPosture(kpis, host, services) {
  const heat = hotHost(host);
  const down = services.some((service) => service.status === "indisponivel");
  if (kpis.p1 > 0 || down) {
    return {
      tone: "critical",
      title: "Prioridade neste momento",
      detail: `${countLabel(kpis.p1, "P1 aberto", "P1 abertos")} e ${countLabel(kpis.open_incidents, "incidente sem resolução", "incidentes sem resolução")}. Comece pelo procedimento e só depois fale com o fornecedor.`,
    };
  }
  const sla = Number(kpis.sla_compliance);
  if (heat.disk || heat.memory || kpis.open_incidents > 0 || sla < 95) {
    const bits = [];
    if (kpis.open_incidents > 0) bits.push(countLabel(kpis.open_incidents, "incidente em aberto", "incidentes em aberto"));
    if (heat.disk) bits.push("disco acima do limiar");
    if (heat.memory) bits.push("memória acima do limiar");
    if (sla < 95) bits.push(`SLA em ${formatNumber(sla)}%`);
    return {
      tone: "warn",
      title: "Há sinais para tratar neste turno",
      detail: `${bits.join(", ")}. Os cartões abaixo dizem por onde começar.`,
    };
  }
  return {
    tone: "calm",
    title: "A operação está estável nesta leitura",
    detail: "Sem P1, host dentro do limiar e SLA confortável. Percorra o roteiro se for demonstrar o console.",
  };
}

function buildSuggestions(data, role) {
  const { kpis, host, services, incidents } = data;
  const items = [];
  const heat = hotHost(host);
  const stressed = services.filter((service) => service.status === "indisponivel" || service.status === "degradado");

  if (kpis.p1 > 0) {
    items.push({
      tone: "critical",
      eyebrow: "Prioridade",
      title: "Trate o P1 antes do restante da fila",
      detail: `${countLabel(kpis.p1, "incidente P1 ainda está aberto", "incidentes P1 ainda estão abertos")}. Abra a ficha, siga o procedimento e confirme se a fila é N1 ou N2 antes de escalar.`,
      action: "Abrir incidentes",
      target: "incidentes",
    });
  }

  if (stressed.length > 0) {
    const first = stressed[0];
    items.push({
      tone: "warn",
      eyebrow: "Serviço",
      title: `${first.name} está ${label(STATUS, first.status).toLowerCase()}`,
      detail: stressed.length > 1
        ? `${countLabel(stressed.length, "serviço saiu", "serviços saíram")} do operacional. O estado acompanha o incidente aberto — confira a evidência no log.`
        : `${first.role}. A fila dona é ${first.owner_level}. Veja o incidente ligado a esse nome.`,
      action: "Ver a fila",
      target: "incidentes",
    });
  }

  if (heat.disk || heat.memory) {
    const title = heat.disk && heat.memory
      ? "Disco e memória passaram do limiar"
      : heat.disk
        ? "O disco passou do limiar"
        : "A memória passou do limiar";
    items.push({
      tone: "warn",
      eyebrow: "Host",
      title,
      detail: `Disco ${formatNumber(host.disk_percent)}% (limiar ${host.disk_threshold}%) e memória ${formatNumber(host.memory_percent)}% (limiar ${host.memory_threshold}%). O ensaio em Automação grava o alerta e deixa o serviço do sistema como está.`,
      action: "Ensaiar em Automação",
      target: "automacao",
    });
  }

  if (Number(kpis.sla_compliance) < 95) {
    items.push({
      tone: "warn",
      eyebrow: "SLA",
      title: "A semana pede uma leitura de chamado",
      detail: `Conformidade em ${formatNumber(kpis.sla_compliance)}%, MTTR de ${formatNumber(kpis.mttr_hours)} h e ${countLabel(kpis.open_tickets, "chamado ainda aberto", "chamados ainda abertos")}. O relatório mostra a primeira resposta e o que ficou fora.`,
      action: "Abrir chamados",
      target: "chamados",
    });
  }

  if (kpis.critical_logs > 0 && kpis.p1 === 0) {
    items.push({
      tone: "info",
      eyebrow: "Evidência",
      title: "Há erro coletado para revisar",
      detail: `${countLabel(kpis.critical_logs, "evento crítico no banco", "eventos críticos no banco")}. Só entram ERROR, FATAL e Exception. Se nada mudou nas amostras, a releitura devolve zero.`,
      action: "Abrir logs",
      target: "logs",
    });
  }

  const withArticle = incidents.find((item) => item.article);
  if (withArticle) {
    items.push({
      tone: "info",
      eyebrow: "Procedimento",
      title: "Já existe artigo para um incidente recente",
      detail: `${withArticle.code}: ${withArticle.article.title}. Execute esse passo no N1 antes de falar com fornecedor.`,
      action: "Abrir conhecimento",
      target: "conhecimento",
    });
  }

  const withVendor = incidents.find((item) => item.vendor);
  if (withVendor?.vendor) {
    items.push({
      tone: "info",
      eyebrow: "Fornecedor",
      title: `${withVendor.vendor.name} está ligado a um incidente`,
      detail: `${withVendor.code} aponta para ${withVendor.vendor.product}, com contrato de ${withVendor.vendor.contract_sla_hours} h. Use o contato de escalação só depois do procedimento.`,
      action: "Ver fornecedores",
      target: "fornecedores",
    });
  }

  if (items.length === 0) {
    items.push({
      tone: "ok",
      eyebrow: "Turno estável",
      title: "Nada crítico nesta leitura",
      detail: "Fila sem P1, host dentro do limiar e SLA confortável. O roteiro no fim da tela percorre logs, incidentes, automação e chamados.",
      action: "Ver logs",
      target: "logs",
    });
  }

  const register = {
    tone: "info",
    eyebrow: "Registro",
    title: "Abriu um caso novo em produção?",
    detail: "O formulário N1 pede título, sintoma e o nível, de Crítico a Baixo. A próxima leitura do painel passa a contar esse incidente.",
    action: "Registrar incidente",
    target: "registro-n1",
  };
  const allowed = items.filter((item) => canAccessSection(role, item.target)).slice(0, 3);
  const tail = canAccessSection(role, register.target) ? [register] : [];
  return [...allowed, ...tail];
}

function useCountUp(target) {
  const end = Number(target) || 0;
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(end);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / 780);
      const eased = 1 - (1 - progress) ** 3;
      setValue(end * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [end]);
  return value;
}

function KpiCard({ labelText, value, digits = 0, suffix = "", hint, cta, tone, onOpen }) {
  const shown = useCountUp(value);
  const text = digits === 0
    ? Math.round(shown).toLocaleString("pt-BR")
    : shown.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (
    <button type="button" className={`kpi dash-kpi tone-${tone}`} onClick={onOpen}>
      <span>{labelText}</span>
      <strong>{text}{suffix}</strong>
      <small>{hint}</small>
      <em>{cta}</em>
    </button>
  );
}

function Ring({ name, value, threshold, hint }) {
  const number = Math.max(0, Math.min(100, Number(value) || 0));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(number));
    return () => cancelAnimationFrame(frame);
  }, [number]);
  const hot = number >= Number(threshold);
  const warm = !hot && number >= Number(threshold) * 0.85;
  const tone = hot ? "hot" : warm ? "warm" : "calm";
  return (
    <div className={`ring-wrap tone-${tone}`}>
      <div className="ring" style={{ "--p": `${shown}%` }}>
        <div className="ring-face">
          <strong>{number.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
          <span>{name}</span>
        </div>
      </div>
      <small>Limiar {threshold}%</small>
      <p>{hint}</p>
    </div>
  );
}

function hostHint(name, hot, warm) {
  if (hot) return `${name} acima do limiar. O ensaio em Automação mostra o alerta sem mexer no sistema.`;
  if (warm) return `${name} perto do limiar. Vale olhar antes que vire alerta.`;
  return `${name} dentro do limiar configurado para esta máquina.`;
}

export default function Painel({ tick, notify, refresh, navigate, now, userRole = "N1" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const clock = now instanceof Date ? now : new Date();

  useEffect(() => {
    let active = true;
    api("/api/dashboard")
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
  }, [tick, notify]);

  function spotlight(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

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
  if (!data) {
    return (
      <div className="dash-skeleton" aria-busy="true" aria-live="polite">
        <span />
        <span />
        <span />
        <p className="muted">Montando a leitura do turno...</p>
      </div>
    );
  }

  const { kpis, host, services, incidents, alerts } = data;
  const posture = buildPosture(kpis, host, services);
  const suggestions = buildSuggestions(data, userRole);
  const primary = suggestions[0];
  const routeSteps = ROUTE.filter((step) => canAccessSection(userRole, step.id));
  const canAutomacao = canAccessSection(userRole, "automacao");
  const heat = hotHost(host);
  const cpu = Number(host.cpu_percent) || 0;
  const openShare = kpis.open_incidents > 0 ? Math.min(100, (kpis.p1 / kpis.open_incidents) * 100) : 0;
  const mix = STATUS_ORDER
    .map((status) => ({ status, count: services.filter((service) => service.status === status).length }))
    .filter((item) => item.count > 0);
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(clock);
  const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

  return (
    <div className="dash">
      <section className={`dash-hero tone-${posture.tone}`} onPointerMove={spotlight}>
        <div className="dash-hero-copy">
          <p className="dash-kicker">{greetingFor(clock)} · {dayLabel}</p>
          <h2>{posture.title}</h2>
          <p>{posture.detail}</p>
        </div>
        <div className="dash-scope" aria-hidden="true">
          <span className="dash-sweep" />
          <span className="dash-blip" />
          <div className="dash-scope-core">
            <strong>{kpis.open_incidents}</strong>
            <span>abertos</span>
          </div>
        </div>
        <div className="dash-hero-actions">
          {primary ? (
            <button className="primary" type="button" onClick={() => navigate?.(primary.target)}>
              {primary.action}
            </button>
          ) : null}
          {primary?.target !== "registro-n1" && canAccessSection(userRole, "registro-n1") ? (
            <button className="ghost" type="button" onClick={() => navigate?.("registro-n1")}>
              Registrar incidente N1
            </button>
          ) : null}
          <button className="ghost" type="button" onClick={() => refresh?.()}>
            Atualizar leitura
          </button>
          <button className="ghost" type="button" onClick={reprocess} disabled={busy}>
            {busy ? "Relendo amostras..." : "Repetir amostras"}
          </button>
        </div>
      </section>

      <section className="dash-block" aria-labelledby="suggest-title">
        <div className="dash-head">
          <h2 id="suggest-title">O que fazer agora</h2>
          <p>Cada cartão nasce dos números desta leitura e leva direto à seção que resolve o ponto.</p>
        </div>
        <div className="dash-suggest">
          {suggestions.map((item) => (
            <article key={`${item.target}-${item.eyebrow}`} className={`suggest tone-${item.tone}`}>
              <p className="suggest-eye">{item.eyebrow}</p>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <button type="button" className="ghost" onClick={() => navigate?.(item.target)}>
                {item.action}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="kpis dash-kpis" aria-label="Indicadores do turno">
        <KpiCard
          labelText="Incidentes abertos"
          value={kpis.open_incidents}
          tone={kpis.open_incidents > 0 ? "warn" : "calm"}
          hint={kpis.open_incidents > 0 ? `${formatNumber(openShare, 0)}% deles são P1.` : "Nenhum incidente sem resolução."}
          cta="Abrir a fila"
          onOpen={() => navigate?.("incidentes")}
        />
        <KpiCard
          labelText="P1 abertos"
          value={kpis.p1}
          tone={kpis.p1 > 0 ? "critical" : "calm"}
          hint="Severidade máxima. Entra na frente de P2 e P3."
          cta="Tratar agora"
          onOpen={() => navigate?.("incidentes")}
        />
        <KpiCard
          labelText="Erros coletados"
          value={kpis.critical_logs}
          tone="info"
          hint="A conta ignora INFO e DEBUG."
          cta="Ver a evidência"
          onOpen={() => navigate?.("logs")}
        />
        <KpiCard
          labelText="SLA em 7 dias"
          value={kpis.sla_compliance}
          digits={1}
          suffix="%"
          tone={Number(kpis.sla_compliance) < 80 ? "critical" : Number(kpis.sla_compliance) < 95 ? "warn" : "calm"}
          hint={`MTTR ${formatNumber(kpis.mttr_hours)} h · ${countLabel(kpis.open_tickets, "chamado aberto", "chamados abertos")}.`}
          cta="Medir chamados"
          onOpen={() => navigate?.("chamados")}
        />
      </section>

      <section className="dash-split">
        <article className="panel dash-panel">
          <div className="dash-head">
            <h2>Host {host.mount || "local"}</h2>
            <p>Verde dentro do limiar, âmbar perto, vermelho acima. O anel acompanha a leitura atual.</p>
          </div>
          <div className="rings">
            <Ring
              name="Disco"
              value={host.disk_percent}
              threshold={host.disk_threshold}
              hint={hostHint("Disco", heat.disk, !heat.disk && Number(host.disk_percent) >= Number(host.disk_threshold) * 0.85)}
            />
            <Ring
              name="Memória"
              value={host.memory_percent}
              threshold={host.memory_threshold}
              hint={hostHint("Memória", heat.memory, !heat.memory && Number(host.memory_percent) >= Number(host.memory_threshold) * 0.85)}
            />
            <Ring
              name="CPU"
              value={cpu}
              threshold={90}
              hint={hostHint("CPU", cpu >= 90, cpu < 90 && cpu >= 76.5)}
            />
          </div>
        </article>
        <article className="panel dash-panel">
          <div className="dash-head">
            <h2>Serviços</h2>
            <p>O estado muda com o incidente aberto. A faixa resume a malha inteira.</p>
          </div>
          {services.length === 0 ? <Empty>Nenhum serviço monitorado nesta base.</Empty> : (
            <>
              <div className="stackbar" aria-hidden="true">
                {mix.map((item) => (
                  <span key={item.status} className={`stackseg ${item.status}`} style={{ width: `${(item.count / services.length) * 100}%` }} />
                ))}
              </div>
              <ul className="stacklegend">
                {mix.map((item) => (
                  <li key={item.status}>
                    <i className={item.status} />
                    {label(STATUS, item.status)} · {item.count}
                  </li>
                ))}
              </ul>
              <div className="service-board">
                {services.map((service) => (
                  <button key={service.name} type="button" className={`svc tone-${service.status}`} onClick={() => navigate?.("incidentes")}>
                    <span className={`svc-dot ${service.status}`} />
                    <span>
                      <strong>{service.name}</strong>
                      <small>{service.role} · fila {service.owner_level}</small>
                    </span>
                    <Badge kind={service.status}>{label(STATUS, service.status)}</Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </article>
      </section>

      <section className="dash-split">
        <article className="panel dash-panel">
          <div className="dash-head">
            <h2>Incidentes recentes</h2>
            <p>Os seis mais novos. Se houver artigo, o texto aponta o procedimento.</p>
          </div>
          {incidents.length === 0 ? <Empty>Nenhum incidente aberto pelas amostras.</Empty> : (
            <div className="incident-feed">
              {incidents.map((item) => (
                <button key={item.id} type="button" className="incident-card" onClick={() => navigate?.("incidentes")}>
                  <span className="incident-top">
                    <strong>{item.code}</strong>
                    <Badge kind={String(item.severity || "").toLowerCase()}>{item.severity}</Badge>
                    <Badge kind={String(item.level || "").toLowerCase()}>{item.level}</Badge>
                  </span>
                  <span className="incident-title">{item.title}</span>
                  <small>{item.service_name} · {formatWhen(item.opened_at)}</small>
                  <small className="incident-hint">
                    {item.article
                      ? `Procedimento: ${item.article.title}`
                      : "Sem artigo ligado. Consulte Conhecimento antes de escalar."}
                  </small>
                </button>
              ))}
            </div>
          )}
        </article>
        <article className="panel dash-panel">
          <div className="dash-head">
            <h2>Alertas</h2>
            <p>O ensaio de disco grava um alerta simulado. Ação real continua travada no modo seguro.</p>
          </div>
          {alerts.length === 0 ? <Empty>Nenhum alerta nesta leitura.</Empty> : (
            <div className="alert-feed">
              {alerts.map((alert) => (
                <article key={alert.id} className="alert-card">
                  <span className="incident-top">
                    <Badge kind={alert.simulate ? "warn" : "ok"}>{alert.simulate ? "Simulado" : alert.channel}</Badge>
                    <small>{formatWhen(alert.created_at)}</small>
                  </span>
                  <p>{alert.message}</p>
                </article>
              ))}
            </div>
          )}
          {canAutomacao ? (
            <button type="button" className="ghost" onClick={() => navigate?.("automacao")}>
              Ir para o ensaio
            </button>
          ) : null}
        </article>
      </section>

      <section className="dash-block" aria-labelledby="route-title">
        <div className="dash-head">
          <h2 id="route-title">Roteiro do turno</h2>
          <p>
            {routeSteps.length} passos liberados para a função {userRole}. Cada um abre a seção correspondente.
          </p>
        </div>
        <ol className="route">
          {routeSteps.map((step) => (
            <li key={step.id}>
              <button type="button" onClick={() => navigate?.(step.id)}>
                <span className="route-step">{step.step}</span>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
