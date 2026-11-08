import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(frontendDir, "..");

/** O build de produção entra direto em main.jsx; o Live Server usa frontend/live-bootstrap.js na raiz. */
function liveServerHtml() {
  return {
    name: "sentinela-live-server-html",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(
          '<script type="module" src="./frontend/live-bootstrap.js"></script>',
          '<script type="module" src="/frontend/src/main.jsx"></script>',
        );
      },
    },
  };
}

const nodeModules = path.join(frontendDir, "node_modules");

export default defineConfig({
  root: repoRoot,
  envDir: frontendDir,
  cacheDir: path.join(nodeModules, ".vite"),
  publicDir: path.resolve(frontendDir, "public"),
  build: {
    outDir: path.join(frontendDir, "dist"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      react: path.join(nodeModules, "react"),
      "react-dom": path.join(nodeModules, "react-dom"),
      "react/jsx-runtime": path.join(nodeModules, "react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.join(nodeModules, "react/jsx-dev-runtime.js"),
    },
  },
  plugins: [react(), liveServerHtml()],
  server: {
    fs: {
      allow: [repoRoot, frontendDir],
    },
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8010",
      "/docs": "http://127.0.0.1:8010",
      "/redoc": "http://127.0.0.1:8010",
      "/openapi.json": "http://127.0.0.1:8010",
    },
  },
});
