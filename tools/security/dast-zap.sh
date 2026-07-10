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
# --network host so the container reaches a host-local target (localhost:PORT) on Linux.
docker run --rm --network host \
  -v "$OUT_DIR:/zap/wrk:rw" \
  -e "ZAP_TARGET=$BASE" -e "ZAP_AUTH_TOKEN=$tok" \
  ghcr.io/zaproxy/zaproxy:stable zap.sh -cmd -autorun /zap/wrk/plan.yaml
rc=$?
[[ $rc -eq 0 ]] && ok "ZAP: no High alerts → $OUT_DIR/zap-report.json" \
  || warn "ZAP High alerts or error (rc=$rc) → $OUT_DIR/zap-report.json"
exit $rc
