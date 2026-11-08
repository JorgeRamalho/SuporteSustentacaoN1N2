import { writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function writeBundleVersion() {
  return {
    name: "sentinela-live-bundle-version",
    closeBundle() {
      writeFileSync("live-dist/build-version.txt", new Date().toISOString(), "utf8");
    },
  };
}

/** Bundle estático para o Live Server (porta 5500). Rode: npm run live:bundle */
export default defineConfig({
  plugins: [react(), writeBundleVersion()],
  publicDir: false,
  build: {
    outDir: "live-dist",
    emptyOutDir: true,
    assetsInlineLimit: 1_000_000,
    rollupOptions: {
      input: "src/main.jsx",
      output: {
        entryFileNames: "live-bundle.js",
        format: "es",
        inlineDynamicImports: true,
        assetFileNames: "live-bundle.[ext]",
      },
    },
    cssCodeSplit: false,
  },
});
