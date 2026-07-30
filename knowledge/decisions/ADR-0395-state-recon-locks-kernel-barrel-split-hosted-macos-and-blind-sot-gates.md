# ADR-0395 — State-recon locks: kernel-barrel split, hosted macOS runner, Article 50 draft-then-review, and the three blind `sot` gates

- **Date:** 2026-07-30
- **Status:** Accepted (operator lock at the 2026-07-30 state-recon picker)
- **Parent:** ADR-0328 (execution waves run as parallel worktree sessions) · ADR-0391 (the
  `/writing` surface and the Article 50 timing this ADR resolves) · ADR-0327 (sot-check per-doc
  parity as the answer to a recurring stale-count class) · ADR-0326 (Blacksmith hot path) ·
  ADR-0390 (the ~$79/mo CI cost baseline this spend is measured against)
- **Supersedes:** ADR-0391's "not decided here" on the Article 50 article and `/writing` IA
  (decision 1 below); ADR-0326's self-hosted macOS leg (decision 3 below)

## Context

A full-repository state recon on 2026-07-30 (11 parallel readers plus a completeness critic)
found the tree mechanically clean — `bun run sot` green on all nine gates, zero open PRs, zero
worktrees, production current at `f9c04f33` with index parity OK — and simultaneously found
several load-bearing claims in the source-of-truth docs to be false. The two facts are connected:
three `sot` gates are structurally incapable of seeing the drift they appear to cover.

- `package-count-parity` diffs only `docs/build-state.md`'s **per-package** rows against disk. It
  never parses a summary total and never opens `docs/state/package-catalog.md`. That file's
  "62 packages / 45 commercial / 80 workspaces" is wrong against disk truth (63 / 46 / 81) and
  can stay wrong indefinitely.
- `frontmatter-freshness` compares a doc's `updated:` stamp against its **grounds** paths only.
  The doc's own last-commit date is never in the comparison, so a doc edited today and left
  stamped last week passes clean. `docs/build-state.md` did exactly this in `f9c04f33`.
- `changeset-gate-preflight` runs `changeset status --since=origin/main`. On `main` that
  self-compares to an empty diff and prints "NO packages to be bumped" while 11 changeset files
  are in fact queued across 68 packages.

The consequence is concrete. `docs/build-state.md` — source-of-truth item 4 in `CLAUDE.md`'s
hierarchy — opens by naming `v2026.07.20.3` as the latest tag (two releases behind),
`2efeea98` as the reconciliation base, "Fleet parity RED" against digests every service has since
moved past, and a 54-file changeset queue that PR #359 drained. `docs/adr-index.md` carries no
ADR-0394 row, and the ceiling gate passes anyway because it reads the 30KB prose contiguity line
at `:20`, which narrates 0394 without the catalog row existing.

The same recon found four packages — `trust-page`, `access-review`, `risk-register`,
`artifact-render` — built, tested, declared as `apps/site` dependencies, and never imported.
`apps/site` ships hand-ported parity-tested mirrors under `components/poke/` instead, because the
real packages reach `node:crypto`/`fs`/`dns` through the kernel `"."` barrel and none of it
resolves in a browser bundle. Three of those four are priced SKUs. Separately,
`aiRiskRegisterCollector` is exported and unit-tested but absent from the four collectors
`apps/compliance/lib/leg.ts` assembles, so Caisson's own reference evidence pack does not
demonstrate the collector behind the $279 risk-register SKU.

Finally, the `quality` workflow's run for `d7f7d834` sat `queued` for 18 hours because the
self-hosted runner `gw-gws-mac-mini-639381ed` reports `offline`. Every other job in that run
passed. Earlier pushes only looked healthy because each stuck run was cancelled by the next push
before the wedge was visible; PR-event runs passed on that runner as recently as 18:39 on
2026-07-29, so this is an availability regression, not accumulated rot.

## Decisions

### 1. The Article 50 piece is drafted now and published by the operator, not by the cycle

ADR-0391 committed to publishing an EU AI Act Article 50 piece by 2026-08-01 and simultaneously
declined to pre-decide the article's legal conclusions or the `/writing` surface's IA. Those two
positions cannot both survive the calendar: the Article 50 obligations bite 2026-08-02 and the
tracked competitor count on that hook moved from 1 to 6 (CAISSON-153).

