#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cp "$ROOT_DIR/manifest.json" "$DIST_DIR/manifest.json"
cp -R "$ROOT_DIR/src" "$DIST_DIR/src"
cp -R "$ROOT_DIR/icons" "$DIST_DIR/icons"

echo "Prepared unpacked extension in: $DIST_DIR"
echo "Load this folder in Brave/Chrome for faster reloads."
