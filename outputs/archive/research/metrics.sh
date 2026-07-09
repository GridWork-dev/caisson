#!/usr/bin/env bash
# Objective per-repo metrics to ground-truth agent maturity estimates.
# Output: TSV → repo  code_loc  files  test_files  has_adr  has_specs  commits  last_commit
set -u
OUT=/home/gw/lab/library-research/metrics.tsv
PRUNE='-name node_modules -o -name .git -o -name dist -o -name build -o -name .next -o -name vendor -o -name .turbo -o -name target -o -name .venv -o -name __pycache__ -o -name graphify-out'
CODE='-name *.ts -o -name *.tsx -o -name *.js -o -name *.jsx -o -name *.py -o -name *.rs -o -name *.go -o -name *.svelte -o -name *.vue -o -name *.sql'

printf 'repo\tcode_loc\tfiles\ttest_files\thas_adr\thas_specs\tcommits\tlast_commit\n' > "$OUT"

measure() {
  local label="$1" dir="$2"
  [ -d "$dir" ] || { printf '%s\tMISSING\n' "$label" >> "$OUT"; return; }
  local loc files tests adr specs commits last
  # code LOC
  loc=$(find "$dir" \( $PRUNE \) -prune -o -type f \( $CODE \) -print0 2>/dev/null | xargs -0 cat 2>/dev/null | wc -l)
  # total tracked-ish files (excluding pruned)
  files=$(find "$dir" \( $PRUNE \) -prune -o -type f -print 2>/dev/null | wc -l)
  # test files
  tests=$(find "$dir" \( $PRUNE \) -prune -o -type f \( -name '*.test.*' -o -name '*.spec.*' -o -path '*/tests/*' -o -path '*/__tests__/*' \) -print 2>/dev/null | wc -l)
  # ADRs / decisions
  adr=$(find "$dir" \( $PRUNE \) -prune -o -type d \( -name decisions -o -name adr -o -name adrs \) -print 2>/dev/null | head -1)
  [ -n "$adr" ] && adr=yes || adr=no
  # specs
  specs=$(find "$dir" \( $PRUNE \) -prune -o -type d -name specs -print 2>/dev/null | head -1)
  [ -n "$specs" ] && specs=yes || specs=no
  # git
  if [ -d "$dir/.git" ]; then
    commits=$(git -C "$dir" rev-list --count HEAD 2>/dev/null || echo 0)
    last=$(git -C "$dir" log -1 --format=%cs 2>/dev/null || echo '-')
  else commits=0; last='-'; fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$label" "$loc" "$files" "$tests" "$adr" "$specs" "$commits" "$last" >> "$OUT"
}

for r in dev-profile FOUNDER-OS gridwork-core health-service prospector tessera Wardfile Wardfile-il-dbui; do
  measure "$r" "/home/gw/lab/$r"
done
for r in glossread gridwork gridworkdigital telesis throughframe tm-watch; do
  measure "paused/$r" "/home/gw/lab/paused/$r"
done
measure "media-pipeline" "/home/gw/lab/library-research/sources/media-pipeline"
echo "DONE -> $OUT"
