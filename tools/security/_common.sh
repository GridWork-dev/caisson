#!/usr/bin/env bash
# Shared setup for the Caisson security-scan layer. Sourced by scan.sh / install.sh / the DAST +
# harness scripts. Secrets are read from the env files at runtime and never persisted; all output
# SARIF/JSON lands OUT of the repo tree.
set -euo pipefail
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

# Read a var from the operator env files without printing it. caisson.env source-chains from env.
env_get() {
  local key="$1" f
  for f in "$HOME/.gridwork/caisson.env" "$HOME/.gridwork/env"; do
    [[ -r "$f" ]] || continue
    local v
    v=$(grep -E "^(export )?${key}=" "$f" | head -1 | sed -E "s/^(export )?${key}=//; s/^[\"']//; s/[\"']$//") || true
    [[ -n "$v" ]] && { printf '%s' "$v"; return 0; }
  done
  return 0
}

REPO="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
# SARIF/JSON scan artifacts stay OUT of the repo tree.
OUT_DIR="${SECURITY_OUT_DIR:-$HOME/lab/caisson-security-runs}"
mkdir -p "$OUT_DIR"

# Semgrep on this box can hit an io_uring memory crash under parallelism; SEMGREP_JOBS=1 dodges
# it. Harmless in the semgrep/semgrep CI Docker image (leave unset there).
SEMGREP_JOBS="${SEMGREP_JOBS:-}"

have()   { command -v "$1" >/dev/null 2>&1; }
hr()     { printf '\n\033[1m── %s\033[0m\n' "$*"; }
warn()   { printf '\033[33m! %s\033[0m\n' "$*" >&2; }
skip()   { printf '\033[90m∅ %s (not installed — skipping; run tools/security/install.sh)\033[0m\n' "$*" >&2; }
ok()     { printf '\033[32m✓ %s\033[0m\n' "$*"; }
