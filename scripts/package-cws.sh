#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREPARE_SCRIPT="$ROOT_DIR/scripts/prepare-unpacked.sh"
OUT_DIR="$ROOT_DIR/build"
TMP_DIR="$OUT_DIR/cws-package"

if [[ ! -x "$PREPARE_SCRIPT" ]]; then
  chmod +x "$PREPARE_SCRIPT"
fi

"$PREPARE_SCRIPT"

VERSION="$(sed -n 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT_DIR/manifest.json" | head -n1)"
if [[ -z "$VERSION" ]]; then
  echo "Could not determine extension version from manifest.json" >&2
  exit 1
fi

mkdir -p "$TMP_DIR" "$OUT_DIR"
rm -rf "$TMP_DIR"/*
cp -R "$ROOT_DIR/dist/." "$TMP_DIR/"

ZIP_PATH="$OUT_DIR/manage-tabs-auto-group-v${VERSION}.zip"
rm -f "$ZIP_PATH"

if command -v zip >/dev/null 2>&1; then
  (
    cd "$TMP_DIR"
    zip -qr "$ZIP_PATH" .
  )
else
  python3 - "$TMP_DIR" "$ZIP_PATH" <<'PY'
import pathlib
import sys
import zipfile

src_dir = pathlib.Path(sys.argv[1])
zip_path = pathlib.Path(sys.argv[2])

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(src_dir.rglob("*")):
        if path.is_file():
            zf.write(path, path.relative_to(src_dir))
PY
fi

rm -rf "$TMP_DIR"

echo "Created CWS upload package: $ZIP_PATH"
