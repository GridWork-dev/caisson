# ADR-0388 — The oscal-spine wave runs in parallel and merges before the first release train

- **Date:** 2026-07-25
- **Status:** Accepted (operator-locked)
- **Supersedes in part:** **ADR-0386 decision 2**, whose sequencing put the oscal-spine wave after
  the first release train. The rest of ADR-0386 stands unchanged.
- **Parent:** ADR-0383 / ADR-0384 (the oscal-spine SKU, carve, and reprice) · ADR-0387 (the T8 wave
  that changed the premise) · ADR-0328 (the parallel-wave convention this rides)

## Context

ADR-0386 decision 2 ordered the fleet deploy and the release train **before** the oscal-spine wave,
and explicitly accepted the cost: two release-and-deploy cycles, and a first immutable tag whose
pricebook advertises the superseded $1,449 Compliance and $2,059 Everything. That trade was
reasonable on its premise — the deploy was the next act, and delaying it to wait for a code wave
would have held up the four technical receipts and everything queued behind them.

**ADR-0387 removed that premise the same day.** Wiring Azure Key Vault turned out to be a code wave
through the tenant-secret path rather than an environment swap, so T8 now sits ahead of the deploy.
The deploy is no longer imminent; it is a full wave away.

## Decision

The oscal-spine wave runs **in parallel with T8**, in its own worktree, and **merges before** the
first release train.

The T8 window is schedule that already exists. Spending it on the oscal wave costs nothing against
the deploy date and buys back everything ADR-0386 gave up: the first tag carries $1,649 Compliance
and $2,259 Everything, and there is one release train instead of two.

**Operator pick, matching the recommendation.**

## Consequences

- ADR-0386's accepted two-cycle cost is **withdrawn**, along with the warning that `npm publish`
  should wait for a second train. With correct prices in the first tag, publish rides the normal
  release gates.
- Three lanes now run concurrently (T8, this wave, and the board fork-walk preparation), so the
  ADR-0328 reconcile requirement applies before any of them merges.
- The lanes are tree-disjoint by construction and the briefs say so explicitly. T8 owns
  `packages/field-crypto`, `apps/site/lib/byok.ts`, and `packages/ai-kit`. The oscal wave owns
  `packages/oscal-spine`, `compliance-core`, `frameworks-pack`, `pricebook`,
  `apps/site/lib/pricing.ts`, `tooling/standards-gate`, `tools/paddle-catalog-recreate.ts`,
  `registry/`, and `services/docs`. `docs/ops/launch-runbook.md` is shared and split by section:
  T8 owns the boot-blocking table, the oscal wave owns the price probe. Both lanes write
  `.changeset/` and `docs/state/`; distinct filenames and a reconcile are expected.
- The Paddle catalog recreate should still wait for the oscal wave — it goes 35/66 to 36/68, and
  recreating before the wave means recreating twice.

## Not decided here

- Whether the deploy itself moves earlier if T8 lands faster than expected. It stays behind T8 and
  the arming pass per ADR-0387.
- The merge ORDER between T8 and the oscal wave. Whichever is green first goes first; the second
  rebases and adds a branch-local changeset, per the ADR-0386 force-push grant and its recorded
  rebase-over-squash trap.
