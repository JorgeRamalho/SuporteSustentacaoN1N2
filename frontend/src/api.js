/** Origem oficial da API — sempre 127.0.0.1 (alinhada ao console e aos scripts). */
const LOCAL_API_ORIGIN = "http://127.0.0.1:8010";

function isFileFront() {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "file:";
}

function isLiveServerFront() {
  if (typeof window === "undefined") return false;
  if (window.location.port === "5173") return false;
  const host = window.location.hostname;
  if (host !== "127.0.0.1" && host !== "localhost") return false;
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

export function apiRoot() {
  if (typeof window === "undefined") return "";
  const explicit = window.SENTINELA_API_ORIGIN;
  if (explicit) return String(explicit).replace(/\/$/, "");
  if (isFileFront() || isLiveServerFront()) return LOCAL_API_ORIGIN;
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
  if (payload && typeof payload === "object" && payload.detail) {
    if (typeof payload.detail === "string") return payload.detail;
    const fromValidation = validationDetail(payload.detail);
    if (fromValidation) return fromValidation;
    return "A API recusou a operação.";
  }
  if (typeof payload === "string" && /<!doctype html/i.test(payload)) {
    return "A API não está neste endereço. Suba o backend com scripts\\subir-api.ps1 e recarregue.";
  }
  return "A API recusou a operação.";
}

export async function api(path, options = {}) {
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
