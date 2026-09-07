// Registers the admin-web Vite dev server as a Windows Service: starts
// automatically on boot, keeps running, and restarts itself if it crashes.
// Run once (as Administrator):
//   node install-service.cjs
// To remove it: node uninstall-service.cjs
//
// .cjs extension is required because apps/admin-web/package.json sets
// "type": "module", which would otherwise make `require` unavailable.
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "TharkaAdminWeb",
  description: "Tharka LAN Contest Platform - admin dashboard (Vite dev server, port 5174). Auto-starts on boot.",
  script: path.join(__dirname, "..", "..", "node_modules", "vite", "bin", "vite.js"),
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
