import { readSession } from "./auth";

const ROLE_RANK = { N1: 1, N2: 2, N3: 3 };

const N1_SECTIONS = new Set(["chamados", "incidentes"]);

const N2_SECTIONS = new Set([
  "painel",
  "logs",
  "registro-n1",
  "conhecimento",
  "fornecedores",
  "automacao",
]);

const N3_SECTIONS = new Set(["relatorios", "conteudo"]);

export const SECTION_LABELS = {
  painel: "Painel",
  logs: "Logs",
  incidentes: "Incidentes",
  "registro-n1": "Registro de incidente",
  chamados: "Chamados",
  conhecimento: "Conhecimento",
  fornecedores: "Fornecedores",
  relatorios: "Relatórios",
  automacao: "Automação",
  conteudo: "Conteúdo",
};

export function normalizeRole(role) {
  const text = String(role || "N1").trim().toUpperCase();
  if (text === "N4" || text === "N5") return "N3";
  return ROLE_RANK[text] ? text : "N1";
}

export function roleFromSession(session) {
  return normalizeRole(session?.user?.role || readSession()?.user?.role);
}

export function sectionsFor(role) {
  const rank = ROLE_RANK[normalizeRole(role)] || 1;
  const allowed = new Set(N1_SECTIONS);
  if (rank >= 2) N2_SECTIONS.forEach((item) => allowed.add(item));
  if (rank >= 3) N3_SECTIONS.forEach((item) => allowed.add(item));
  return allowed;
}

export function defaultSectionFor(role) {
  return normalizeRole(role) === "N1" ? "incidentes" : "painel";
}

export function canAccessSection(role, sectionId) {
  return sectionsFor(role).has(sectionId);
}

export function minRoleForSection(sectionId) {
  if (N3_SECTIONS.has(sectionId)) return "N3";
  if (N2_SECTIONS.has(sectionId)) return "N2";
  return "N1";
}

export function accessDeniedMessage(role, sectionId) {
  const label = SECTION_LABELS[sectionId] || sectionId;
  const needed = minRoleForSection(sectionId);
  return `A função ${normalizeRole(role)} não libera ${label}. É necessário ${needed} ou superior.`;
}

export function canAccessApi(role, path, method = "GET") {
  const rank = ROLE_RANK[normalizeRole(role)] || 1;
  const bare = String(path || "").split("?")[0];
  const verb = String(method || "GET").toUpperCase();

  if (bare.startsWith("/api/auth")) return true;

  if (rank === 1) {
    return bare.startsWith("/api/tickets") || bare.startsWith("/api/incidents");
  }

  if (bare === "/openapi.json" && rank < 3) return false;
  if (bare.startsWith("/api/reports") && rank < 3) return false;
  if ((bare === "/api/logs/export" || bare === "/api/incidents/export") && rank < 3) return false;
  if (bare === "/api/tickets/report" && verb === "POST" && rank < 3) return false;
  if (bare === "/api/automation/run" && rank < 2) return false;
  if (bare === "/api/automation/runs" && rank < 2) return false;
  if (
    rank < 2
    && (bare.startsWith("/api/dashboard")
      || bare.startsWith("/api/logs")
      || bare.startsWith("/api/kb")
      || bare.startsWith("/api/vendors")
      || bare.startsWith("/api/automation")
      || bare.startsWith("/api/demo"))
  ) {
    return false;
  }
  return true;
}

export function assertApiAccess(path, method = "GET") {
  const role = roleFromSession();
  if (!canAccessApi(role, path, method)) {
    const hint =
      role === "N1" ? "N2" : role === "N2" && (path.includes("report") || path.includes("export")) ? "N3" : "N2";
    const error = new Error(`A função ${role} não libera esta operação. Peça apoio de ${hint} ou superior.`);
    error.status = 403;
    throw error;
  }
}
