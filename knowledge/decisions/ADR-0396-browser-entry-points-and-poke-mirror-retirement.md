# ADR-0396 — Browser-safe `./browser` entry points on oscal-spine + frameworks-pack, and the poke-mirror retirement pattern

- **Date:** 2026-08-01
- **Status:** Accepted (operator lock at the 2026-08-01 poke-mirror picker)
- **Parent:** ADR-0384 (the oscal-spine carve and its source-compatibility promise) · ADR-0395
  (the `@caisson/kernel` barrel split this generalizes) · ADR-0378 (the poke program whose
  mirrors this retires) · ADR-0002 (engineering invariants — `crypto.randomUUID()` for ids)
- **Supersedes:** nothing; additive to ADR-0384's single-entry shape

## Context

The site's interactive pokes were driven by hand-ported "mirror" modules
(`apps/site/components/poke/*-logic.ts`) because the real packages were believed unable to enter
a client bundle. A design round with adversarial verification (2026-08-01) found the mirrors'
justifying headers largely stale — the kernel `.` barrel has been browser-safe since ADR-0395 —
and found the remaining genuine blockers to be narrow: `node:crypto` `randomUUID` imports used
only as injectable-seam defaults, a value import of two vocabulary constants living in the
node-only delivery transport module, and `crosswalks/regimes.ts` value-importing the tainted
spine barrel. Bundlers do not fail on any of this — they substitute polyfills (~428KB observed),
so every claim below is proven by a static source-graph walk, never by a build.

## Decision

1. **`@caisson/oscal-spine` and `@caisson/frameworks-pack` each gain a permanent public
   `./browser` entry point** (`{bun → src, types/default → dist}` conditions, matching every
   existing subpath). `.` stays the full node-capable barrel, byte-identical for buyers.
2. **Subset discipline is one-way and enforced:** every runtime name on `./browser` must also be
   on `.` — never the reverse. Each package's `src/browser-safety.test.ts` pins this plus the
   zero-offender walk (via `@caisson/testing/module-graph`), with a positive control on the `.`
   barrel so a walker gone blind fails loudly instead of greening vacuously.
3. **Admission rule:** a module joins `./browser` only when its entire value-import graph —
   including cross-package edges — passes the static walk. `evidence/oscal-iso27001-soa.ts`
   stays off until a consumer needs it browser-side (it drags `@caisson/artifact-render` into
   the entry's promise).
4. **The default id seam moves to the WebCrypto global:** `options.newId ?? (() =>
crypto.randomUUID())` in the pure exporters, replacing the `node:crypto` import. This is a
   runtime-semantics change on a published default (same UUIDv4 contract, different source);
   both packages now declare `engines.node >= 20.12.0` (matching `packages/cli`, the only prior
   floor), and the changesets name the change — including `@caisson/compliance-core`, which
   re-exports the affected functions. The vocabulary constants (`OSCAL_VERSION`,
   `CAISSON_OSCAL_NS`) move to `contracts.ts` with names preserved on the barrel
   (`public-api.test.ts` pins them).
5. **The poke-mirror pattern is retired in favor of real-package pokes.** frameworks-pack and
   oscal-spine pokes import the `./browser` entries; risk-register imports the already-safe `.`
   barrel; access-review's poke relative-imports the package's internal pure module
   (`src/decisions.ts`) — deliberately NOT a public subpath (operator lock: no new public entry
   point on that SKU). Sample data and presentation composition stay poke-local; ported package
   logic does not.

## Consequences

- Two priced SKUs carry a permanent second supported import path; README, AGENTS.md, and the
  storefront module pages document it in the same change (ADR-0082 artifacts-true-to-built).
- The minor version bumps ride the next release train normally: `changeset version` lands the
  bumps with ledger rows + regenerated registry index in the version PR, and the train's leg 1b
  (`deploy-worker.yml`) re-bakes the live edge — the publish-gap guard
  (`publish-config.test.ts`) enforces the pairing.
- The remaining `*-logic.ts` mirrors in the poke directory cite a retracted premise and retire
  against this pattern as follow-ups, one PR per cluster (ADR-0328).

## Rejected

- Narrowing or removing `export * from "@caisson/oscal-spine"` in frameworks-pack's barrel — a
  breaking change the site's own FAQ promises against (module-pages: "existing imports keep
  working").
- A public `/decisions` subpath on `@caisson/access-review` — the cheaper internal-module +
  relative-import shape achieves the retirement with zero published-surface change.
- Proving browser-safety with `next build` — a bundler substitutes node builtins; exit 0 proves
  nothing (the ~428KB crypto-browserify observation that started the kernel split).
