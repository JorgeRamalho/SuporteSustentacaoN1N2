/**
 * Gera frontend/sentinela-config.js no build da Vercel.
 * Defina SENTINELA_API_ORIGIN = URL do Render (sem barra no final).
 * Para proxy /api no mesmo domínio, edite também vercel.json (ver deploy/vercel.json).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const DEFAULT_RENDER_API = "https://sentinela-api-eavd.onrender.com";
const apiOrigin = String(process.env.SENTINELA_API_ORIGIN || DEFAULT_RENDER_API).replace(/\/$/, "");
const configPath = path.join(root, "frontend", "sentinela-config.js");

if (apiOrigin) {
  fs.writeFileSync(
    configPath,
    `/** Gerado no build (SENTINELA_API_ORIGIN). */\nwindow.SENTINELA_API_ORIGIN = ${JSON.stringify(apiOrigin)};\n`,
    "utf8",
  );
  console.log(`[prepare-vercel] Console apontando para ${apiOrigin}`);
} else {
  console.warn("[prepare-vercel] SENTINELA_API_ORIGIN vazio e sem padrão — modo demonstração.");
}
