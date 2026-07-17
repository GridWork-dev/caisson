# ADR-0359 — CAISSON-125 resolved: prune the 93 historical rows (append-only version-delist), not backfill

- **Date:** 2026-07-17
- **Status:** Locked (operator fork answer, 2026-07-17 PM)
- **Supersedes-in-part:** ADR-0358 D4 (left the fork OPEN) · the 2026-07-17 accept-advisory lock on the R2 historical backlog
- **Extends:** ADR-0271 (module-level delist) · ADR-0006 (append-only artifacts) · ADR-0257 §1 (ledger entries valid forever)
- **Linear:** CAISSON-125

## Context

ADR-0358 D4 built the R2 historical-backfill tool and deliberately left the backfill / prune /
accept-advisory fork OPEN (the prior 2026-07-17 lock was accept-advisory, made before the tool
existed). Re-surfaced to the operator now that the tool is merged; the operator locked **PRUNE**.

## Decision

The 93 superseded version rows whose R2 objects 404 are **pruned from the advertised surface** —
the packument (`registry/index.json`) and the sidecar (`registry/tarballs.json`) stop advertising
versions that do not exist in R2. The mechanism is an **append-only version-level delist**,
extending the ADR-0271 module-level delist to version granularity:

- The original publish rows stay in `registry/ledger.jsonl` (append-only, ADR-0006 — history is
  never rewritten).
- A version-level delist is APPENDED to the ledger for each pruned `(id, version)`.
- `build-index.ts` excludes delisted versions from the packument; the sidecar drops the pruned rows.
- The `r2-parity-probe` then passes: nothing is advertised-but-missing.

Old pinned installs of those versions still 404, but the packument no longer claims they exist —
honest omission, not restoration. **No R2 objects are written or deleted.**

**Not backfill.** The R2 backfill tool (`registry/scripts/r2-historical-backfill.ts`, ADR-0358 D4)
is not the chosen path; its disposition (kept dormant vs. removed) is decided in the prune build PR.

## Execution

- **SHIP (autonomous → PR):** build the version-delist mechanism, prune the 93 rows, add a
  golden / round-trip test proving the pruned packument + sidecar are self-consistent and the parity
  probe passes; SHIP-audit (registry money/license seam).
- **DEPLOY (operator-gated):** re-publish the pruned `index.json` + redeploy the registry Worker so
  `registry.caisson.sh` serves the pruned packument.

## Consequences

- The daily parity probe goes green by honest omission; the packument stops advertising 404ing
  versions.
- The append-only ledger stays intact — publishes preserved, delists appended; no history rewrite.
- No R2 objects are written or deleted; the change is purely to what is advertised and served.
