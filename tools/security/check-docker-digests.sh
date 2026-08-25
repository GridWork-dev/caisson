#!/usr/bin/env bash
# Assert every first-party Dockerfile FROM line is digest-pinned (@sha256:). Backs finding K-03
# (docs/security/strix-findings-2026-07-10-round2.md) — Trivy's DS-0001 only flags ':latest',
# never tag-instead-of-digest, so this grep-level gate is the actual enforcement.
#
# EXCLUDES the create-caisson buyer-scaffold templates (packages/cli/templates/**): a frozen
# Caisson digest would rot in downstream buyer repos that have no Renovate to bump it — the same
# carve-out renovate.json makes for docker:pinDigests.
#
# NOTE: advisory until Renovate's digest-pin PRs land (images ship tag-pinned today). scan.sh
# runs it non-blocking in the `ci` layer; promote to blocking once the pins merge.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0
while IFS= read -r -d '' f; do
  while IFS= read -r line; do
    img=$(awk '{print $2}' <<<"$line")
    [[ -z "$img" || "$img" == "scratch" ]] && continue
    # Skip build-stage alias refs (FROM builder AS x): a prior-stage name has no registry path
    # (no '/', ':' or '@'); a real base image always carries a tag or digest.
    [[ "$img" != *"/"* && "$img" != *":"* && "$img" != *"@"* ]] && continue
    if [[ "$img" != *"@sha256:"* ]]; then
      echo "::warning file=$f::unpinned FROM (no @sha256 digest): ${line#"${line%%[![:space:]]*}"}"
      fail=1
    fi
  done < <(grep -iE '^[[:space:]]*FROM[[:space:]]' "$f")
# `mirror-out/` is the gitignored public-mirror export. It carries a COPY of
# packages/cli/templates/, so the same template Dockerfiles reappear under a path the
# templates exclude above does not match, and this walks the raw filesystem (`find .`)
# rather than `git ls-files`. CI never has the directory so it never saw them; a local
# tree with a stale export fails --strict-digests on files that are not first-party
# source. Excluded here so the local run and the CI run agree.
done < <(find . -type f \( -name 'Dockerfile' -o -name 'Dockerfile.*' \) \
  -not -path './packages/cli/templates/*' \
  -not -path './mirror-out/*' \
  -not -path './node_modules/*' -not -path '*/node_modules/*' \
  -not -path '*/.next/*' -print0)

if [[ $fail -eq 0 ]]; then
  echo "✓ all first-party Dockerfile FROM lines are @sha256 digest-pinned"
fi
exit $fail
