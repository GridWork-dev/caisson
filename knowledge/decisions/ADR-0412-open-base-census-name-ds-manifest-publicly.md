# ADR-0412 — Name `@caisson/ds-manifest` on the public open-Base surfaces: the census is sixteen, not fifteen

- **Date:** 2026-08-19
- **Status:** Accepted (operator lock at the session picker, 2026-08-19)
- **Completes:** ADR-0410 §Consequences — the clause recording `@caisson/ds-manifest` as "served,
  Apache-2.0, and publicly unnamed… explicitly NOT decided here". This is that decision, and it
  closes the counsel disposition ADR-0410 only narrowed.
- **Parent:** ADR-0094/0097/0136 (the open-core Base boundary) · ADR-0345 (why `ds-manifest` is open
  in the first place) · ADR-0410 (the analytics retirement) · the counsel drafting memorandum
  (`docs/business/legal/counsel-drafting-memorandum.md`, 2026-07-11)

## Context

Counsel flagged one discrepancy in July: _"The live license page advertises 15 Apache-2.0 packages,
while anonymous registry metadata exposes 16, including `@caisson/analytics`."_ They asked for two
things — a named keep-or-remove decision for `analytics`, and a class-level reconciliation
_"before source publication"_, with the intended package set supplied into a blank in their memo.

ADR-0410 answered the first and assumed it had substantially addressed the second. **It had not.**
The arithmetic counsel cited is unchanged: the site still says 15 and the registry still serves 16.
Only the identity of the sixteenth package moved. `@caisson/ds-manifest` was first published
2026-07-17, six days after counsel's memo, so counsel never saw it; retiring `analytics` narrowed
the cause and left the number alone.

Two exits from ADR-0410's own playbook are structurally unavailable here, which is what makes this
a different decision rather than a repeat:

- **Delisting is not available.** `@caisson/cli` and `@caisson/mcp-server` both declare
  `@caisson/ds-manifest` in `dependencies` in their **published registry manifests**, and a module
  delist makes the tarball answer 401/404 before R2 is reached (ADR-0410 §Consequences). Delisting
  it would break `bun add @caisson/cli` — a package named on the public fifteen-list. Retirement
  would first require folding its source into both consumers and republishing them.
- **Re-licensing it commercial is not available.** The standards-gate forbids an open package
  depending on a commercial one; `cli` and `mcp-server` are both open and both depend on it, so the
  flip trips the boundary check twice and cannot be fixed without also flipping the generator trio
  commercial, contradicting ADR-0136.

And on the merits it should be open regardless. ADR-0345 placed the doctor's static-check logic in
`@caisson/ds-manifest` deliberately, as Apache source gated at the MCP tool by runtime entitlement.
It is a real substrate library that buyers already resolve transitively today.

## Decision

**The public open-Base census is SIXTEEN packages, and `@caisson/ds-manifest` is named on every
surface that enumerates them.**

1. `ds-manifest` joins `BASE_SUBSTRATE_PACKAGES` in `apps/site/lib/base-substrate.ts` — the single
   const every public surface derives from — and joins the AI-config/MCP capability tile, whose body
   now states that the design-system contracts an agent reasons over are open too. The tiles must
   partition `BASE_PACKAGES`, so a new member requires a home; this is its honest one per ADR-0345.
2. The one hardcoded count that renders — `apps/site/app/(marketing)/page.tsx`, "15 base packages" —
   becomes 16. Every other rendered count was already `BASE_PACKAGES.length` and follows for free.
3. `scripts/mirror-assets/README.md` gains its row. The mirror exporter selects purely on the SPDX
   field and has been shipping this package since 2026-07-17 while its own front page omitted it.
4. The two counsel-facing documents are restated, and
   `docs/business/caisson-internal-master-map.md` now explicitly supplies **the intended set** that
   counsel's memo left as a blank placeholder — sixteen, enumerated.

## Consequences

- **Counsel's disposition can now be closed rather than re-narrowed.** The remaining ask was a set,
  not a subtraction. Whether the non-exhaustiveness hedge already live on `/legal/license` ("a
  handful of modules outside the Base set are nonetheless Apache-2.0") was independently sufficient
  is a legal judgment this ADR does not make — but that hedge described "a handful" when the true
  count was one, and it named nothing. It is now accurate by being unnecessary.
- **The structural cause is fixed, and it was mine as much as anyone's.** Both public-list guards
  asserted only one direction — `BASE_PACKAGES ⊆ Apache-on-disk` and `advertised ⊆ exported` — so
  "shipped but unnamed" was invisible to CI by construction. The mirror guard was written **one day
  before this ADR**, in the ADR-0410 PR, specifically to catch the stale-row class, and was written
  one-directional again. Both now assert the converse, both are mutation-verified (removing
  `ds-manifest` turns each red), and both carry a non-vacuity floor so a silently-stopped regex
  cannot make them pass on an empty scan. **A one-directional set guard on a public census is not a
  guard**; it is the mechanism by which the census stays wrong while every gate is green.
- No registry, ledger, index, entitlement, or workspace change: the package was already served,
  already Apache-2.0, already in `OPEN_BASE_NAMES`, and already exported. The `sot` SUMMARY_CLAIMS
  totals were already 16 — **the internal docs were right and only the public surfaces were wrong**,
  which is the inverse of the usual drift direction and the reason no existing gate caught it.
- The `@caisson/analytics` precedent does not generalize to "an unnamed open package gets retired".
  It generalizes to "an unnamed open package gets a decision". This one had dependents; that
  changed the answer.
