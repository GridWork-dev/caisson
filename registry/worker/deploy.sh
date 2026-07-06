#!/usr/bin/env bash
# Deploy the Caisson registry-read Worker to Cloudflare (ADR-0047 seam → live).
#
# DEPLOY is operator-gated + separate from SHIP. This deploys a Worker (NOT a Pages project — the
# marketing site is the Pages one, deployed by .github/workflows/deploy-site.yml). esbuild (via
# wrangler) bundles deploy-entry.ts + ../schema/registry-index.ts and inlines ../index.json, so
# nothing is read from env at runtime and there is no live 503 seam path.
#
# Requires in the environment:
#   CLOUDFLARE_API_TOKEN   — Account → Workers Scripts → Edit on the caisson account
#   CLOUDFLARE_ACCOUNT_ID  — the caisson account id (see ~/.gridwork/caisson.env)
set -euo pipefail

# Run from this script's dir so wrangler resolves ./wrangler.toml + the ../index.json + ../schema
# import paths from deploy-entry.ts.
cd "$(dirname "$0")"

# deploy-entry.ts imports ../schema/registry-index, which (ADR-0097) is a thin shim re-exporting
# @caisson/registry-schema. esbuild/wrangler does NOT honor the package's `bun` export condition and
# resolves the bare specifier via `default` → ./dist/index.js, so the open contract MUST be built
# before bundling (pre-split it was in-tree source that needed no build). Build it from the repo root.
( cd ../.. && bunx turbo run build --filter @caisson/registry-schema --no-daemon )

deploy_out="$(bunx wrangler deploy 2>&1)"
printf '%s\n' "$deploy_out"

url="$(printf '%s\n' "$deploy_out" | grep -oiE 'https://[a-z0-9.-]+\.workers\.dev' | head -n1 || true)"
echo
if [[ -n "${url}" ]]; then
  echo "Registry Worker live at: ${url}"
  echo "  index : ${url}/index.json"
  echo "  module: ${url}/modules/@caisson/field-crypto"
else
  echo "Deployed — could not parse the workers.dev URL from the wrangler output above."
fi
