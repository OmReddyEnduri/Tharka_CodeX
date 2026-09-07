// Basic isolation, not adversarial sandboxing: a trusted student-lab
// environment doesn't need OS-level sandboxing, just a clear guardrail
// against accidental/obvious misuse (matches the check that already
// existed in the old contestRoutes.js submit handler).
//
// `blockedKeywords` is admin-editable (see apps/server/models/JudgeSettings.js)
// since whole-word matches like `remove`/`system`/`fork` are also common
// English words and STL-ish identifiers - a student legitimately naming a
// function `int remove(...)` gets hard-rejected with no way for the admin to
// see or adjust the list without editing this file directly. DEFAULT_BLOCKED_KEYWORDS
// is exported so admin-web can show/reset to the shipped defaults.
const DEFAULT_BLOCKED_KEYWORDS = [
  'rm', 'mv', 'chmod', 'chown', 'reboot', 'shutdown', 'halt', 'poweroff',
  'mkfs', 'dd', 'wget', 'curl', 'apt', 'yum', 'pacman', 'systemctl',
  'service', 'system', 'filesystem', 'unistd', 'fork', 'exec',
  'popen', 'remove', 'rmdir', 'unlink',
];
// Distinctive Windows API names, matched as plain substrings (not \b-bounded)
// so *A/*W suffix variants (ShellExecuteA, CreateProcessW, ...) are caught too.
// Not admin-editable - these are unambiguous OS-escape attempts, not
// ordinary words a legitimate submission would ever contain.
const BLOCKED_SUBSTRINGS = [
  'WinExec', 'ShellExecute', 'CreateProcess', 'DeleteFile', 'RemoveDirectory',
];
const BLOCKED_INCLUDES = [
  '<filesystem>', '<unistd.h>', '<curl/curl.h>', '<sys/socket.h>', '<netdb.h>',
  '<winsock2.h>', '<windows.h>',
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function staticCheck(code, blockedKeywords) {
  const keywords = Array.isArray(blockedKeywords) && blockedKeywords.length > 0
    ? blockedKeywords
    : DEFAULT_BLOCKED_KEYWORDS;
  const foundKeyword = keywords.find((kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`).test(code));
  const foundSubstring = BLOCKED_SUBSTRINGS.find((s) => code.includes(s));
  const foundInclude = BLOCKED_INCLUDES.find((inc) => code.includes(inc));

  if (foundKeyword || foundSubstring || foundInclude) {
    return {
      blocked: true,
      reason: 'Your code appears to contain system commands or blocked libraries. Please remove them and submit again.',
    };
  }
  return { blocked: false, reason: null };
}

module.exports = { staticCheck, DEFAULT_BLOCKED_KEYWORDS };
