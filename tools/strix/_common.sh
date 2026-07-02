#!/usr/bin/env bash
# Shared setup for Strix Caisson pentest runs. Sourced by run-strix-*.sh.
# Secrets are sourced at runtime from ~/.gridwork/env and never persisted.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

env_get() {
  grep -E "^(export )?$1=" "$HOME/.gridwork/env" | head -1 \
    | sed -E "s/^(export )?$1=//; s/^[\"']//; s/[\"']$//"
}

REPO="${CAISSON_REPO:-$HOME/lab/caisson}"
OUT_DIR="${STRIX_OUT_DIR:-$HOME/lab/caisson-strix-runs}"   # keep strix_runs/ OUT of the repo tree
mkdir -p "$OUT_DIR"

# Read-only pentest: strips the apply_patch write tool (requires the installed-package
# patch — run ./apply-patches.sh once after install / after any `uv tool upgrade`).
export STRIX_READONLY=1
export STRIX_REASONING_EFFORT="${STRIX_REASONING_EFFORT:-high}"
export EXA_API_KEY="$(env_get EXA_API_KEY)"   # backs the patched web_search tool (Exa /answer)

# White-box target: a disposable, tracked-only export (no node_modules/.git).
# The full 2.8G working tree crashes Strix's sandbox copy (LocalDirReadError); the
# `git archive` tree is ~15M and copies clean.
build_clean_tree() {
  local tree="$OUT_DIR/_code_tree"
  rm -rf "$tree"; mkdir -p "$tree"
  git -C "$REPO" archive HEAD | tar -x -C "$tree"
  printf '%s' "$tree"
}

# Live black-box targets. The site is reached via its Railway origin, which bypasses
# Cloudflare Access + WAF (cleaner app-vuln signal). admin.caisson.sh is intentionally
# EXCLUDED until its origin 502 / cert-issue is fixed (see docs/security/strix-pentest.md).
SITE_ORIGIN="https://caisson-site-production.up.railway.app"
LICENSE_URL="https://license.caisson.sh"
DOCS_URL="https://docs-api.caisson.sh"

INSTRUCTION="Authorized READ-ONLY white-box + black-box security assessment of Caisson (operator-owned).
White-box: the local source tree; correlate it to the live endpoints. Live: site (better-auth buyer
dashboard, checkout/billing flows), license issuer (Ed25519 verify + Paddle webhook signatures), docs
retrieval API. Focus on auth bypass, IDOR, injection, SSRF, business-logic, and webhook/signature
flaws. Do NOT attempt to fix or patch code — validate and report only."

# Build the clean tree, run Strix across all targets, clean the tree on exit.
# Caller passes any extra strix flags through ("$@"). Default scan-mode is deep.
run_strix() {
  local tree; tree="$(build_clean_tree)"
  trap 'rm -rf "${tree:-}"' EXIT
  cd "$OUT_DIR"
  strix \
    -t "$tree" \
    -t "$SITE_ORIGIN" \
    -t "$LICENSE_URL" \
    -t "$DOCS_URL" \
    --instruction "$INSTRUCTION" \
    "$@"
}
