# ADR-0097 — Split `@caisson/registry` into an open schema package + a commercial service

Status: accepted · 2026-06-29 (operator lock, W1 implementation picker) · **amends ADR-0094** (open-core
Base) to resolve a boundary conflict it under-specified. Composes on ADR-0003 (composable packages,
no-depend-up), ADR-0020/0021 (module manifest + registry), ADR-0047 (registry read-path), ADR-0071
(entitlement expansion), ADR-0074 (feature-tag registry seam).

## Context

ADR-0094 licensed the Base substrate Apache-2.0 and mandated the standards-gate enforce that "an open
package may not depend 'up' on a commercial one." It asserted "the open Base depends only on the open
set." **That assertion is false on the merged tree:**

- `@caisson/credits` (open) imports `FeatureTag` + `FeatureTagSchema` from `@caisson/registry`
  (commercial) — the ADR-0074 feature-tag enum (`packages/credits/src/credits.ts:8`).
- `@caisson/mcp-server` (open) imports `RegistryIndex`, `EDITIONS`, `assertKnownModule`,
  `assertKnownVersion`, and `expandEntitlements` from `@caisson/registry`
  (`packages/mcp-server/src/server.ts:29-35`).

The W1 no-depend-up gate would hard-fail both. ADR-0094 named "entitlement expansion, the registry" as
commercial value, yet also called `mcp-server` an open package — a contradiction it never resolved. The
entire `registry/schema/` tree is pure (`zod` + `node:fs`, zero `@caisson/*` runtime deps), so the
contract is cleanly separable from the service. ADR-0094 itself states the principle this split applies:
"open transport, commercial product behind it."

The operator reopened the fork (W1 implementation picker, 2026-06-29) and chose the schema/service split.

## Decision

**Extract the pure registry CONTRACT into a new open base package `@caisson/registry-schema`
(Apache-2.0). The commercial `@caisson/registry` keeps the SERVICE.**

**OPEN — `@caisson/registry-schema` (Apache-2.0):** the module-manifest schema (`defineModule`,
`ModuleManifest`, `SPDX_LICENSES`, `EDITIONS`, `MODULE_KINDS`, …), the registry-index schema +
allowlist helpers (`RegistryIndex`, `loadRegistryIndex`, `loadRegistryIndexFromFile`,
`moduleAllowlist`, `assertKnownModule`, `assertKnownVersion`), the feature-tag registry
(`FeatureTag`, `FeatureTagSchema`, `assertRegisteredFeatureTag`, ADR-0074), and the
entitlement-expansion resolver (`expandEntitlements`, `expandEntitlementsFromFile`, `BUNDLE_ID`,
ADR-0071). These are the typed contract — pure derivation over public catalog data, `zod`/`node:fs`
only, no secrets. This is non-differentiating table-stakes, the same class as `@caisson/kernel`.

**COMMERCIAL — `@caisson/registry` (LicenseRef-Caisson-Commercial):** the registry SERVICE — the
Cloudflare `worker/` (live read endpoint), the CI index builder + `backfill`/`append-ledger`/
`ci-publish-step` scripts, and the gated publish flow. It depends on `@caisson/registry-schema` and
re-exports it (a thin shim at `registry/schema/*`) so every existing relative importer keeps resolving
unchanged.

**Why `expandEntitlements` goes open (a narrowing of ADR-0094):** the resolver is pure data
derivation over the _already-built public index_ — it computes "which member slugs does this purchased
edition/bundle id map to." It holds no secret, no account state, and no purchase data. The real
commercial value stays closed: WHO is entitled (the purchase + grant in `services/license`), WHAT the
catalog contains and how it is built/published (the service), and the per-tool entitlement _gate_ in
`mcp-server` (ADR-0076, timing-safe). Publishing the membership _math_ does not undercut the moat; it
makes the open Base genuinely resolvable against open deps only.

## Rejected

- **Inject the registry surface via ports (full decoupling):** hoist feature-tags into `kernel`,
  give `mcp-server` port interfaces for allowlist + entitlement-expansion injected by a commercial
  host. The most literal reading of ADR-0094 (registry wholly commercial), but it changes
  `mcp-server`'s public API + every call site + `apps/base` wiring + tests — the largest blast radius
  for no extra integrity over the split. Deferred as available if the contract ever needs to vary by host.
- **Narrow the gate to editions only** (treat registry/field-crypto/audit-worm as a commercial
  _primitive_ layer the open Base may depend on): zero code movement, but leaves Apache-2.0
  `@caisson/credits` with a hard runtime dependency on the commercial `@caisson/registry` — the "open
  Base is independently usable" promise becomes hollow, and it contradicts ADR-0094's literal
  "may not depend on a commercial one." Rejected for hollowing the acquisition-lever rationale.

## Binding

- The open set is the ADR-0094 ten **plus `@caisson/registry-schema`** = eleven Apache-2.0 base
  packages. The standards-gate `checkOpenCoreLicensing` asserts each open name ships `Apache-2.0`
  (tier `oss`, no `priceCents`) and every other `packages/` module ships
  `LicenseRef-Caisson-Commercial` (tier `paid`, positive `priceCents`).
- `checkOpenCommercialBoundary` (the ADR-0094 no-depend-up gate): an Apache-2.0 package may depend
  only on Apache-2.0 workspace packages. `@caisson/registry-schema` depends on `zod` only — open-clean.
- `@caisson/registry` (commercial, the service) MAY depend on `@caisson/registry-schema` (open) and
  re-export it — commercial→open is always allowed. No open package may import `@caisson/registry`.
- The module-manifest schema's license⟺tier rule (replacing the ADR-0050 dead `tier === "paid"`
  refine): `Apache-2.0 ⟺ oss` (no price), `LicenseRef-Caisson-Commercial ⟺ paid` (positive price).
- ADR-0094's monetization fence is unchanged: editions, the compliance primitives (`field-crypto`,
  `audit-worm`), the generator (`cli`), the registry _service_, and updates stay commercial.

Scheduled as W1 (its own PR + verify). Evidence: `packages/credits/src/credits.ts:8`,
`packages/mcp-server/src/server.ts:29-35`, `registry/schema/*` (zod/fs-only),
`registry/schema/module-manifest.ts:32` (`SPDX_LICENSES` was commercial-only),
`knowledge/decisions/ADR-0094-open-core-base-apache2.md` (the boundary this resolves).
