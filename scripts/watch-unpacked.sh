#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREPARE_SCRIPT="$ROOT_DIR/scripts/prepare-unpacked.sh"

if [[ ! -x "$PREPARE_SCRIPT" ]]; then
  chmod +x "$PREPARE_SCRIPT"
fi

echo "Starting unpacked watcher..."
echo "Press Ctrl+C to stop."

"$PREPARE_SCRIPT"

if command -v inotifywait >/dev/null 2>&1; then
  echo "Using inotifywait for file watching."
  while inotifywait -q -r -e modify,create,delete,move \
    --exclude '(^|/)(\\.git|dist|node_modules)(/|$)' \
    "$ROOT_DIR/src" "$ROOT_DIR/icons" "$ROOT_DIR/manifest.json" >/dev/null 2>&1; do
    "$PREPARE_SCRIPT"
  done
else
  echo "inotifywait not found, using polling every 1s."
  last_snapshot=""
  while true; do
    snapshot="$(
      (
        find "$ROOT_DIR/src" "$ROOT_DIR/icons" -type f -print 2>/dev/null
        printf '%s\n' "$ROOT_DIR/manifest.json"
      ) | sort | xargs -r stat -c '%n:%Y:%s' 2>/dev/null | sha256sum | awk '{print $1}'
    )"
    if [[ "$snapshot" != "$last_snapshot" ]]; then
      "$PREPARE_SCRIPT"
      last_snapshot="$snapshot"
    fi
    sleep 1
  done
fi
