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
const { initSyncSocket } = require("./sockets/syncSocket");
const { initCompilerSocket } = require("./sockets/compilerSocket");

const app = express();
app.use(express.json());
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
