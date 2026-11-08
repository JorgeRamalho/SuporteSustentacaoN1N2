/** Origem oficial da API — sempre 127.0.0.1 (alinhada ao console e aos scripts). */
const LOCAL_API_ORIGIN = "http://127.0.0.1:8010";
export const LOCAL_CONSOLE_URL = "http://127.0.0.1:5500/index.html";

const CONSOLE_PORTS = new Set(["5500", "5501", "5502"]);

function isFileFront() {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:";
}

function isLoopbackHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "127.0.0.1" || host === "localhost";
}

/** GitHub Pages e outros hosts públicos: console com snapshot local. */
export function isDemoHost() {
  if (typeof window === "undefined") return false;
  if (window.SENTINELA_DEMO_MODE === true) return true;
  return /\.github\.io$/i.test(window.location.hostname);
}

/** Onde a API Python está acessível (não inclui github.io). */
export function isLocalLab() {
  if (typeof window === "undefined") return false;
  if (isDemoHost()) return false;
  if (isFileFront()) return true;
  if (!isLoopbackHost()) return false;
  const port = window.location.port;
  if (port === "5173" || port === "8010") return true;
  return CONSOLE_PORTS.has(port);
}

/** @deprecated use isDemoHost */
export function isPublishedSite() {
  return isDemoHost();
}

export function canLoadData() {
  return isLocalLab() || isDemoHost();
}

export function localLabHelp() {
  return `API ou console parados. Na raiz do projeto execute npm start ou scripts\\Abrir-Sentinela.cmd e abra ${LOCAL_CONSOLE_URL}. Depois recarregue (F5).`;
}

export function apiRoot() {
  if (typeof window === "undefined") return "";
  const explicit = window.SENTINELA_API_ORIGIN;
  if (explicit) return String(explicit).replace(/\/$/, "");
  if (isDemoHost()) return "";
  if (isFileFront() || CONSOLE_PORTS.has(window.location.port)) return LOCAL_API_ORIGIN;
  return "";
}

export function docsUrl() {
  return `${apiRoot() || LOCAL_API_ORIGIN}/docs`;
}

function staticBasePath() {
  const path = window.location.pathname;
  if (path.endsWith("/index.html")) return path.slice(0, -"index.html".length);
  if (path.endsWith("/")) return path;
  return path.replace(/[^/]+$/, "");
}

let demoSnapshotPromise = null;

function loadDemoSnapshot() {
  if (!demoSnapshotPromise) {
    const url = `${window.location.origin}${staticBasePath()}frontend/demo/api-snapshot.json`;
    demoSnapshotPromise = fetch(url).then((response) => {
      if (!response.ok) throw new Error("Snapshot de demonstração não encontrado.");
      return response.json();
    });
  }
  return demoSnapshotPromise;
}

function demoLookup(snapshot, path) {
  if (snapshot[path]) return snapshot[path];
  const bare = path.split("?")[0];
  if (snapshot[bare]) return snapshot[bare];
  if (bare === "/api/kb" || path.startsWith("/api/kb?")) return snapshot["/api/kb?q="];
  if (path.startsWith("/api/reports/preview")) {
    return { count: 0, kind: "logs", items: [], note: "Prévia simulada no modo demonstração." };
  }
  return undefined;
}

function demoWriteResponse(path, body) {
  if (path === "/api/health") {
    return { status: "ok", app: "Sentinela", version: "1.0.0", simulate: true, allow_real_actions: false };
  }
  if (path.startsWith("/api/incidents") && path !== "/api/incidents/detect") {
    const title = body?.title || "Incidente (demonstração)";
    return {
      id: `demo-${Date.now()}`,
      title,
      severity: "P3",
      level: "N1",
      status: "aberto",
      summary: "[DEMO] Registro simulado.",
    };
  }
  return { ok: true, simulate: true, message: "[DEMO] Operação simulada." };
}

function validationDetail(detail) {
  if (!Array.isArray(detail) || detail.length === 0) return null;
  const first = detail[0];
  if (!first || typeof first.msg !== "string") return null;
  const path = Array.isArray(first.loc) ? first.loc.filter((part) => part !== "body").join(".") : "";
  if (path === "severity") {
    return "Nível inválido para a API em execução. Reinicie o backend (scripts\\subir-api.ps1) e tente de novo.";
  }
  return path ? `${path}: ${first.msg}` : first.msg;
}

function errorMessage(payload) {
  if (payload && typeof payload === "object" && payload.detail) {
    if (typeof payload.detail === "string") return payload.detail;
    const fromValidation = validationDetail(payload.detail);
    if (fromValidation) return fromValidation;
    return "A API recusou a operação.";
  }
  if (typeof payload === "string" && /<!doctype html/i.test(payload)) {
    return localLabHelp();
  }
  return "A API recusou a operação.";
}

export async function api(path, options = {}) {
  if (isDemoHost()) {
    const method = (options.method || "GET").toUpperCase();
    if (method !== "GET") {
      let body = {};
      if (options.body) {
        try {
          body = JSON.parse(options.body);
        } catch {
          body = {};
        }
      }
      return demoWriteResponse(path.split("?")[0], body);
    }
    const snapshot = await loadDemoSnapshot();
    const data = demoLookup(snapshot, path);
    if (data === undefined) {
      throw new Error(`[DEMO] Rota sem snapshot: ${path}`);
    }
    return data;
  }

  const response = await fetch(`${apiRoot()}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(errorMessage(payload));
  }
  return payload;
}
