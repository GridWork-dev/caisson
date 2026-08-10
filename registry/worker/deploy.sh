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
# before bundling (pre-split it was in-tree source that needed no build). handler.ts has since
# grown two more workspace imports resolved the same dist-first way (@caisson/license-verify for
# token verification, @caisson/pricebook for the membership timeline) — build all three from the
# repo root or wrangler fails on a missing dist/.
( cd ../.. && bunx turbo run build --filter @caisson/registry-schema --filter @caisson/license-verify --filter @caisson/pricebook )

# Pin the wrangler shim from the registry workspace's devDependency (bun puts it at
# registry/node_modules/.bin, never hoisted to root). bunx resolution is what killed the CI
# dispatches (CAISSON-191): no global wrangler on the runner, bunx died in 35ms, and the
# captured output below was swallowed by set -e aborting the assignment.
wrangler="../node_modules/.bin/wrangler"
if [[ ! -x "$wrangler" ]]; then
  echo "wrangler shim missing at registry/node_modules/.bin/wrangler — run bun install first" >&2
  exit 1
fi
echo "wrangler $("$wrangler" --version)"

# Print-before-exit: under set -euo pipefail a failing capture aborts the script with the
# captured output never shown. Never swallow wrangler's failure output (CAISSON-191).
if ! deploy_out="$("$wrangler" deploy 2>&1)"; then
  printf '%s\n' "$deploy_out" >&2
  echo "wrangler deploy FAILED — full output above" >&2
  exit 1
fi
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
