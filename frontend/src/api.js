/** Origem oficial da API — sempre 127.0.0.1 (alinhada ao console e aos scripts). */
const LOCAL_API_ORIGIN = "http://127.0.0.1:8010";
export const LOCAL_CONSOLE_URL = "http://127.0.0.1:5500/index.html";

const CONSOLE_PORTS = new Set(["5500", "5501", "5502"]);

export const PUBLISHED_SITE_HELP =
  "Você está no GitHub Pages (só o código publicado). O Sentinela com API funciona no seu computador: na raiz do projeto rode npm start ou scripts\\Abrir-Sentinela.cmd e abra " +
  LOCAL_CONSOLE_URL;

function isFileFront() {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:";
}

function isLoopbackHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "127.0.0.1" || host === "localhost";
}

/** Onde a API Python está acessível (não inclui github.io). */
export function isLocalLab() {
  if (typeof window === "undefined") return false;
  if (isFileFront()) return true;
  if (!isLoopbackHost()) return false;
  const port = window.location.port;
  if (port === "5173" || port === "8010") return true;
  return CONSOLE_PORTS.has(port);
}

export function isPublishedSite() {
  return typeof window !== "undefined" && !isLocalLab();
}

export function localLabHelp() {
  return `API ou console parados. Na raiz do projeto execute npm start ou scripts\\Abrir-Sentinela.cmd e abra ${LOCAL_CONSOLE_URL}. Depois recarregue (F5).`;
}

export function apiRoot() {
  if (typeof window === "undefined") return "";
  const explicit = window.SENTINELA_API_ORIGIN;
  if (explicit) return String(explicit).replace(/\/$/, "");
  if (isPublishedSite()) return "";
  if (isFileFront() || CONSOLE_PORTS.has(window.location.port)) return LOCAL_API_ORIGIN;
  return "";
}

export function docsUrl() {
  return `${apiRoot() || LOCAL_API_ORIGIN}/docs`;
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
  if (isPublishedSite()) return PUBLISHED_SITE_HELP;
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
  if (isPublishedSite()) {
    throw new Error(PUBLISHED_SITE_HELP);
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
