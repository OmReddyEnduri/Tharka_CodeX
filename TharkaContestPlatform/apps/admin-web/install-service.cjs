// Registers admin-web as a Windows Service: starts automatically on boot,
// keeps running, and restarts itself if it crashes. Run once (as
// Administrator), AFTER building admin-web first:
//   npm run build --workspace=admin-web
//   node install-service.cjs
// To remove it: node uninstall-service.cjs
//
// .cjs extension is required because apps/admin-web/package.json sets
// "type": "module", which would otherwise make `require` unavailable.
//
// Runs `vite preview` (serving the built dist/, minified) via scriptOptions,
// not the dev server directly - this sits always-on for a whole semester,
// reachable by the entire LAN by design, so it should serve the same kind
// of production build any other app would ship, not an unminified dev
// server with source maps and hot-reload machinery running indefinitely.
// See vite.config.ts's `preview` block for the port/host this binds to.
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "TharkaAdminWeb",
  description: "Tharka LAN Contest Platform - admin dashboard (production build via `vite preview`, port 5174). Auto-starts on boot.",
  script: path.join(__dirname, "..", "..", "node_modules", "vite", "bin", "vite.js"),
  scriptOptions: "preview",
  workingDirectory: __dirname,
  wait: 2,
  grow: 0.5,
  maxRetries: 60,
});

svc.on("install", () => {
  console.log("Service installed. Starting it now...");
  svc.start();
});
svc.on("alreadyinstalled", () => {
  console.log("Service is already installed.");
});
svc.on("start", () => {
  console.log('Service started. It will now auto-start on every boot - check with: Get-Service TharkaAdminWeb');
});
svc.on("error", (err) => {
  console.error("Service error:", err);
});

svc.install();
