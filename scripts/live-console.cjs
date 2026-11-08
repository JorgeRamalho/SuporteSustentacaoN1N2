const path = require("node:path");
const { createRequire } = require("node:module");

const repoRoot = path.resolve(__dirname, "..");
const requireFromFrontend = createRequire(path.join(repoRoot, "frontend", "package.json"));
const liveServer = requireFromFrontend("live-server");
const frontendDir = path.join(repoRoot, "frontend");
const bundle = path.join(frontendDir, "live-dist", "live-bundle.js");

if (!require("node:fs").existsSync(bundle)) {
  console.error("Bundle ausente. Rode: npm run live:bundle --prefix frontend");
  process.exit(1);
}

liveServer.start({
  port: 5500,
  host: "127.0.0.1",
  root: repoRoot,
  file: "index.html",
  open: false,
  noBrowser: true,
  logLevel: 0,
  watch: [
    path.join(repoRoot, "index.html"),
    path.join(frontendDir, "live-bootstrap.js"),
    path.join(frontendDir, "live-dist"),
  ],
});

console.log(`Console em http://127.0.0.1:5500/index.html (raiz: ${repoRoot})`);
