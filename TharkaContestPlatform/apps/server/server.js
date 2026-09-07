const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const { exec } = require("child_process");

const contestRoutes = require("./routes/contestRoutes");
const syncRoutes = require("./routes/syncRoutes");
const compileRoutes = require("./routes/compileRoutes");
const judgeSettingsRoutes = require("./routes/judgeSettingsRoutes");
const { initSyncSocket } = require("./sockets/syncSocket");
const { initCompilerSocket } = require("./sockets/compilerSocket");

// A crash here takes down judging for the entire lab at once (one server,
// dozens of laptops), and node-windows only restarts the *process* - every
// in-flight request still gets dropped first. Node's default behavior for
// an unhandled rejection is to crash exactly like an uncaught exception
// (`--unhandled-rejections=throw`), so both need the same safety net: log
// loudly and exit so node-windows's configured restart-with-backoff (see
// install-service.js) brings it back, instead of limping along in a
// possibly-corrupted state or (worse) silently swallowing the error.
process.on("uncaughtException", (err) => {
  console.error("FATAL uncaughtException - exiting so the service can restart:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("FATAL unhandledRejection - exiting so the service can restart:", reason);
  process.exit(1);
});

const app = express();
// Default express.json() caps requests at 100kb - too small for a bulk
// contest/testcase import or an Electron client syncing a backlog of queued
// submissions (each carrying full C++ source) after being offline a while.
app.use(express.json({ limit: "10mb" }));
// Trusted LAN environment (lab laptops on one network, no auth) - CORS is
// intentionally wide open rather than locked to one origin, since the admin
// app, client-web, and the Electron client's embedded browser all connect
// from different local origins.
app.use(cors({ origin: "*" }));

mongoose
  .connect(process.env.MONGODB_URI, { family: 4 })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB...", err));

app.get("/api", (req, res) => {
  res.send("Contest server is running");
});

app.use("/api/contests", contestRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/compile", compileRoutes);
app.use("/api/judge-settings", judgeSettingsRoutes);

// Startup check: local judging (and this interim server-side judging path)
// both need g++ on PATH.
exec("g++ --version", (error) => {
  if (error) {
    console.warn("WARNING: g++ is not installed or not in PATH. Code execution will fail.");
  }
});

app.use("/api/*", (req, res) => {
  res.status(404).json({ msg: `API route not found: ${req.originalUrl}` });
});

const port = process.env.PORT || 3001;
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } }); // trusted LAN environment, see CORS note above
initSyncSocket(io);
initCompilerSocket(io);

httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
