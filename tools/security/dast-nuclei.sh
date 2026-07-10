#!/usr/bin/env bash
# Nuclei DAST — template-based vuln / misconfig / exposure scan against a live or local target.
# The gate is the JSONL export, NOT nuclei's exit code (nuclei exits 0 even WITH findings): any
# exported finding → non-zero. nuclei self-updates its templates on first run.
#
#   tools/security/dast-nuclei.sh <target-url>
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

BASE="${1:-}"
[[ -n "$BASE" ]] || { warn "usage: dast-nuclei.sh <target-url>"; exit 2; }
have nuclei || { skip "nuclei"; exit 0; }

out="$OUT_DIR/nuclei.jsonl"; : > "$out"
hr "DAST · nuclei ($BASE)"
# info-severity excluded (noise); bounded rate-limit for a local box. -jsonl -o writes JSONL to file.
nuclei -target "$BASE" -severity low,medium,high,critical -rate-limit 50 \
  -jsonl -o "$out" -silent 2>/dev/null || true

n="$(grep -c . "$out" 2>/dev/null || true)"; n="${n:-0}"
if [[ "$n" -gt 0 ]]; then
  warn "nuclei: $n finding(s) → $out"; exit 1
else
  ok "nuclei: clean"; exit 0
fi
