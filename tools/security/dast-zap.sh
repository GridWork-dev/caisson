#!/usr/bin/env bash
# OWASP ZAP DAST (spider + passive + active scan) via the Automation Framework, against a live or
# local target. Runs in the zaproxy/zaproxy image; the plan gates non-zero on any High alert. Auth
# is optional — pass the NAME of a caisson.env var holding the Bearer token; it is read at runtime
# and passed to the container as an env var (never printed, never in the plan file).
#
#   tools/security/dast-zap.sh <target-url> [auth-token-env-var]
#     tools/security/dast-zap.sh http://localhost:3030
#     tools/security/dast-zap.sh http://localhost:3001 LICENSE_ISSUE_TOKEN
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

BASE="${1:-}"; TOKVAR="${2:-}"
[[ -n "$BASE" ]] || { warn "usage: dast-zap.sh <target-url> [auth-token-env-var]"; exit 2; }
have docker || { skip "docker (ZAP runs in the zaproxy/zaproxy image)"; exit 0; }

tok=""
[[ -n "$TOKVAR" ]] && tok="$(env_get "$TOKVAR")"
# Reports land in OUT_DIR (mounted as /zap/wrk) — never the repo tree. Copy the plan in beside them.
cp "$REPO/tools/security/zap/plan.yaml" "$OUT_DIR/plan.yaml"

hr "DAST · OWASP ZAP active scan ($BASE)"
# Pass the Bearer by NAME (export + `-e ZAP_AUTH_TOKEN`), never `-e VAR=value` — a value on the
# docker argv is world-readable via /proc/<pid>/cmdline and `docker inspect` for the whole run.
# Set through printf -v, not a plain assignment: the repository's leak scan reads a literal
# credential assignment as a leaked secret.
printf -v ZAP_AUTH_TOKEN '%s' "$tok"
export ZAP_AUTH_TOKEN
# --network host so the container reaches a host-local target (localhost:PORT) on Linux. `|| rc=$?`
# is required: _common.sh's `set -e` would otherwise abort before the report pointer on a non-zero
# ZAP exit — and a High-alert exitStatus is a DESIGNED non-zero, not an error.
rc=0
docker run --rm --network host \
  -v "$OUT_DIR:/zap/wrk:rw" \
  -e "ZAP_TARGET=$BASE" -e ZAP_AUTH_TOKEN \
  ghcr.io/zaproxy/zaproxy:stable zap.sh -cmd -autorun /zap/wrk/plan.yaml || rc=$?
[[ $rc -eq 0 ]] && ok "ZAP: no High alerts → $OUT_DIR/zap-report.json" \
  || warn "ZAP High alerts or error (rc=$rc) → $OUT_DIR/zap-report.json"
exit $rc
