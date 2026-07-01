# ADR-0178 — Edition members-fold: bundle the Stage-2 harvest primitives into their editions

**Status:** accepted · 2026-07-01 (operator provider picker) · extends **ADR-0077** (frozen edition member
pin map), **ADR-0137** (editions repriced below module-sum), **ADR-0003** (composition, never fork) ·
implements the "Edition members-fold (Stage-2)" open item from `docs/state/decisions-and-forks.md`.
Append-only; supersede with a later ADR, never edit. **Tags:** `pricebook`.

## Context

The Stage-2 harvest shipped three commercial primitives, published standalone in the registry (index 27→32):
`@caisson/alerting` + `@caisson/retention-runner` (Compliance-facing) and `@caisson/tool-exec`
(Agentic-Dev-facing). Their manifests declare `editions: []` and note "membership added by the edition at
integration" (a primitive never self-declares edition membership — ADR-0077). Whether the editions **bundle**
them (buyer gets them with the edition price) or sell them **à-la-carte** was deliberately not auto-decided at
integration: it changes edition-bundle economics, and ADR-0137 had already repriced the editions below the
sum of their modules **anticipating** these inclusions.

## Decision

**Fold the three primitives into their editions' frozen member pin maps** — buyers get them at the edition
price, no separate SKU:

- **Compliance** (`packages/compliance/manifest.ts`) `members` += `@caisson/alerting`, `@caisson/retention-runner`.
- **Agentic-Dev** (`packages/agent-dev/manifest.ts`) `members` += `@caisson/tool-exec`.

This realizes the primitives' own manifest note and matches the ADR-0137 reprice. Editions remain
compositions, never forks (ADR-0003); the members map stays the single frozen pin map (ADR-0077) — each new
pin must resolve in the registry index (`resolveEditionMembers` fails closed on an absent pin), which it does
(all three are published). à-la-carte purchase of the same primitives is not precluded for non-edition buyers.

## Consequences

- Edition member pin maps grow (Compliance 5→7, Agentic-Dev 5→6). `resolveEditionMembers` (cli `meter.ts`)
  folds the extra pins into generated `package.json` deps at generation time.
- The change is realized at the **next gated republish** of each edition: the members map is snapshotted into
  `registry/ledger.jsonl` → `registry/index.json` (ledger-driven, byte-identical CI rebuild). The manifest edit
  is the source of truth the publish snapshots; runtime resolution reads the index. Edition minor version bump
  (0.1.0 → 0.2.0) marks the buyer-facing content change.
- No edition margin regression beyond ADR-0137 (the reprice already assumed the bundle).
