#!/usr/bin/env bash
set -uo pipefail

report_path="${1:?usage: run-regulatory-claim-watch.sh REPORT_PATH COMMAND [ARG...]}"
shift

if ! "$@" >"$report_path" 2>&1; then
  printf '%s\n' \
    '## Regulatory claim watch — report-only' \
    '' \
    'Watch failed before producing a report. No PASS is implied.' \
    >"$report_path"
fi

if [[ ! -s "$report_path" ]]; then
  printf '%s\n' \
    '## Regulatory claim watch — report-only' \
    '' \
    'Watch produced no report. No PASS is implied.' \
    >"$report_path"
fi

sed -n '1,200p' "$report_path"
exit 0
