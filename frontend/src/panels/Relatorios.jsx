import { useEffect, useMemo, useState } from "react";
import { api, apiRoot } from "../api";
import { formatNumber, label, PROVIDER, STATUS } from "../format";
import { Empty } from "../ui";

const REPORT_KINDS = [
  { id: "logs", name: "Erros de log", hint: "ERROR, FATAL e CRITICAL coletados nas amostras." },
  { id: "incidents", name: "Incidentes", hint: "Fila N1/N2 com severidade P1–P3 e status." },
  { id: "sla", name: "SLA de chamados", hint: "Jira, ServiceNow, GLPI e Zendesk." },
];

const EMPTY_FILTERS = {
  logLevel: "",
  logService: "",
  incidentQueue: "",
  incidentSeverity: "",
  incidentStatus: "",
  slaDays: "7",
  slaProvider: "",
  format: "csv",
};

function queryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export default function Relatorios({ tick, notify }) {
  const [options, setOptions] = useState(null);
  const [kind, setKind] = useState("logs");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [preview, setPreview] = useState(null);
  const [slaPreview, setSlaPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/api/reports/options")
      .then((payload) => active && setOptions(payload))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [tick]);

  const previewQuery = useMemo(() => {
    if (kind === "logs") {
      return queryString({ kind, level: filters.logLevel, service: filters.logService });
    }
    if (kind === "incidents") {
      return queryString({
        kind,
        queue: filters.incidentQueue,
        severity: filters.incidentSeverity,
        status: filters.incidentStatus,
      });
    }
    return queryString({ kind, days: filters.slaDays, provider: filters.slaProvider });
  }, [kind, filters]);

  useEffect(() => {
    if (!options) return;
    let active = true;
    api(`/api/reports/preview${previewQuery}`)
      .then((payload) => {
        if (!active) return;
        setPreview(payload);
        setSlaPreview(kind === "sla" && payload.metrics ? formatSlaSummary(payload.metrics) : "");
        setError("");
      })
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [options, previewQuery, kind, tick]);

  function changeFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function setReportKind(next) {
    setKind(next);
    setSlaPreview("");
  }

  const exportHref = useMemo(() => {
    const root = apiRoot();
    if (kind === "logs") {
      return `${root}/api/logs/export${queryString({
        format: filters.format,
        level: filters.logLevel,
        service: filters.logService,
      })}`;
    }
    if (kind === "incidents") {
      return `${root}/api/incidents/export${queryString({
        format: filters.format,
        queue: filters.incidentQueue,
        severity: filters.incidentSeverity,
        status: filters.incidentStatus,
      })}`;
    }
    return "";
  }, [kind, filters]);

  async function generateSla() {
    setBusy(true);
    try {
      const body = { days: Number(filters.slaDays) };
      if (filters.slaProvider) body.provider = filters.slaProvider;
      const result = await api("/api/tickets/report", { method: "POST", body: JSON.stringify(body) });
      setSlaPreview(result.preview);
      notify(
        result.simulate
          ? `Relatório salvo (${result.files.txt}). O e-mail não saiu: modo seguro ou SMTP vazio.`
          : `Relatório enviado. Cópia em ${result.files.txt}.`,
      );
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !options) return <p className="error">{error}</p>;
  if (!options) return <p className="muted">Carregando opções de filtro...</p>;

  return (
    <>
      <div className="toolbar">
        <p className="muted">
          Escolha o tipo de relatório e refine com os filtros principais. A contagem atualiza antes do download ou da geração.
        </p>
      </div>
      <section className="report-kind-grid">
        {REPORT_KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={kind === item.id ? "panel report-kind active" : "panel report-kind"}
            onClick={() => setReportKind(item.id)}
          >
            <strong>{item.name}</strong>
            <span className="muted">{item.hint}</span>
          </button>
        ))}
      </section>
      <form className="panel report-filters" onSubmit={(event) => event.preventDefault()}>
        <h2>Filtros · {REPORT_KINDS.find((item) => item.id === kind)?.name}</h2>
        {kind === "logs" ? (
          <div className="filter-grid">
            <label>
              Nível do log
              <select name="logLevel" value={filters.logLevel} onChange={changeFilter}>
                <option value="">Todos (ERROR, FATAL, CRITICAL)</option>
                {options.log_levels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Serviço
              <select name="logService" value={filters.logService} onChange={changeFilter}>
                <option value="">Todos os serviços</option>
                {options.log_services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Formato
              <select name="format" value={filters.format} onChange={changeFilter}>
                <option value="csv">CSV (Excel)</option>
                <option value="json">JSON</option>
              </select>
            </label>
          </div>
        ) : null}
        {kind === "incidents" ? (
          <div className="filter-grid">
            <label>
              Fila
              <select name="incidentQueue" value={filters.incidentQueue} onChange={changeFilter}>
                <option value="">N1 e N2</option>
                {options.incident_queues.map((queue) => (
                  <option key={queue} value={queue}>
                    {queue}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Severidade
              <select name="incidentSeverity" value={filters.incidentSeverity} onChange={changeFilter}>
                <option value="">P1, P2 e P3</option>
                {options.incident_severities.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="incidentStatus" value={filters.incidentStatus} onChange={changeFilter}>
                <option value="">Todos</option>
                {options.incident_statuses.map((status) => (
                  <option key={status} value={status}>
                    {label(STATUS, status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Formato
              <select name="format" value={filters.format} onChange={changeFilter}>
                <option value="csv">CSV (Excel)</option>
                <option value="json">JSON</option>
              </select>
            </label>
          </div>
        ) : null}
        {kind === "sla" ? (
          <div className="filter-grid">
            <label>
              Janela (dias)
              <select name="slaDays" value={filters.slaDays} onChange={changeFilter}>
                <option value="7">Últimos 7 dias</option>
                <option value="14">Últimos 14 dias</option>
                <option value="30">Últimos 30 dias</option>
              </select>
            </label>
            <label>
              Ferramenta
              <select name="slaProvider" value={filters.slaProvider} onChange={changeFilter}>
                <option value="">Todas</option>
                {options.ticket_providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {label(PROVIDER, provider)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <p className="muted">
          {preview ? (
            <>
              <strong>{preview.count}</strong> registro(s) na seleção atual.
            </>
          ) : (
            "Calculando a seleção..."
          )}
        </p>
        <div className="toolbar-actions">
          {kind === "sla" ? (
            <button className="primary" type="button" disabled={busy} onClick={generateSla}>
              Gerar relatório SLA
            </button>
          ) : (
            <a className="primary" href={exportHref}>
              Baixar relatório
            </a>
          )}
        </div>
      </form>
      <section className="panel stack">
        <h2>Pré-visualização</h2>
        {kind === "sla" && slaPreview ? <pre className="report">{slaPreview}</pre> : null}
        {kind !== "sla" ? (
          <Empty>Use Baixar relatório para exportar com os filtros acima. A contagem mostra quantas linhas entram no arquivo.</Empty>
        ) : null}
        {kind === "sla" && !slaPreview ? (
          <Empty>Clique em Gerar relatório SLA para gravar em data/reports e ver o texto aqui.</Empty>
        ) : null}
      </section>
    </>
  );
}

function formatSlaSummary(metrics) {
  const provider = metrics.provider_filter ? ` · ${label(PROVIDER, metrics.provider_filter)}` : "";
  return [
    `Janela: ${metrics.window_days} dias${provider}`,
    `Abertos: ${metrics.opened} · Fechados: ${metrics.closed} · Backlog: ${metrics.backlog}`,
    `Conformidade: ${formatNumber(metrics.compliance_percent)}% · MTTR: ${formatNumber(metrics.mttr_hours)} h`,
    `Primeira resposta: ${formatNumber(metrics.avg_first_response_hours)} h · Fora do SLA: ${metrics.breached}`,
  ].join("\n");
}
