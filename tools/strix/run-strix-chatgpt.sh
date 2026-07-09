#!/usr/bin/env bash
# Strix Caisson pentest using your ChatGPT subscription via a localhost Codex bridge.
# gpt-5.6 line (Sol/Terra/Luna; default Sol), subscription-metered (not per-token). Read-only, full depth, TUI.
#
# NOTE: using a consumer ChatGPT subscription programmatically is ToS-gray and rate-limited.
#
# Prereqs (one-time):
#   1. `codex login`  → writes ~/.codex/auth.json  (browser OAuth to ChatGPT)
#   2. Start the bridge daemon (reads ~/.codex/auth.json, OpenAI-compat on 127.0.0.1:10531).
#      NOTE: it needs the `serve` subcommand — bare `npx chatgpt-bridge` just prints help:
#        npx -y chatgpt-bridge serve --port 10531 --host 127.0.0.1 &
#   3. ./apply-patches.sh run once (read-only + Exa web_search)
#
# Usage:  ./run-strix-chatgpt.sh                                             # default: gpt-5.6-sol @ high
#         CHATGPT_MODEL=openai/gpt-5.6-terra STRIX_REASONING_EFFORT=medium ./run-strix-chatgpt.sh  # cheaper sweep
#         CHATGPT_BRIDGE_PORT=8080 CHATGPT_MODEL=openai/gpt-5.6-sol ./run-strix-chatgpt.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./_common.sh

BRIDGE_PORT="${CHATGPT_BRIDGE_PORT:-10531}"
export STRIX_LLM="${CHATGPT_MODEL:-openai/gpt-5.6-sol}"
export LLM_API_BASE="http://127.0.0.1:${BRIDGE_PORT}/v1"
export LLM_API_KEY="not-needed"   # auth handled by the bridge via ~/.codex/auth.json

# Preflight: bridge reachable?
curl -sf -m 5 "http://127.0.0.1:${BRIDGE_PORT}/health" >/dev/null 2>&1 || {
  echo "ChatGPT bridge not reachable on 127.0.0.1:${BRIDGE_PORT}." >&2
  echo "Start it first: npx -y chatgpt-bridge serve --port ${BRIDGE_PORT} --host 127.0.0.1 &" >&2
  exit 1
}

run_strix "$@"
