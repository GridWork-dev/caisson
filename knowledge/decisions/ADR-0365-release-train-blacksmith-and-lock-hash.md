# ADR-0365 — Release-train legs move to Blacksmith; sidecar rows record a lock hash

- **Date:** 2026-07-19 (operator picker locks, v2026.07.18.x release tail)
- **Status:** Accepted (operator-locked)
- **Context ADRs:** ADR-0326 (Blacksmith CI migration, credential-job carve), ADR-0358
  (sibling-churn guard), ADR-0325 (publish-mode byte gate)

## Context

The v2026.07.18 release tail exhausted the caisson-sh org's 2,000 free GitHub-hosted
Actions minutes for July (2,003 consumed; spending limit $0). GitHub-hosted
(`ubuntu-latest`) jobs began failing instantly with zero steps while Blacksmith-hosted
jobs kept running — leaving the release train's delivery legs (readiness · publish-to-R2
· mirror-sync) unable to execute. Separately, the ride surfaced the CAISSON-127
sibling-churn treadmill three times: tarball rows recorded under one dependency
resolution do not byte-reproduce after a later non-frozen install moves an external dep.

## Locks

### 1. Release-train legs run on Blacksmith (amends the ADR-0326 carve)

`release-train.yml` (readiness + propagate), `publish.yml` (publish-and-index), and
`mirror-sync.yml` move from `ubuntu-latest` to `blacksmith-4vcpu-ubuntu-2404`. This
amends the ADR-0326 posture that credential jobs stay on GitHub-hosted runners: the
operator accepts R2/mirror credentials on Blacksmith VM-per-job runners in exchange for
delivery legs that cannot be quota-killed. Remaining `ubuntu-latest` credential jobs
(deploy-railway, version-pr consume) migrate opportunistically if quota bites again.

### 2. Superseded dud tags are operator-deleted

`v2026.07.18` (stale kernel sidecar row; train never uploaded) and `v2026.07.18.1`
(quota-killed train; workflow-at-tag lacks lock 1) are superseded by `v2026.07.18.2`.
Published-tag mutation stays an operator-only act (the agent classifier blocks it by
design); the operator deletes the duds.

### 3. CAISSON-127 fix: record a lockfile hash per sidecar row

Each recorded tarball row gains a `lockHash` (SHA-256 of `bun.lock` at record time). The
version-mode sibling-churn guard re-packs only rows whose recorded hash matches the
current lock — rows recorded under a different resolution get an immediate, precise
"bump this package's own version" error instead of a confusing byte-diff. The
publish-mode byte gate is unchanged (every current row must still reproduce at the tag);
its mismatch error cites the lock-hash delta when present. Rows without a `lockHash`
(pre-ADR history) keep today's re-pack-and-compare behavior. Rejected alternatives:
frozen-install-at-consume (blocks legitimate dep movement inside a consume ride),
stop-inlining-external-types (touches every package's build).

## Consequences

- The release train no longer depends on GitHub-hosted minute quota.
- The sibling-churn guard's false-positive class (external dep moved between rides)
  becomes a precise, actionable error; the repack-changeset remedy is unchanged.
- Security-surface note: R2 write credentials + mirror push token now execute on
  Blacksmith runners (VM-per-job isolation); recorded as an accepted amendment to the
  ADR-0326 boundary.
