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

function getConnectedCount() {
  return connectedCount;
}

module.exports = { initSyncSocket, broadcastSync, getConnectedCount };
