// Removes the Windows Service installed by install-service.cjs.
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "TharkaAdminWeb",
  script: path.join(__dirname, "..", "..", "node_modules", "vite", "bin", "vite.js"),
});

svc.on("uninstall", () => console.log("Service uninstalled."));
svc.on("error", (err) => console.error("Service error:", err));

svc.uninstall();
