const { contextBridge, ipcRenderer } = require("electron");

// Narrow bridge - the renderer (client-web, unmodified) never gets Node/fs
// access, only these specific calls. See apps/client-web/src/lib/apiClient.ts
// for how each one is used (feature-detected via `window.contestAPI`).
contextBridge.exposeInMainWorld("contestAPI", {
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),
  setServerUrl: (url) => ipcRenderer.invoke("set-server-url", url),

  getContests: () => ipcRenderer.invoke("get-contests"),
  getContest: (contestId) => ipcRenderer.invoke("get-contest", contestId),
  getContestProblem: (contestId, problemId) => ipcRenderer.invoke("get-contest-problem", contestId, problemId),
  getResults: (contestId) => ipcRenderer.invoke("get-results", contestId),

  runCode: (args) => ipcRenderer.invoke("run-code", args),
  submitCode: (args) => ipcRenderer.invoke("submit-code", args),
  runStandalone: (args) => ipcRenderer.invoke("run-standalone", args),

  startInteractive: (code) => ipcRenderer.invoke("interactive-start", code),
  sendInteractiveInput: (data) => ipcRenderer.invoke("interactive-input", data),
  stopInteractive: () => ipcRenderer.invoke("interactive-stop"),
  onInteractiveStdout: (callback) => {
    const handler = (event, chunk) => callback(chunk);
    ipcRenderer.on("interactive-stdout", handler);
    return () => ipcRenderer.removeListener("interactive-stdout", handler);
  },
  onInteractiveStderr: (callback) => {
    const handler = (event, chunk) => callback(chunk);
    ipcRenderer.on("interactive-stderr", handler);
    return () => ipcRenderer.removeListener("interactive-stderr", handler);
  },
  onInteractiveExit: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on("interactive-exit", handler);
    return () => ipcRenderer.removeListener("interactive-exit", handler);
  },

  syncNow: () => ipcRenderer.invoke("sync-now"),
  getPendingSubmissionsCount: () => ipcRenderer.invoke("get-pending-submissions-count"),
  getSyncState: () => ipcRenderer.invoke("get-sync-state"),
  onSyncPush: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("sync-push", handler);
    return () => ipcRenderer.removeListener("sync-push", handler);
  },
  onSyncStatus: (callback) => {
    const handler = (event, state) => callback(state);
    ipcRenderer.on("sync-status", handler);
    return () => ipcRenderer.removeListener("sync-status", handler);
  },
});
