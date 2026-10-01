#!/usr/bin/env bash
# Deploys the merged code (this repo) to the live server folder
# C:\Users\Administrator\Desktop\tempy\TharkaLabContest, then rebuilds the
# admin site and restarts the server service.
#
# Keeps the live copy's own secrets (.env), installed packages (node_modules),
# Windows-service files (daemon) and logs untouched. A full backup of the live
# folder was already taken at Desktop\tempy\backup-full-before-merge-*.
#
# Run from Claude Code with:   ! bash C:/Users/Administrator/Documents/TharkaLabContest/deploy-to-live.sh
set -euo pipefail
SRC=/c/Users/Administrator/Documents/TharkaLabContest
LIVE=/c/Users/Administrator/Desktop/tempy/TharkaLabContest

echo "1/4 copying merged code into the live folder..."
tar -C "$SRC/TharkaContestPlatform" -cf - \
  --exclude=node_modules --exclude=dist --exclude=.env --exclude=daemon \
  --exclude='*.log' --exclude=updates --exclude=Codex.exe --exclude=output.txt --exclude=error.txt . \
  | tar -C "$LIVE/TharkaContestPlatform" -xf -
cp "$SRC/CLAUDE.md" "$LIVE/CLAUDE.md"

echo "2/4 checking the live folder now matches..."
if diff -rq "$SRC/TharkaContestPlatform" "$LIVE/TharkaContestPlatform" \
  -x node_modules -x dist -x .env -x daemon -x '*.log' -x updates -x Codex.exe -x output.txt -x error.txt; then
  echo "   identical"
else
  echo "   (differences listed above)"
fi

echo "3/4 rebuilding the admin site..."
(cd "$LIVE/TharkaContestPlatform/apps/admin-web" && npx vite build >/dev/null && echo "   admin site built")

echo "4/4 restarting the server service..."
powershell -NoProfile -Command "Restart-Service -Name 'tharkacontestserver.exe' -Force; Start-Sleep 6; (Get-Service -Name 'tharkacontestserver.exe').Status"
sleep 3
curl -s -m 8 http://localhost:3001/api/contests >/dev/null && echo "   server is answering on port 3001"
echo "done."
