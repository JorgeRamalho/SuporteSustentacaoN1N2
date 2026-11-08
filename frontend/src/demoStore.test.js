import assert from "node:assert/strict";
import test from "node:test";
import { overlayDemoRead, setDemoStorage, writeDemoIncident } from "./demoStore.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function fixture() {
  return {
    "/api/incidents": {
      items: [
        {
          id: 2,
          code: "INC-2026-0002",
          title: "deadlock",
          severity: "P2",
          status: "aberto",
          level: "N2",
          service_name: "api-pedidos",
          opened_at: "2026-11-08T01:00:00+00:00",
          updated_at: "2026-11-08T01:00:00+00:00",
        },
      ],
    },
    "/api/dashboard": {
      kpis: { open_incidents: 1, p1: 0, critical_logs: 3, open_tickets: 1 },
      services: [{ name: "api-pedidos", status: "degradado" }],
      incidents: [],
    },
  };
}

test("registro e situação sobrevivem a uma nova leitura", () => {
  const storage = memoryStorage();
  setDemoStorage(storage);
  const snapshot = fixture();
  const created = writeDemoIncident(
    "/api/incidents",
    { title: "Portal lento", symptom: "login acima de um minuto", severity: "critico" },
    snapshot,
  );
  assert.equal(created.code, "INC-2026-0003");
  assert.equal(created.level, "N2");
  assert.equal(created.severity, "P1");

  writeDemoIncident(`/api/incidents/${created.id}`, { status: "em_analise" }, snapshot);
  writeDemoIncident("/api/incidents/2", { status: "resolvido" }, snapshot);

  setDemoStorage(storage);
  const list = overlayDemoRead("/api/incidents", snapshot["/api/incidents"], snapshot);
  assert.equal(list.items[0].code, "INC-2026-0003");
  assert.equal(list.items[0].status, "em_analise");
  assert.equal(list.items[1].status, "resolvido");

  const board = overlayDemoRead("/api/dashboard", snapshot["/api/dashboard"], snapshot);
  assert.equal(board.kpis.open_incidents, 1);
  assert.equal(board.kpis.p1, 1);
  assert.equal(board.kpis.critical_logs, 3);
  assert.equal(board.services[0].status, "operacional");
  assert.equal(board.incidents[0].code, "INC-2026-0003");
});

test("detecção no snapshot não abre incidente duplicado", () => {
  setDemoStorage(memoryStorage());
  const result = writeDemoIncident("/api/incidents/detect", {}, fixture());
  assert.deepEqual(result, { created: 0, items: [] });
});

test("título vazio e incidente ausente são recusados", () => {
  setDemoStorage(memoryStorage());
  const snapshot = fixture();
  assert.throws(() => writeDemoIncident("/api/incidents", { title: "  ", symptom: "tela", severity: "baixo" }, snapshot), /título e sintoma/);
  assert.throws(() => writeDemoIncident("/api/incidents/99", { status: "resolvido" }, snapshot), /não encontrado/);
});
