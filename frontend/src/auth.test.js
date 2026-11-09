import assert from "node:assert/strict";
import test from "node:test";
import { handleDemoAuth, setAuthStorage } from "./auth.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const profile = {
  name: "Operador Teste",
  email: "operador.cross@example.org",
  password: "senhaTeste123",
  role: "N1",
  sector: "Suporte",
};

test("cadastro em um navegador não vale no outro (modo demonstração)", async () => {
  const chrome = memoryStorage();
  setAuthStorage(chrome);
  await handleDemoAuth("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(profile),
  });

  const edge = memoryStorage();
  setAuthStorage(edge);
  let message = "";
  try {
    await handleDemoAuth("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: profile.email, password: profile.password }),
    });
  } catch (error) {
    message = error.message;
  }
  assert.match(message, /não cadastrado/i);
});

test("mesmo navegador reconhece login após cadastro", async () => {
  const storage = memoryStorage();
  setAuthStorage(storage);
  await handleDemoAuth("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...profile, email: "unico@example.org" }),
  });
  const session = await handleDemoAuth("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "unico@example.org", password: profile.password }),
  });
  assert.ok(session.token);
  assert.equal(session.user.email, "unico@example.org");
});
