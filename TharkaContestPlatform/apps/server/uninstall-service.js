// Removes the Windows Service installed by install-service.js.
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "TharkaContestServer",
  script: path.join(__dirname, "server.js"),
});

svc.on("uninstall", () => console.log("Service uninstalled."));
svc.on("error", (err) => console.error("Service error:", err));

svc.uninstall();
