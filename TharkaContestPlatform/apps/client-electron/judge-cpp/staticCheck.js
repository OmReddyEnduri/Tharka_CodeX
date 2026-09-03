// Basic isolation, not adversarial sandboxing: a trusted student-lab
// environment doesn't need OS-level sandboxing, just a clear guardrail
// against accidental/obvious misuse (matches the check that already
// existed in the old contestRoutes.js submit handler).
const BLOCKED_KEYWORDS = [
  'rm', 'mv', 'chmod', 'chown', 'reboot', 'shutdown', 'halt', 'poweroff',
  'mkfs', 'dd', 'wget', 'curl', 'apt', 'yum', 'pacman', 'systemctl',
  'service', 'system', 'filesystem', 'unistd', 'fork', 'exec',
  'popen', 'remove', 'rmdir', 'unlink',
];
// Distinctive Windows API names, matched as plain substrings (not \b-bounded)
// so *A/*W suffix variants (ShellExecuteA, CreateProcessW, ...) are caught too.
const BLOCKED_SUBSTRINGS = [
  'WinExec', 'ShellExecute', 'CreateProcess', 'DeleteFile', 'RemoveDirectory',
];
const BLOCKED_INCLUDES = [
  '<filesystem>', '<unistd.h>', '<curl/curl.h>', '<sys/socket.h>', '<netdb.h>',
  '<winsock2.h>', '<windows.h>',
];

function staticCheck(code) {
  const foundKeyword = BLOCKED_KEYWORDS.find((kw) => new RegExp(`\\b${kw}\\b`).test(code));
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

module.exports = { staticCheck };
