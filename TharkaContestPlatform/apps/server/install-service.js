// Registers the contest server as a Windows Service: starts automatically
// on boot (before any user logs in), keeps running as long as the machine
// is on, and restarts itself if it crashes. Run once (as Administrator):
//   node install-service.js
// To remove it: node uninstall-service.js
const path = require("path");
const { Service } = require("node-windows");

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

svc.on("install", () => {
  console.log("Service installed. Starting it now...");
  svc.start();
});
svc.on("alreadyinstalled", () => {
  console.log("Service is already installed.");
});
svc.on("start", () => {
  console.log('Service started. It will now auto-start on every boot - check with: Get-Service TharkaContestServer');
});
svc.on("error", (err) => {
  console.error("Service error:", err);
});

svc.install();
