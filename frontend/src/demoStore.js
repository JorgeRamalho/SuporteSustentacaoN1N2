/** Gravações do modo demonstração. O snapshot é só leitura; isto guarda o que o operador fez. */

const STORAGE_KEY = "sentinela.demo.incidents.v1";

const MANUAL_SEVERITY = {
  critico: ["P1", "N2"],
  alto: ["P2", "N2"],
  medio: ["P3", "N2"],
  baixo: ["P3", "N1"],
  alta: ["P1", "N2"],
  media: ["P2", "N2"],
  baixa: ["P3", "N1"],
};

const STATUSES = new Set(["aberto", "em_analise", "resolvido"]);

let storageOverride = null;
let memoryState = null;

export function setDemoStorage(storage) {
  storageOverride = storage;
  memoryState = null;
}

function emptyState() {
  return { created: [], updates: {} };
}

function currentStorage() {
  if (storageOverride) return storageOverride;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

function readState() {
  const storage = currentStorage();
  if (!storage) return memoryState || emptyState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      created: Array.isArray(parsed.created) ? parsed.created : [],
      updates: parsed.updates && typeof parsed.updates === "object" ? parsed.updates : {},
    };
  } catch {
    return memoryState || emptyState();
  }
}

function writeState(state) {
  memoryState = state;
  const storage = currentStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* navegador sem espaço ou storage bloqueado: a sessão ainda usa memoryState */
  }
}

function hasMutations(state) {
  return state.created.length > 0 || Object.keys(state.updates).length > 0;
}

function baseItems(snapshot) {
  const block = snapshot?.["/api/incidents"];
  return Array.isArray(block?.items) ? block.items : [];
}

function sortIncidentsNewestFirst(items) {
  return [...items].sort((left, right) =>
    String(right.code || "").localeCompare(String(left.code || ""), undefined, { numeric: true }),
  );
}

function mergeItems(items, state) {
  const updated = items.map((item) => {
    const patch = state.updates[String(item.id)];
    if (!patch) return item;
    return { ...item, status: patch.status, updated_at: patch.updated_at };
  });
  return sortIncidentsNewestFirst([...state.created, ...updated]);
}

function signatureOf(message) {
  const first = String(message).split(/\r?\n/)[0].toLowerCase();
  return first
    .replace(/\d+/g, "#")
    .replace(/[^a-z0-9#áàâãéêíóôõúç]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function nextCode(items) {
  const year = new Date().getUTCFullYear();
  const prefix = `INC-${year}-`;
  let highest = 0;
  for (const item of items) {
    if (typeof item.code !== "string" || !item.code.startsWith(prefix)) continue;
    const number = Number(item.code.slice(prefix.length));
    if (Number.isFinite(number)) highest = Math.max(highest, number);
  }
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

function deriveStatus(name, openIncidents) {
  const related = openIncidents.filter((item) => item.service_name === name);
  if (related.some((item) => item.severity === "P1")) return "indisponivel";
  if (related.some((item) => item.severity === "P2")) return "degradado";
  if (related.length > 0) return "atencao";
  return "operacional";
}

function collapsed(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createIncident(body, snapshot) {
  const title = collapsed(body.title);
  const symptom = collapsed(body.symptom);
  if (!title || !symptom) throw new Error("Preencha título e sintoma.");
  if (title.length > 180) throw new Error("O título aceita até 180 caracteres.");
  const severityLabel = body.severity || "medio";
  const mapped = MANUAL_SEVERITY[severityLabel];
  if (!mapped) {
    throw new Error("Nível inválido para a API em execução. Reinicie o backend (scripts\\subir-api.ps1) e tente de novo.");
  }
  const [severity, level] = mapped;
  const state = readState();
  const items = mergeItems(baseItems(snapshot), state);
  const id = items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
  const now = new Date().toISOString();
  const incident = {
    id,
    code: nextCode(items),
    title: title.slice(0, 180),
    severity,
    status: "aberto",
    level,
    service_name: "registro-n1",
    signature: `registro manual ${signatureOf(symptom)}`.slice(0, 180),
    summary: `${symptom} Registro manual do N1, severidade ${severityLabel}. Fila recomendada: ${level}.`,
    evidence_count: 1,
    opened_at: now,
    updated_at: now,
    article: null,
    vendor: null,
  };
  writeState({ ...state, created: [incident, ...state.created] });
  return incident;
}

function patchIncident(id, body, snapshot) {
  if (!STATUSES.has(body.status)) throw new Error("Situação inválida.");
  const state = readState();
  const now = new Date().toISOString();
  const createdIndex = state.created.findIndex((item) => String(item.id) === String(id));
  if (createdIndex >= 0) {
    const next = { ...state.created[createdIndex], status: body.status, updated_at: now };
    const created = state.created.slice();
    created[createdIndex] = next;
    writeState({ ...state, created });
    return next;
  }
  const base = baseItems(snapshot).find((item) => String(item.id) === String(id));
  if (!base) throw new Error("Incidente não encontrado.");
  writeState({
    ...state,
    updates: { ...state.updates, [String(id)]: { status: body.status, updated_at: now } },
  });
  return { ...base, status: body.status, updated_at: now };
}

export function overlayDemoRead(path, data, snapshot) {
  if (!data || typeof data !== "object") return data;
  const bare = path.split("?")[0];
  const state = readState();
  const base = baseItems(snapshot);
  const items = hasMutations(state) ? mergeItems(base, state) : sortIncidentsNewestFirst(base);

  if (bare === "/api/incidents") {
    return { items: Array.isArray(data.items) ? items : data.items };
  }
  if (bare === "/api/dashboard") {
    const boardIncidents = items.slice(0, 6);
    if (!hasMutations(state)) {
      return { ...data, incidents: boardIncidents };
    }
    const open = items.filter((item) => item.status !== "resolvido");
    return {
      ...data,
      kpis: {
        ...data.kpis,
        open_incidents: open.length,
        p1: open.filter((item) => item.severity === "P1").length,
      },
      services: Array.isArray(data.services)
        ? data.services.map((service) => ({ ...service, status: deriveStatus(service.name, open) }))
        : data.services,
      incidents: boardIncidents,
    };
  }
  if (!hasMutations(state)) return data;
  return data;
}

export function writeDemoIncident(path, body, snapshot) {
  const bare = path.split("?")[0];
  if (bare === "/api/incidents/detect") return { created: 0, items: [] };
  if (bare === "/api/incidents") return createIncident(body || {}, snapshot);
  const match = bare.match(/^\/api\/incidents\/([^/]+)$/);
  if (!match || match[1] === "export") return null;
  return patchIncident(match[1], body || {}, snapshot);
}
