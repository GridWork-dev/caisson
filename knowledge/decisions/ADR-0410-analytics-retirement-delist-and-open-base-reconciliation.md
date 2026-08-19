# ADR-0410 — Retire `@caisson/analytics`: delete the package, append-only module delist, reconcile the open-Base census

- **Date:** 2026-08-18
- **Status:** Accepted (operator lock at the session picker, 2026-08-18)
- **Supersedes (in part):** ADR-0407 §"Decision" — the clause parking **C01** pending "a superseding
  ADR". This is that ADR; C04 stays parked and is not taken here.
- **Parent:** ADR-0287 (the wave-1 driver batch that authorized the package) · ADR-0094/0097 (the
  open-core Base boundary) · ADR-0402 (the `@caisson/agent-usage` delist, whose mechanics this
  follows exactly) · the 2026-08 consolidation audit, row C01
  (`outputs/audit/2026-08-consolidation/evidence/C01-analytics-retirement.md`)

## Context

`@caisson/analytics` was authorized by ADR-0287 and shipped 2026-07-07 as a wave-1 driver: a
provider-agnostic analytics port with GA4, Plausible, and PostHog adapters. It has never acquired a
consumer. Every commit touching it since creation is a mechanical version PR or a repo-wide
toolchain sweep; no source file in the monorepo imports it, and the two first-party analytics paths
that could have used it — `apps/site/lib/ask-ai/ai-capture.ts` and
`services/license/src/posthog-capture.ts` — each call PostHog directly and only mention the package
in a comment.

The consolidation audit ranked it C01 and refused to frame it as a dead private package, correctly:
it is Apache-2.0, published, and current on the live registry. ADR-0407 executed the 18 mechanical
cuts and parked C01 precisely because retiring a live public API is a product decision, not a
cleanup.

Two things settled since make the decision safe to take now.

**The external-usage check the card required came back clean on every channel.** npm has nothing:
`@caisson/analytics` 404s and so does the entire `@caisson` scope, because the npm publish leg has
never been armed (CAISSON-179). The OSS mirror `caisson-sh/caisson-oss` is still PRIVATE — the
public flip is an operator-owned launch gate pending business approval and a `MIRROR_PUSH_TOKEN`
rotation — so no clone or star depends on it. That leaves `registry.caisson.sh`, which does serve
it (latest `0.2.8`, `tier: oss`, `priceCents: null`, empty `editions` and `members`), but commerce
is still Paddle SANDBOX, so there is no paying installer to strand. Public-consumer exposure, the
one thing the audit rated "low confidence", resolves to effectively zero.

**Counsel has independently asked for this decision.** The drafting memorandum records that the
live license page names 15 Apache-2.0 packages while anonymous registry metadata exposes more,
"including `@caisson/analytics`, which does not appear on the public 15-package page", and closes
with an explicit instruction: _"require a keep-or-remove decision for `analytics`."_ Retiring it is
one of the two answers counsel will accept, and it is the one consistent with the package having no
users and no roadmap.

## Decision

**Retire `@caisson/analytics`.** Delete the package from the monorepo and remove it from the served
registry surface by an append-only module delist, retaining all publish and tarball provenance.

Mechanically, following ADR-0402 exactly:

1. A single `DelistEntry` line (`op: "delist"`, the id, `delistedAt`, `reason`, no `version` field)
   is appended as the new last line of `registry/ledger.jsonl`. Existing bytes are never touched;
   `parseLedgerLines` makes the delist terminal, so any later publish row for this id is a parse
   error rather than a silent resurrection.
2. `registry/index.json` is **regenerated** by `bun registry/scripts/build-index.ts`, never
   hand-edited — CI fails the build if the committed file is not byte-identical to a fresh rebuild.
   The module entry disappears as a consequence of the ledger, not by editing the index.
3. `registry/tarballs.json` is left untouched. A module delist retains tarball provenance; only the
   served index drops the id. This is the property that distinguishes it from the version-level
   prune in `prune-versions.ts`, which physically removes rows.
4. The open-Base census is reconciled in the same commit — the standards-gate `OPEN_BASE_NAMES`
   allowlist and the eight machine-checked `SUMMARY_CLAIMS` totals across `build-state.md`,
   `package-catalog.md`, `public-surface.md`, and `architecture.md`, plus the per-package row that
   `sot-check` would otherwise flag as a dead row.

## Consequences

- The Apache-2.0 open Base goes from 17 packages to 16, and Bun workspaces from 75 to 74. The
  anonymous free floor serves 16 modules where it served 17; the full committed index goes 53 to 52.
- **A registry-Worker redeploy is a required post-merge act, not an optional one.**
  `registry/worker/deploy-entry.ts` inlines `index.json` at build time and `deploy-worker.yml` is
  dispatch-only with no push trigger, so merging this change leaves the live edge still advertising
  `@caisson/analytics` until the Worker is redeployed from the merge commit. This PR carries that
  as a deploy obligation, the way ADR-0407 carried the Better Stack one. The `/demo` page's
  release-time preview artifact (`apps/site/public/demo-preview/preview.json`) also embeds an
  install transcript naming `@caisson/analytics@0.2.1`; it is a dated snapshot, but it should be
  regenerated on the next release rather than left showing an unresolvable package.
- **One operator check before the Worker redeploy** (ADR-0402 set this precedent): a live
  `entitlement_grant` row naming `analytics` or `@caisson/analytics` with `status = 'active'` would
  now hit the fail-closed entitlement throw, which the Worker catches by degrading that caller to
  base-only — so a buyer holding a bundle _plus_ that id would silently lose the bundle. Repo state
  rules this out (never sellable: `tier: oss`, `priceCents: null`, absent from every bundle members
  map and from the pricebook), but a hand-inserted grant is the one path the repo cannot rule out,
  and no build-time gate validates purchased ids against the index.
- The OSS mirror drops the package automatically on its next sync. `export-public-mirror.ts` selects
  purely on the SPDX `license` field and names no package explicitly, so deleting the directory is
  the whole change.
- Provenance survives as an ARCHIVAL record, not as availability. Ten publish rows and eight
  tarball rows stay in place, and the R2 objects are untouched — but no route serves them any more.
  The tarball route gates on `entitled`, which derives from the index, so dropping the id from the
  index removes byte access as a consequence: a delisted tarball answers 401/404 before R2 is
  reached, for anonymous AND authenticated callers alike, and no entitlement can expand to it. The
  retired package is therefore strictly less reachable than a commercial one. That is the intended
  posture — the provenance is for the record, not for install — and it is stated here because the
  distinction between "retained" and "addressable" is exactly what a future reader would assume
  wrongly.
- **The census discrepancy is narrowed, not closed.** The live registry currently serves two
  Apache-2.0 modules that the site's 15-package `BASE_PACKAGES` list does not name: `analytics` and
  `@caisson/ds-manifest`. This ADR removes the first. `ds-manifest` remains served, Apache-2.0, and
  publicly unnamed — the same class counsel flagged, one instance later. It is explicitly NOT
  decided here and re-enters through its own operator decision before the public flip.
- Re-introducing an analytics port later is a new package decision, not a revert of this one; the
  delist is terminal in the ledger by construction.
