const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Read the platform server's own .env directly rather than duplicating
// ADMIN_BYPASS_TOKEN into this tool's config - one source of truth, and it
// stays gitignored exactly where it already was.
const PLATFORM_ENV_PATH = path.join(__dirname, "..", "..", "TharkaContestPlatform", "apps", "server", ".env");

function loadAdminToken() {
  if (!fs.existsSync(PLATFORM_ENV_PATH)) return "";
  const parsed = dotenv.parse(fs.readFileSync(PLATFORM_ENV_PATH));
  return parsed.ADMIN_BYPASS_TOKEN || "";
}

function getServerUrl() {
  return process.env.CONTEST_SERVER_URL || "http://localhost:3001";
}

async function apiFetch(pathSuffix, opts = {}) {
  const token = loadAdminToken();
  const res = await fetch(`${getServerUrl()}${pathSuffix}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-contest-admin": token,
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.msg || body.message || `Request failed: ${res.status}`);
  }
  return body;
}

const listContests = () => apiFetch("/api/contests");
const bulkAddProblems = (contestId, problems) =>
  apiFetch(`/api/contests/${contestId}/problems/bulk`, {
    method: "POST",
    body: JSON.stringify({ problems }),
  });

module.exports = { listContests, bulkAddProblems, getServerUrl, loadAdminToken };
