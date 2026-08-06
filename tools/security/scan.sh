#!/usr/bin/env bash
# Caisson security-scan driver.
#
#   tools/security/scan.sh [--layer ci|deep|all] [--target URL] [--strict-digests]
#
# ci   (default) — deterministic, runs against the repo: semgrep (custom floor rules +
#                  p/security-audit), ruff flake8-bandit (support-bot), trivy, osv-scanner,
#                  trufflehog (verified-only), Dockerfile digest gate.
# deep           — DAST against a live/local --target: nuclei + ZAP (+ schemathesis note).
# all            — both.
#
# The AI-pentest layer (ptai / HexStrike) is Claude-Code-driven, NOT run here — see
# docs/security/tooling-playbook.md. Each tool self-skips if not installed (run install.sh).
# Env: SEMGREP_PACKS (default "p/security-audit"; set "" for offline), SEMGREP_JOBS,
# SECURITY_OUT_DIR (SARIF dir, default out-of-tree).
#
# semgrep-core opens an io_uring queue at startup, which needs locked memory. Where RLIMIT_MEMLOCK
# is small (8 MB on gw-ms-a2) it dies with "Cannot allocate memory io_uring_queue_init" and scans
# ZERO files. SEMGREP_JOBS=1 does NOT help — the allocation happens before any parallelism. So the
# driver pins EIO_BACKEND=posix unless the caller overrides it; results are identical, only the IO
# strategy differs. Without it a local run is not "clean", it is dead, and anything that reads the
# JSON without checking the exit code reads a false green.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

LAYER=ci; TARGET=""; STRICT_DIGESTS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --layer) LAYER="$2"; shift 2;;
    --target) TARGET="$2"; shift 2;;
    --strict-digests) STRICT_DIGESTS=1; shift;;
    -h|--help) grep -E '^#( |$)' "$0" | sed 's/^# \?//'; exit 0;;
    *) warn "unknown arg: $1"; shift;;
  esac
done

RC=0
cd "$REPO"

sast_semgrep() {
  have semgrep || { skip "semgrep"; return; }
  hr "SAST · semgrep (custom floor rules${SEMGREP_PACKS:+ + }${SEMGREP_PACKS-p/security-audit})"
  local cfg=(--config tools/security/semgrep-rules/) pack
  for pack in ${SEMGREP_PACKS-p/security-audit}; do cfg+=(--config "$pack"); done
  SEMGREP_SEND_METRICS=off EIO_BACKEND="${EIO_BACKEND:-posix}" \
    semgrep scan "${cfg[@]}" --metrics=off --error \
    ${SEMGREP_JOBS:+-j "$SEMGREP_JOBS"} \
    --sarif --output "$OUT_DIR/semgrep.sarif" . && ok "semgrep clean" || { RC=1; warn "semgrep findings → $OUT_DIR/semgrep.sarif"; }
}

sast_python() {
  have ruff || { skip "ruff (support-bot python SAST)"; return; }
  hr "SAST · ruff flake8-bandit (services/support-bot)"
  ( cd services/support-bot && ruff check --select S src ) && ok "ruff-S clean" || RC=1
}

sca_trivy() {
  have trivy || { skip "trivy"; return; }
  hr "SCA · trivy fs (vuln + secret + misconfig)"
  # A tracked env file is the outcome that actually matters, and it is a git question, not a
  # filesystem one. Checked here in its own right so the skip-globs below can never mute it.
  local tracked_env
  tracked_env="$(git -C "$REPO" ls-files -- '.env' '*/.env' '.env.local' '*/.env.local')"
  if [[ -n "$tracked_env" ]]; then
    RC=1
    warn "env files are TRACKED in git — secrets must never be committed:"$'\n'"$tracked_env"
  fi
  # ponytail: scan what CI scans. dist/ and .next/ are build output and .env is gitignored, so a
  # clean checkout has none of them. Scanning them locally reds the driver permanently on an
  # operator box, which teaches everyone to ignore rc — the same false-signal failure as a scan
  # that crashes and reports zero findings, just inverted.
  trivy fs --scanners vuln,secret,misconfig --severity CRITICAL,HIGH \
    --skip-dirs '**/dist' --skip-dirs '**/.next' \
    --skip-files '**/.env' --skip-files '**/.env.local' \
    --exit-code 1 --format sarif --output "$OUT_DIR/trivy.sarif" . \
    && ok "trivy clean" || { RC=1; warn "trivy findings → $OUT_DIR/trivy.sarif"; }
}

sca_osv() {
  have osv-scanner || { skip "osv-scanner"; return; }
  hr "SCA · osv-scanner (lockfiles incl. bun.lock)"
  osv-scanner scan source -r --format sarif --output "$OUT_DIR/osv.sarif" . \
    && ok "osv-scanner clean" || {
      local c=$?
      [[ $c -eq 127 ]] && warn "osv-scanner matched NO packages (exit 127) — config bug, not clean"
      RC=1; warn "osv-scanner findings → $OUT_DIR/osv.sarif"
    }
}

secrets_trufflehog() {
  have trufflehog || { skip "trufflehog"; return; }
  hr "Secrets · trufflehog (verified-only — live-confirmed creds)"
  # --fail is mandatory: without it trufflehog exits 0 even WITH verified secrets found.
  # --exclude-detectors=lob: the Lob detector "verifies" arbitrary test_-prefixed identifiers
  # (Python test function names like test_welcome_... in services/support-bot/tests match Lob's
  # key format and Lob's verification endpoint accepts them — observed 2026-08-06). This repo has
  # no Lob account or integration, so a real Lob credential cannot be ours; excluding the detector
  # is the root-cause fix rather than path-excluding every test directory.
  trufflehog git "file://$REPO" --results=verified --fail --no-update \
    --exclude-detectors=lob \
    --json > "$OUT_DIR/trufflehog.json" 2>/dev/null \
    && ok "trufflehog: no verified secrets" || { RC=1; warn "trufflehog verified secret(s) → $OUT_DIR/trufflehog.json"; }
}

supply_digests() {
  hr "Supply-chain · Dockerfile digest pinning (K-03)"
  if bash tools/security/check-docker-digests.sh; then
    :
  elif [[ $STRICT_DIGESTS -eq 1 ]]; then
    RC=1
  else
    warn "digest pins not yet landed — ADVISORY (pass --strict-digests once Renovate pins merge)"
  fi
}

dast_layer() {
  if [[ -z "$TARGET" ]]; then warn "--layer $LAYER needs --target <url> for DAST — skipping"; return; fi
  [[ -x tools/security/dast-nuclei.sh ]] && { bash tools/security/dast-nuclei.sh "$TARGET" || RC=1; }
  [[ -x tools/security/dast-zap.sh ]] && { bash tools/security/dast-zap.sh "$TARGET" || RC=1; }
  warn "schemathesis: tools/security/dast-schemathesis.sh <openapi-url|file> (emit spec first)"
}

case "$LAYER" in
  ci)   sast_semgrep; sast_python; sca_trivy; sca_osv; secrets_trufflehog; supply_digests;;
  deep) dast_layer;;
  all)  sast_semgrep; sast_python; sca_trivy; sca_osv; secrets_trufflehog; supply_digests; dast_layer;;
  *) warn "unknown --layer: $LAYER (want ci|deep|all)"; exit 2;;
esac

hr "scan done — layer=$LAYER rc=$RC · SARIF/JSON in $OUT_DIR"
exit $RC
