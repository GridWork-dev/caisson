#!/usr/bin/env bash
# Shared setup for the Caisson security-scan layer. Sourced by scan.sh / install.sh / the DAST +
# harness scripts. Secrets come from the environment and are never persisted; all output
# SARIF/JSON lands OUT of the repo tree.
set -euo pipefail
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

# Read a var from the environment by name, without printing it.
env_get() {
  printf '%s' "${!1:-}"
}

REPO="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
# SARIF/JSON scan artifacts stay OUT of the repo tree.
OUT_DIR="${SECURITY_OUT_DIR:-${TMPDIR:-/tmp}/caisson-security-runs}"
mkdir -p "$OUT_DIR"

# Semgrep can hit an io_uring memory crash under parallelism on some hosts; SEMGREP_JOBS=1 dodges
# it (CI sets it).
SEMGREP_JOBS="${SEMGREP_JOBS:-}"

have()   { command -v "$1" >/dev/null 2>&1; }
hr()     { printf '\n\033[1m── %s\033[0m\n' "$*"; }
warn()   { printf '\033[33m! %s\033[0m\n' "$*" >&2; }
skip()   { printf '\033[90m∅ %s (not installed — skipping; run tools/security/install.sh)\033[0m\n' "$*" >&2; }
ok()     { printf '\033[32m✓ %s\033[0m\n' "$*"; }