The `/writing` IA and a full draft, grounded in the already fact-verified research
(`outputs/research/2026-07-26-ai-act-article-50-live-copy-audit.md` and its `-verification`
companion), are built now and land on a branch. **Publication is a separate operator act.** The
article states legal conclusions about a live regulation, which is exactly the class the one
operator rule reserves — an agent drafts the argument, the operator owns the claim. ADR-0391's
date is satisfied by the draft being reviewable on 2026-08-01, not by an unreviewed publish.

### 2. The kernel barrel is split; the poke mirrors are retired at the root cause

The node-only surface moves out of the `@caisson/kernel` `"."` barrel behind its own entry point,
so `trust-page`, `access-review`, `risk-register`, and `artifact-render` become browser-importable.
`apps/site` then imports the real packages and the `components/poke/` mirrors are deleted.

The mirrors are honest and parity-tested, so this is not a defect being patched — it is the
cheaper long-run position. Every mirror is a second implementation that must be kept in lockstep
by a test that can only ever check the cases someone thought to write, and the operator is
carrying four of them against three priced SKUs. The larger one-time diff is taken over an
unbounded drift surface. `aiRiskRegisterCollector` joins the production evidence leg in the same
change, because a priced compliance SKU whose collector never runs in the reference pack is the
same class of gap stated in product terms.

### 3. `native-ext` (macOS) moves to a GitHub-hosted runner

The self-hosted Mac mini leaves the required-check path. A single machine that can wedge every
`main` push indefinitely, while reporting nothing distinguishable from "still running", is not an
acceptable dependency for a required gate — and the failure was invisible for as long as pushes
kept cancelling each other.

The macOS minute multiplier is accepted against the ADR-0390 baseline (~$79/month measured,
$120 alert). `native-ext` is one leg of one workflow, not the hot path ADR-0326 moved to
Blacksmith; if its measured cost changes that judgement, the fork reopens against the same
$120 line rather than being re-litigated per run.

### 4. The three `sot` gates are extended to cover what they appear to cover

A gate that reports green over a false claim is worse than no gate, because it converts an
unchecked doc into a checked-looking one. All three are extended in this wave:

- `package-count-parity` additionally asserts the **summary totals** in both `docs/build-state.md`
  and `docs/state/package-catalog.md` against the disk count it already computes.
- `frontmatter-freshness` adds the doc's **own path** to the set compared against its `updated:`
  stamp.
- `changeset-gate-preflight` reports the real queued set when run on `main`, rather than
  self-comparing to an empty diff.

The doc corrections themselves (`build-state.md`'s header block, `public-surface.md`'s 16-vs-17
and 46-vs-54 drifts, the missing ADR-0394 index row, the one-day tracker lag) ride the same PR as
the gate that would have caught each one.

### 5. This wave runs as parallel worktree sessions and stops at PRs

Per ADR-0328: one PR per lane, hard; push, do not merge; boards frozen; a dedicated reconcile
session once two or more branches are open. The release train is cut **last**, after the code and
doc lanes land, so it consumes one coherent changeset set rather than a snapshot that is stale on
arrival — and it **stops at the version PR**. Riding the train is an operator act, unchanged by
this ADR.

## Consequences

The kernel-barrel split is the largest diff in the wave and touches five packages plus `apps/site`;
it is the one lane that warrants an independent adversarial pass, on this repo's own evidence that
the in-lane review misses what the independent grill catches (the 2026-07-25 grill found two P1s
past a lane that had self-reported code, security, and adversarial PASS).

Moving `native-ext` to a hosted runner means the Mac mini is no longer load-bearing for CI. It is
not decommissioned here — that is a separate act with its own inventory implications.

Publishing the Article 50 piece remains gated on the operator reading its legal conclusions. If
that review does not happen by 2026-08-01 the commitment is missed with the draft in hand, which
is recorded honestly rather than resolved by an unreviewed publish.

## Not decided here

- Whether the Mac mini is decommissioned or repurposed once it leaves the required path.
- Whether the `knip` lane stops being `--no-exit-code`. The unused-dependency cleanup and the
  `betterstack-adapter` coverage gap ship in this wave; flipping the lane to blocking is a
  separate call once the finding count is actually zero.
- The `/writing` surface's publishing cadence beyond this first piece.
