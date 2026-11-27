#!/usr/bin/env bash
# Builds the packages and packs them as tarballs you can install in any app:
#   pnpm pack:local                 # → ./.packs/*.tgz
#   pnpm pack:local /some/dir
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/.packs}"
mkdir -p "$out"
out="$(cd "$out" && pwd)"
pnpm -C "$root" build
for p in core server react cli; do
  (cd "$root/packages/$p" && pnpm pack --pack-destination "$out" >/dev/null)
done
echo "Packed into $out:"
ls -1 "$out"/patina-*.tgz
echo
echo "Install in your app with:"
echo "  npm i $out/patina-core-0.0.0.tgz $out/patina-server-0.0.0.tgz $out/patina-react-0.0.0.tgz @anthropic-ai/sdk
  npm i -D $out/patina-cli-0.0.0.tgz   # then: npx patina scan"
