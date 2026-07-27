#!/usr/bin/env bash
set -uo pipefail

report_path="${1:?usage: run-regulatory-claim-watch.sh REPORT_PATH COMMAND [ARG...]}"
shift

command_output="$(mktemp)"
cleanup() {
  rm -f -- "$command_output"
}
trap cleanup EXIT

if ! "$@" >"$command_output" 2>&1; then
  {
    printf '%s\n' \
      '## Regulatory claim watch — report-only' \
      '' \
      'Watch failed before producing a report. No PASS is implied.' \
      '' \
      '### Bounded command diagnostic' \
      ''
    head -c 8192 "$command_output" | sed 's/^/    /'
    printf '\n'
  } >"$report_path"
else
  cp "$command_output" "$report_path"
fi

if [[ ! -s "$report_path" ]]; then
  printf '%s\n' \
    '## Regulatory claim watch — report-only' \
    '' \
    'Watch produced no report. No PASS is implied.' \
    >"$report_path"
fi

first_line=""
IFS= read -r first_line <"$report_path" || true
if [[ "$first_line" != "## Regulatory claim watch — report-only" ]]; then
  printf '%s\n' \
    '## Regulatory claim watch — report-only' \
    '' \
    'Watch output was not a framed report. No PASS is implied.' \
    >"$report_path"
fi

sed -n '1,200p' "$report_path"
exit 0
