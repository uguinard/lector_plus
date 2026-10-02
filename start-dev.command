#!/usr/bin/env zsh
# Double-clickable launcher for the Lector dev stack.
# Opens the API and the Next.js UI in separate Terminal windows so both
# processes keep running after this window closes.

set -e

REPO_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$REPO_DIR"

if [ ! -d "$REPO_DIR/node_modules" ]; then
  echo "Installing dependencies (npm install)..."
  npm install
fi

if ! command -v bun >/dev/null 2>&1; then
  osascript -e 'display alert "Bun is not installed" message "Install it from https://bun.sh, then double-click start-dev.command again." as critical'
  exit 1
fi

if [ -f "$REPO_DIR/.env.local" ]; then
  ENV_FLAG=(--env-file=../.env.local)
else
  ENV_FLAG=()
fi

osascript <<EOF
tell application "Terminal"
  activate
  do script "cd '$REPO_DIR/api' && bun run ${ENV_FLAG[*]} --watch src/index.ts"
  delay 0.5
  do script "cd '$REPO_DIR' && npm run dev"
end tell
EOF
