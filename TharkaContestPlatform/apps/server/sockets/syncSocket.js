let sharedIO = null;
let connectedCount = 0;

// Attaches sync push/version-tracking behavior to the default namespace of a
// shared Socket.IO server (see sockets/io.js - the compiler's interactive
// terminal gets its own namespace on the same server).
function initSyncSocket(io) {
  sharedIO = io;
  io.on("connection", (socket) => {
    connectedCount++;
    socket.on("disconnect", () => {
      connectedCount--;
    });
  });

  return io;
}

function broadcastSync(version) {
  if (!sharedIO) return;
  sharedIO.emit("sync:push", { version });
}

// Deliberately a separate event from sync:push - this only means "a new app
// build is available," not "contest data changed," so a client hearing it
// just calls checkForAppUpdate() instead of re-pulling the full contest
// snapshot (which sync:push triggers and which would be wasted work here).
function broadcastAppUpdate(version) {
  if (!sharedIO) return;
  sharedIO.emit("app-update:push", { version });
}

function getConnectedCount() {
  return connectedCount;
}

module.exports = { initSyncSocket, broadcastSync, broadcastAppUpdate, getConnectedCount };
