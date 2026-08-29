#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"

mkdir -p "$DIST_DIR"

# Extract version from manifest.json.
# NOTE: -E (not BRE + \s/\+) so this works on both BSD sed (macOS) and GNU sed (Linux CI) —
# BSD sed has no \s shorthand and no \+ in basic mode, so it used to silently match nothing here.
VERSION=$(grep -m1 '"version"' "$EXT_DIR/manifest.json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
if [[ -z "${VERSION:-}" ]]; then
  VERSION="$(date +%Y%m%d%H%M%S)"
fi

OUT_ZIP="$DIST_DIR/folio-v$VERSION.zip"

echo "Packing extension/ -> $OUT_ZIP"

cd "$EXT_DIR"
zip -r "$OUT_ZIP" . \
  -x "*.DS_Store" \
     "*.crx" \
     "*.pem" \
     "*.zip" \
     "assets/export-icons.html" \
     "oauth guide/*"

echo "Done: $OUT_ZIP"

