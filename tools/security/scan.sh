#!/usr/bin/env bash
# Caisson security-scan driver.
#
#   tools/security/scan.sh [--layer ci|deep|all] [--target URL] [--strict-digests]
#
# ci   (default) — deterministic, runs against the repo: semgrep (custom floor rules +
#                  p/security-audit), trivy, osv-scanner, trufflehog (verified-only),
#                  Dockerfile digest gate.
# deep           — DAST against a live/local --target: nuclei + ZAP (+ schemathesis note).
# all            — both.
#
# The AI-pentest layer (ptai / HexStrike) is Claude-Code-driven, NOT run here — see
# docs/security/tooling-playbook.md. Each tool self-skips if not installed (run install.sh).
# Env: SEMGREP_PACKS (default "p/security-audit"; set "" for offline), SEMGREP_JOBS,
# SECURITY_OUT_DIR (SARIF dir, default out-of-tree).
#
# semgrep-core opens an io_uring queue at startup, which needs locked memory. Where RLIMIT_MEMLOCK
# is small (8 MB on <host>) it dies with "Cannot allocate memory io_uring_queue_init" and scans
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
  # stderr is KEPT, not sent to /dev/null. A clean verified-only run writes ZERO bytes of JSON, so
  # the success artifact and the artifact of a scanner that died on startup are the same empty file
  # — and with stderr discarded there was no other signal either. Same class as the semgrep
  # io_uring death documented at the top of this file: absence of findings and absence of a scan
  # are indistinguishable unless something counts what was actually examined.
  local err="$OUT_DIR/trufflehog.stderr"
  trufflehog git "file://$REPO" --results=verified --fail --no-update \
    --exclude-detectors=lob \
    --json > "$OUT_DIR/trufflehog.json" 2>"$err"
  local rc=$?
  # trufflehog's own completion record, on stderr as structured JSON. Its `chunks` count is the
  # proof the scan had a subject: a repo that scanned nothing reports zero, which is a dead run
  # wearing a clean run's exit code.
  # `|| chunks=""` is load-bearing, not defensive noise: _common.sh sets `-e` and `pipefail`, so on
  # the no-match case this pipeline's exit 1 would abort the whole driver — killing the scan on
  # precisely the input this guard exists to report. Measured: without it, the empty-stderr arm
  # terminated the run silently, right after the assignment.
  local chunks
  chunks=$(grep -o '"chunks":[0-9]*' "$err" | tail -1 | cut -d: -f2) || chunks=""
  if [ $rc -ne 0 ]; then
    RC=1; warn "trufflehog verified secret(s) → $OUT_DIR/trufflehog.json"
  elif [ -z "$chunks" ]; then
    RC=1; warn "trufflehog exited 0 but never reported completion — treat as NOT scanned → $err"
  elif [ "$chunks" -eq 0 ]; then
    RC=1; warn "trufflehog scanned 0 chunks — a clean result over nothing → $err"
  else
    ok "trufflehog: no verified secrets ($chunks chunks scanned)"
  fi
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
  ci)   sast_semgrep; sca_trivy; sca_osv; secrets_trufflehog; supply_digests;;
  deep) dast_layer;;
  all)  sast_semgrep; sca_trivy; sca_osv; secrets_trufflehog; supply_digests; dast_layer;;
  *) warn "unknown --layer: $LAYER (want ci|deep|all)"; exit 2;;
esac

hr "scan done — layer=$LAYER rc=$RC · SARIF/JSON in $OUT_DIR"
exit $RC
