/** Sessão do operador e cadastro local (modo demonstração). */

export const AUTH_LOST_EVENT = "sentinela-auth-lost";
const SESSION_KEY = "sentinela.auth.session";
const USERS_KEY = "sentinela.auth.users.v1";
const ROLES = new Set(["N1", "N2", "N3"]);
const SECTORS = new Set(["Suporte", "DEV", "Segurança", "IA"]);

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function authHeaders() {
  const session = readSession();
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}

export function notifyAuthLost() {
  clearSession();
  window.dispatchEvent(new Event(AUTH_LOST_EVENT));
}

function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = new Uint8Array(24);
  if (globalThis.crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytesToHex(bytes);
}

function fnvHex(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function digest(text) {
  if (globalThis.crypto?.subtle) {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return bytesToHex(new Uint8Array(buffer));
  }
  let acc = text;
  for (let i = 0; i < 4000; i += 1) acc = fnvHex(acc + i);
  return acc;
}

async function hashPassword(password, salt) {
  return digest(`${salt}:${password}`);
}

function readUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role || "N1",
    sector: row.sector || "Suporte",
  };
}

function validateProfile(role, sector) {
  const cleanedRole = String(role || "").trim().toUpperCase();
  const cleanedSector = String(sector || "").trim();
  if (!ROLES.has(cleanedRole)) fail("Selecione a função: N1, N2 ou N3.");
  if (!SECTORS.has(cleanedSector)) fail("Selecione o setor: Suporte, DEV, Segurança ou IA.");
  return { role: cleanedRole, sector: cleanedSector };
}

function bearerToken(options) {
  const header = options?.headers?.Authorization || options?.headers?.authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function parseBody(options) {
  if (!options?.body) return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function demoRegister(body) {
  const name = String(body.name || "").replace(/\s+/g, " ").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (name.length < 2 || name.length > 120) fail("Informe o nome.");
  if (!validEmail(email)) fail("Informe um e-mail válido.");
  if (password.length < 8) fail("A senha deve ter pelo menos 8 caracteres.");
  const profile = validateProfile(body.role, body.sector);
  const users = readUsers();
  if (users.some((row) => row.email === email)) {
    fail("Este e-mail já está cadastrado. Entre com login e senha.");
  }
  const salt = randomToken();
  const row = {
    id: users.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    name,
    email,
    role: profile.role,
    sector: profile.sector,
    salt,
    hash: await hashPassword(password, salt),
    token: randomToken(),
  };
  writeUsers([...users, row]);
  return { token: row.token, user: publicUser(row) };
}

async function demoLogin(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const users = readUsers();
  const row = users.find((item) => item.email === email);
  if (!row) {
    fail("Usuário não cadastrado. Verifique o e-mail ou crie um cadastro.");
  }
  if ((await hashPassword(password, row.salt)) !== row.hash) {
    fail("Senha incorreta.");
  }
  row.token = randomToken();
  writeUsers(users);
  return { token: row.token, user: publicUser(row) };
}

async function demoRecover(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!validEmail(email)) fail("Informe um e-mail válido.");
  if (password.length < 8) fail("A senha deve ter pelo menos 8 caracteres.");
  const users = readUsers();
  const row = users.find((item) => item.email === email);
  if (!row) fail("Usuário não cadastrado. Verifique o e-mail ou crie um cadastro.");
  row.salt = randomToken();
  row.hash = await hashPassword(password, row.salt);
  row.token = randomToken();
  writeUsers(users);
  return { token: row.token, user: publicUser(row) };
}

function demoMe(token) {
  const row = readUsers().find((item) => item.token === token);
  if (!row) fail("Entre com login e senha para acessar o Sentinela.", 401);
  return publicUser(row);
}

async function demoChangePassword(token, body) {
  const users = readUsers();
  const row = users.find((item) => item.token === token);
  if (!row) fail("Entre com login e senha para acessar o Sentinela.", 401);
  const current = String(body.current_password || "");
  const next = String(body.new_password || "");
  if (next.length < 8) fail("A senha deve ter pelo menos 8 caracteres.");
  if ((await hashPassword(current, row.salt)) !== row.hash) fail("Senha atual incorreta.");
  row.salt = randomToken();
  row.hash = await hashPassword(next, row.salt);
  writeUsers(users);
  return { ok: true };
}

function demoLogout(token) {
  const users = readUsers();
  const row = users.find((item) => item.token === token);
  if (row) {
    row.token = "";
    writeUsers(users);
  }
  return { ok: true };
}

export async function handleDemoAuth(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const bare = path.split("?")[0];
  const body = parseBody(options);
  const token = bearerToken(options);
  if (bare === "/api/auth/register" && method === "POST") return demoRegister(body);
  if (bare === "/api/auth/login" && method === "POST") return demoLogin(body);
  if (bare === "/api/auth/recover" && method === "POST") return demoRecover(body);
  if (bare === "/api/auth/logout" && method === "POST") return demoLogout(token);
  if (bare === "/api/auth/me" && method === "GET") return demoMe(token);
  if (bare === "/api/auth/me/password" && method === "PATCH") return demoChangePassword(token, body);
  fail(`Rota de acesso sem suporte no modo demonstração: ${path}`);
}
