# ADR-0325 — Release train: commit-addressable provenance (version PR → tag → publish tagged bytes)

- **Status:** locked (operator picker, 2026-07-11)
- **Amends:** ADR-0318 (gated release train) · ADR-0223 (registry npm delivery) — mechanics only;
  the operator gate, everything-rides, and fresh-re-audit-per-release locks stand unchanged.

## Context

The 2026-07-11 Codex read-only host/CI audit
(`outputs/audit/codex-host-ci-audit-2026-07-11.md`) found — and an in-session check against
`publish.yml` confirmed — a provenance mismatch in the dormant release train:
`release-train.yml` triggers from a published GitHub Release, then `publish.yml` runs
`changeset version` AFTER the tag exists, uploads tarballs to R2 stamped with the PRE-version
`${{ github.sha }}`, and only then commits the version changes back. The release tag, gate
attestation, CI evidence, shipped tarballs, and final source commit can therefore represent
different source states — and the R2 upload preceding the commit-back leaves a partial-release
window if the rebase/push fails. The train has never run live, so the fix has zero migration
fallout.

## Decision

Rework to a commit-addressable flow BEFORE the train's first live run:

1. Changesets are consumed in a **version PR** (automation-authored, operator-merged) — never on
   the tag path.
2. Green CI is required on the version commit.
3. The immutable tag + GitHub Release are cut on THAT version commit.
4. `publish.yml` publishes **exactly the tagged bytes** (checkout at the tag SHA; no source
   mutation anywhere on the publish path), and every artifact — npm packages, R2 tarballs,
   registry ledger, evidence pack, attestations — records that single SHA.
5. External writes (R2 sync, ledger append) happen only after the source truth they describe is
   committed and pushed — no upload-before-commit window; reruns must not silently overwrite
   version-keyed objects.

## Consequences

One SHA anchors source → ledger → tarballs → mirror → provenance. The release runbook gains a
version-PR step. The "never in-branch `changeset version`" rule (ADR-0321) is unchanged — the
version PR is the gated consumption point, still never a feature-branch act. The rework is a
tracked build item (Linear, release-train rework); the train stays dormant until it lands.
