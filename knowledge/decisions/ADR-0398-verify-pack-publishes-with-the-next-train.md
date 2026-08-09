# ADR-0398 — verify-pack publishes with the next release train (published-never-sold)

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the 2026-08-09 ponytail-audit remediation picker)
- **Parent:** ADR-0385 (verify-pack is the only sanctioned out-of-band verifier; a tool, not a
  SKU) · ADR-0373 (artifact-render published-never-sold precedent) · ADR-0069/0223 (changesets
  consume only in the gated train)
- **Supersedes:** nothing; schedules the publish ADR-0385 left operator-gated

## Context

The audit flagged `@caisson/verify-pack` (946 LOC) as zero-importer dead code. Investigation
refuted the framing: the package is deliberately staged substrate. Its manifest states —
"Until the operator-gated first publish, package.json stays `private:true` and carries no
publishConfig; the publish act flips both instead of fabricating a registry-ledger row." — and
`packages/kernel/src/evidence/pack.ts`'s generated README routes auditors to the open kernel
precisely because an `npx` line naming an unpublished package cannot resolve. ADR-0385's design
holds: an evidence pack ships NO executable verifier; independent verification must be
independently obtained.

The operator's picker answer named the package "a Compliance-bundle substrate member." That
phrasing collides with ADR-0385's explicit lock — "no `SKU_RETAIL` row, **no bundle
membership**, no catalog-count change" — and bundle membership is a catalog/pricing act
(member joins drive ADR-0257 snapshot grandfathering). The existing lock wins; this ADR
records the publish schedule only. If the operator wants Compliance membership, that is a new
catalog+pricing fork to raise explicitly.

## Decision

1. **`@caisson/verify-pack` publishes with the NEXT release train** as a
   **published-never-sold** package (the ADR-0373 artifact-render precedent): installable for
   resolvability, `sellable:false`, no `SKU_RETAIL` row, no bundle membership, no catalog-count
   change — exactly ADR-0385's shape, now with a date.
2. **This wave preps the flip; the train performs it.** The wave lands the changeset and any
   manifest/standards-gate adjustments the publish needs; `private:true` + publishConfig flip
   rides the train's version PR so the ledger row is real, never fabricated.
3. **At publish, kernel's evidence README gains the resolvable install line** it currently
   refuses to print, closing the loop ADR-0385 called an honest limitation.

## Consequences

- The auditor-facing independent-verification story completes before Gate A's
  working-auditor acceptance reviews need it.
- One more package rides the next train's consume; no pricing surface moves.

## Rejected

- Deleting the package — contradicts its documented staged design and ADR-0385.
- Compliance bundle membership via this lock — a catalog/pricing act ADR-0385 forbids and
  nobody priced; requires its own fork if wanted.
- Publishing mid-wave outside the train — ADR-0069/0223 gate all consumes to the train.
