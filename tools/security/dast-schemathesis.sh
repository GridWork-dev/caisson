#!/usr/bin/env bash
# Schema fuzzing (Schemathesis) against a live/local caisson service, driven by an OpenAPI spec
# emitted FRESH from the services' real Zod schemas (tools/security/emit-openapi.ts) — property-
# based fuzzing of the actual request shapes: the handler must never 500 and must always answer a
# malformed body with a structured 4xx.
#
#   tools/security/dast-schemathesis.sh <base-url> [license|docs]
#     license  (default) → POST /issue /eval/apply /eval/issue (Bearer) + GET /health
#     docs               → POST /query + GET /health
#
# The Bearer for the license routes is read from ~/.gridwork/caisson.env (LICENSE_ISSUE_TOKEN) and
# never printed. Without it the authed routes only exercise the 401 path (still a valid smoke: no
# 5xx), so the run degrades gracefully rather than failing.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

BASE="${1:-}"; NAME="${2:-license}"
[[ -n "$BASE" ]] || { warn "usage: dast-schemathesis.sh <base-url> [license|docs]"; exit 2; }
have schemathesis || { skip "schemathesis (uv tool install schemathesis)"; exit 0; }
have bun || { warn "bun required to emit the spec"; exit 1; }

hr "Schema fuzzing · Schemathesis ($NAME @ $BASE)"
bun run "$REPO/tools/security/emit-openapi.ts" --out "$REPO/tools/security/openapi" >&2
SPEC="$REPO/tools/security/openapi/$NAME.json"
[[ -f "$SPEC" ]] || { warn "no emitted spec at $SPEC (want name: license|docs)"; exit 1; }

HEADERS=()
if [[ "$NAME" == "license" ]]; then
  tok="$(env_get LICENSE_ISSUE_TOKEN)"
  # ponytail: the Bearer rides on the schemathesis argv (readable via /proc/<pid>/cmdline for the
  # fuzz run). Accepted LOW on this single-operator loopback box — schemathesis has no header env,
  # and a secret-written-to-a-config-file trades a transient argv for a worse on-disk window.
  if [[ -n "$tok" ]]; then HEADERS=(--header "Authorization: Bearer $tok"); else
    warn "LICENSE_ISSUE_TOKEN not in caisson.env — authed routes fuzz the 401 path only"
  fi
fi

# `-w auto` scales workers to cores; default checks include not_a_server_error +
# {status_code,content_type,response_schema}_conformance. Exit is non-zero on any finding.
log="$OUT_DIR/schemathesis-$NAME.log"
schemathesis run "$SPEC" --url "$BASE" -w auto "${HEADERS[@]}" 2>&1 | tee "$log"
rc="${PIPESTATUS[0]}"
[[ $rc -eq 0 ]] && ok "schemathesis: no findings ($NAME)" || warn "schemathesis findings ($NAME) → $log"
exit "$rc"
