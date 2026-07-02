#!/usr/bin/env bash
# Strix Caisson pentest using your ChatGPT subscription via a localhost Codex bridge.
# gpt-5.5-class quality, subscription-metered (not per-token). Read-only, full depth, TUI.
#
# NOTE: using a consumer ChatGPT subscription programmatically is ToS-gray and rate-limited.
#
# Prereqs (one-time):
#   1. `codex login`  → writes ~/.codex/auth.json  (browser OAuth to ChatGPT)
#   2. Start a bridge daemon that reads ~/.codex/auth.json and exposes OpenAI-compat on a port:
#        npx @l0z4n0-a1/chatgpt-bridge          # default 127.0.0.1:10531
#        # or: 0oAstro/codex-openai-proxy (Rust, OAuth PKCE) on your chosen port
#   3. ./apply-patches.sh run once (read-only + Exa web_search)
#
# Usage:  ./run-strix-chatgpt.sh
#         CHATGPT_BRIDGE_PORT=8080 CHATGPT_MODEL=openai/gpt-5.5 ./run-strix-chatgpt.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./_common.sh

BRIDGE_PORT="${CHATGPT_BRIDGE_PORT:-10531}"
export STRIX_LLM="${CHATGPT_MODEL:-openai/gpt-5.5}"
export LLM_API_BASE="http://127.0.0.1:${BRIDGE_PORT}/v1"
export LLM_API_KEY="not-needed"   # auth handled by the bridge via ~/.codex/auth.json

# Preflight: bridge reachable?
curl -sf -m 5 "http://127.0.0.1:${BRIDGE_PORT}/health" >/dev/null 2>&1 || {
  echo "ChatGPT bridge not reachable on 127.0.0.1:${BRIDGE_PORT}." >&2
  echo "Start it first: npx @l0z4n0-a1/chatgpt-bridge  (see the header of this script)." >&2
  exit 1
}

run_strix "$@"
