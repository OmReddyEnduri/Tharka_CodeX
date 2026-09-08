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
//
// HAZARD: node-windows puts the generated daemon (tharkaadminweb.exe + its
// XML/logs) in a `daemon/` folder NEXT TO `script` - i.e. inside
// node_modules/vite/bin/. A plain `npm install` / `npm ci` wipes
// node_modules and takes the service binary with it, so the service stays
// registered and set to auto-start but can never start again (error 1053/2
// on boot, with no obvious cause). After any dependency reinstall, re-run:
//   node uninstall-service.cjs && node install-service.cjs
const path = require("path");
const { execFileSync } = require("child_process");
const { Service } = require("node-windows");

// node-windows derives the service id (and daemon exe name) from `name`.
const SERVICE_EXE = "tharkaadminweb.exe";

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

// node-windows's maxRetries only restarts the *child* node process from
// inside the wrapper; if the wrapper exe itself dies, nothing brings the
// service back until a human notices the dashboard is down. Ask Windows to
// restart it too. Re-applied on every (re)install so it can't be silently
// dropped. No `depend=` here on purpose: this is a static file server, and
// it should stay reachable even when the backend is down - that's exactly
// when an admin most wants to load the dashboard and see what's wrong.
function harden() {
  const args = ["failure", SERVICE_EXE, "reset=", "86400", "actions=", "restart/60000/restart/60000/restart/60000"];
  try {
    execFileSync("sc.exe", args, { stdio: "inherit" });
  } catch (err) {
    console.error(`WARNING: 'sc.exe ${args.join(" ")}' failed - are you running as Administrator?`, err.message);
  }
}

svc.on("install", () => {
  console.log("Service installed. Applying recovery settings...");
  harden();
  console.log("Starting it now...");
  svc.start();
});
svc.on("alreadyinstalled", () => {
  console.log("Service is already installed. Re-applying recovery settings...");
  harden();
});
svc.on("start", () => {
  console.log('Service started. It will now auto-start on every boot - check with: Get-Service TharkaAdminWeb');
});
svc.on("error", (err) => {
  console.error("Service error:", err);
});

svc.install();
