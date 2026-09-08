// Registers the contest server as a Windows Service: starts automatically
// on boot (before any user logs in), keeps running as long as the machine
// is on, and restarts itself if it crashes. Run once (as Administrator):
//   node install-service.js
// To remove it: node uninstall-service.js
const path = require("path");
const { execFileSync } = require("child_process");
const { Service } = require("node-windows");

// node-windows derives the service id (and daemon exe name) from `name`.
const SERVICE_EXE = "tharkacontestserver.exe";

const svc = new Service({
  name: "TharkaContestServer",
  description: "Tharka LAN Contest Platform - backend server (contests, sync, judging API). Auto-starts on boot.",
  script: path.join(__dirname, "server.js"),
  workingDirectory: __dirname,
  // Restart on crash, with backoff, but don't loop forever on a
  // persistently broken install (e.g. MongoDB never coming up).
  wait: 2,
  grow: 0.5,
  maxRetries: 60,
});

// Two things node-windows can't express, applied with sc.exe afterwards.
// Both are re-applied on every (re)install so a reinstall can't silently
// drop them.
function harden() {
  // 1. Depend on MongoDB. Both services are AUTO_START, so without this
  //    Windows starts them in parallel on boot and it's a coin flip whether
  //    mongod is accepting connections yet. server.js only *logs* a failed
  //    mongoose.connect() (it doesn't exit), and mongoose does not retry
  //    after the initial connection attempt rejects - so losing that race
  //    leaves a server that answers HTTP but fails every DB query, which
  //    looks "up" to every health check while the whole lab is broken.
  //    node-windows's Service does not forward a `dependencies` option to
  //    winsw (lib/daemon.js's generateXml call omits it), hence sc.exe.
  // 2. Windows-level recovery. node-windows's maxRetries only restarts the
  //    *child* node process from inside the wrapper; if the wrapper exe
  //    itself dies, nothing brings the service back until someone notices.
  const steps = [
    ["config", SERVICE_EXE, "depend=", "MongoDB"],
    ["failure", SERVICE_EXE, "reset=", "86400", "actions=", "restart/60000/restart/60000/restart/60000"],
  ];
  for (const args of steps) {
    try {
      execFileSync("sc.exe", args, { stdio: "inherit" });
    } catch (err) {
      console.error(`WARNING: 'sc.exe ${args.join(" ")}' failed - are you running as Administrator?`, err.message);
    }
  }
}

svc.on("install", () => {
  console.log("Service installed. Applying dependency + recovery settings...");
  harden();
  console.log("Starting it now...");
  svc.start();
});
svc.on("alreadyinstalled", () => {
  console.log("Service is already installed. Re-applying dependency + recovery settings...");
  harden();
});
svc.on("start", () => {
  console.log('Service started. It will now auto-start on every boot - check with: Get-Service TharkaContestServer');
});
svc.on("error", (err) => {
  console.error("Service error:", err);
});

svc.install();
