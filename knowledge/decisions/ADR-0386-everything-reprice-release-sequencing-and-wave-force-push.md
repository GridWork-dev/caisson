# ADR-0386 — Everything-bundle reprice, release-train sequencing, and the wave force-push grant

- **Date:** 2026-07-25
- **Status:** Accepted (operator-locked at the reconcile picker)
- **Parent:** ADR-0384 (the oscal-spine carve and Compliance reprice these follow from) ·
  ADR-0383 (the oscal-spine SKU and its price) · ADR-0258 (the six-bundle final numbers) ·
  ADR-0260 §5 (the flat-40%-X9 renewal formula) · ADR-0328 (the parallel-wave convention D3 amends)

## Context

Three decisions surfaced during the four-PR reconcile. The first two are consequences of ADR-0384
that ADR-0384 did not itself decide; the third is a process gap the wave hit immediately.

## Decisions

### 1. Everything moves $2,059 → $2,259

**Operator pick, matching the recommendation.**

ADR-0384 moves Compliance $1,449 → $1,649 and adds `oscal-spine` ($249) to the catalog. `everything`
is the whole catalog by construction (ADR-0258), so it gains the same $249 of content — but nothing
in the gate set forces it to move. The below-sum lock (`apps/site/lib/pricing.test.ts`) only requires
a bundle to price strictly below the sum of its creditable members, and a larger member sum makes
that _easier_ to satisfy. The price ladder only requires Everything ≥ every other bundle, and
$2,059 ≥ $1,649 holds. **Left alone, Everything would have silently absorbed a new SKU and watched
its premium over Compliance narrow from $610 to $410 — with every gate green.** That is exactly the
class of money drift no gate is shaped to catch.

+$200 is the same treatment Compliance received for the same $249 of new content at the 2026-07-20
round, and it preserves the $610 premium.

- `BUNDLE_RETAIL.everything` = `2259` (`packages/pricebook/src/upgrades.ts`).
- `PRICE_AUTHORITY["@caisson/everything"]` = `225900` cents (`tooling/standards-gate/src/checks.ts`)
  — the price-authority gate fails on any surface that disagrees, which is the point.
- The site display sheet moves in the same change.
- **Knock-on the picker did not have to ask, because the formula determines it:** ADR-0260 §5 takes
  `renewalAmount("everything")` from **$819 → $899** (`floor(2259 × 0.40) = 903`, floored to the
  nearest X9 = 899). `apps/site/lib/pricing.test.ts` asserts the old 819 and must move with it.

### 2. Deploy and tag now; a second train after the oscal wave

**Operator pick, over the recommendation** to deploy now but hold the tag until the catalog is final.

The reconciled `main` gets the full act: the six-leg fleet deploy on one SHA plus migration 0030
(T4), then the release train — 37 changesets into one version PR, an immutable tag, and the Worker
redeployed from that tag (T7). The oscal-spine wave then runs against that base and earns its own
train afterwards.

What this buys: the four technical receipts, and the independent-acceptance and demand programs
sitting behind them, stop waiting on a code wave that has not started.

**The accepted cost, stated plainly so nobody rediscovers it later.** The tagged artifacts advertise
Compliance at $1,449 and Everything at $2,059, and the second train supersedes both. That is two full
release-and-deploy cycles instead of one, and a published tag whose pricebook is knowingly stale.
The exposure is bounded because `npm publish` is a separate operator act behind the OSS and release
gates and commerce is not live — but if publish happens before the second train, the stale prices
ship with it. **Publish should wait for the second train unless there is a reason it cannot.**

Migration 0030 remains a data-migration gate and pages regardless of this sequencing lock.

### 3. Standing force-push grant for reconcile waves

**Operator grant**, amending the ADR-0328 wave convention.

`git push --force-with-lease` to any `feature/*` branch during a reconcile wave is pre-authorized and
does not page. `main` is never force-pushed, and that is not in scope here.

Rebasing a stacked child onto a squash-merged `main` is the wave's normal path — it is how the
convention is designed to work — so paging on each one would interrupt the operator several times
per wave for a mechanical step with no decision in it.

**The trap that rides with the grant** (carried forward from the 2026-07-22 closeout, and it fires
every time): a child rebased onto a squash-merged `main` loses the base branch's changesets from its
`--since=origin/main` diff, so the standards-gate presence leg fails even though the wave plainly had
changesets. Add a branch-local changeset after any rebase onto a squash merge. `changeset status` is
also blind to untracked changeset files — commit first, then verify.

## Consequences

- The oscal-spine wave brief grows two edits: `BUNDLE_RETAIL.everything` and the Everything
  `PRICE_AUTHORITY` row, plus the renewal assertion. It stays one indivisible wave — the
  price-authority gate fails on any catalog where the pricebook and the display sheet disagree.
- The release train runs twice. The first tag is a real, immutable release with knowingly superseded
  prices; the second carries the ADR-0383/0384/0386 catalog. Both are recorded in the deploy log.
- Wave rebases stop paging. Nothing else about the force-push floor changes.

## Not decided here

- When `npm publish` runs against either tag. Operator act, behind the OSS and release gates — and
  see the warning in decision 2.
- Whether the second train also carries `@caisson/verify-pack` (ADR-0385). It depends on whether lane
  A lands before the first tag, which is not yet known.
- Any Everything price beyond this one move. The bundle has no formula tying it to the member sum;
  each reprice is its own operator decision.
