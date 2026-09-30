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
