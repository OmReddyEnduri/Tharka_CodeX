const { InteractiveSession } = require("judge-cpp/interactive");
const { getJudgeSettings } = require("../lib/judgeSettings");

// Standalone-compiler "Console" tab: a live terminal, not batch judging.
// One InteractiveSession per socket connection - starting a new run kills
// any previous one on that same socket first.
function initCompilerSocket(io) {
  const nsp = io.of("/compiler");

  nsp.on("connection", (socket) => {
    let session = null;

    socket.on("run", async ({ code, defineLocal }) => {
      // `await getJudgeSettings()` touches MongoDB, so it can reject (the
      // service starting before mongod is up is the ordinary case). This is
      // an async socket handler, so an unhandled rejection here is not a
      // failed request that Express contains - it reaches the process-level
      // unhandledRejection handler in server.js, which deliberately exits(1)
      // to let node-windows restart the service. That would drop every
      // in-flight request for the whole lab because one student clicked Run
      // while the database was unreachable, so it is caught and reported to
      // that one socket instead.
      try {
        if (session) session.stop();
        session = new InteractiveSession();
        const judgeSettings = await getJudgeSettings();
        await session.start(
          code,
          {
            onStdout: (chunk) => socket.emit("stdout", chunk),
            onStderr: (chunk) => socket.emit("stderr", chunk),
            onExit: (info) => {
              socket.emit("exit", info);
              session = null;
            },
          },
          {
            maxSessionMs: judgeSettings.interactiveSessionMaxMs,
            maxOutputBytes: judgeSettings.maxOutputBytes,
            blockedKeywords: judgeSettings.blockedKeywords,
            defineLocal,
          }
        );
      } catch (err) {
        console.error("Compiler session failed to start:", err);
        session = null;
        socket.emit("exit", {
          status: "Error",
          message: "Could not start the console (the server could not read its judge settings). Try again in a moment.",
        });
      }
    });

    socket.on("input", (data) => {
      if (session) session.write(data);
    });

    socket.on("stop", () => {
      if (session) {
        session.stop();
        session = null;
      }
    });

    socket.on("disconnect", () => {
      if (session) session.stop();
    });
  });
}

module.exports = { initCompilerSocket };
