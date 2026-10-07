#!/usr/bin/env bash
# Zips extension/ into dist/ for upload to the Chrome Web Store.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/extension"
version="$(node -p "require('$src/manifest.json').version")"
out="$root/dist/local-cookie-sync-$version.zip"

mkdir -p "$root/dist"
rm -f "$out"
(cd "$src" && zip -qr "$out" manifest.json popup.html popup.js icons)

echo "Packaged $out"
