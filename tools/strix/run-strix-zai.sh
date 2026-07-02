#!/usr/bin/env bash
# Strix Caisson pentest on z.ai GLM-5.2 (Coding Plan). Read-only, full depth (deep), TUI.
# Cheapest option — flat Coding-Plan cost vs per-token. Weaker findings than gpt-5.5.
#
# Prereq: ZAI_API_KEY (the GLM Coding Plan key) in ~/.gridwork/env, and ./apply-patches.sh run once.
# Usage:  ./run-strix-zai.sh            # deep TUI run across all targets
#         ./run-strix-zai.sh -m standard -n   # faster, headless
set -euo pipefail
cd "$(dirname "$0")"
source ./_common.sh

export STRIX_LLM="anthropic/glm-5.2"
export LLM_API_BASE="https://api.z.ai/api/anthropic"
export LLM_API_KEY="$(env_get ZAI_API_KEY)"
[ -n "$LLM_API_KEY" ] || { echo "ZAI_API_KEY missing in ~/.gridwork/env (GLM Coding Plan key)." >&2; exit 1; }

run_strix "$@"
