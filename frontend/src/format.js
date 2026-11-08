export const STATUS = {
  aberto: "Aberto",
  em_analise: "Em análise",
  resolvido: "Resolvido",
  pendente: "Pendente",
  fechado: "Fechado",
  operacional: "Operacional",
  atencao: "Atenção",
  degradado: "Degradado",
  indisponivel: "Indisponível",
  simulado: "Simulado",
  executado: "Executado",
  ok: "Ok",
  acao: "Ação",
  nao_acoplado: "Sem acoplamento",
};

export const PROVIDER = {
  jira: "Jira",
  servicenow: "ServiceNow",
  glpi: "GLPI",
  zendesk: "Zendesk",
};

export function label(map, value) {
  return map[value] || value;
}

export function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function formatNumber(value, digits = 1) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function firstLine(value) {
  return String(value || "").split("\n")[0];
}

export function outsideSla(ticket) {
  const opened = new Date(ticket.opened_at).getTime();
  if (Number.isNaN(opened)) return false;
  const end = ticket.closed_at ? new Date(ticket.closed_at).getTime() : Date.now();
  return (end - opened) / 36e5 > Number(ticket.sla_hours);
}
