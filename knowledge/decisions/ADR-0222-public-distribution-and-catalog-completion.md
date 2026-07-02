# ADR-0222 — public distribution: caisson-sh org, @caisson-sh npm scope, catalog completion

**Status:** accepted · 2026-07-02 (operator picker + operator org action, same day).
**Relates:** ADR-0094/0097/0136 (the open-core split this distributes) · ADR-0069 (GitHub-Packages
publish, unchanged) · ADR-0106/0012 (operator-owned pricing — the two numbers below are its
exercise) · ADR-0111 (publish-readiness flip) · `docs/state/public-surface.md` (the surface map).

## Context

The open-core set (15 Apache-2.0 packages) has no public distribution surface: nothing is on
public npmjs, `publish.yml` targets GitHub Packages only (and carries no npmjs credential), and
the monorepo is private. Verified 2026-07-02 with the operator's npm login: the npm name
**`caisson` is taken by an existing third-party user** (owns bare `caisson@0.1.3`), so the
`@caisson` scope is unavailable; the operator owns the npm org **`caisson-sh`**.

## Decision (operator-locked)

1. **GitHub home = the `caisson-sh` org.** The operator created the org (managed by GridWork-dev)
   and transferred the private monorepo to `caisson-sh/caisson` (2026-07-02). Redirects cover the
   old path; runner registrations survived (fleet verified green post-transfer). GitHub App
   installations did NOT transfer — Greptile (and any other org apps) must be reinstalled on the
   new org before critical-path PRs can pass the gate.
2. **Public npm scope = `@caisson-sh/*`, locked now** (over petitioning npm for the squatted name,
   over skipping npmjs). In-repo package names stay `@caisson/*`; the **public mirror export
   renames at export time** (package names + cross-deps + import specifiers). Registry
   entitlement/module ids (`@caisson/<slug>` strings in registry data) are PRODUCT ids, not npm
   names — they do not rename.
3. **npmjs publishing is owned by the public mirror repo**, not `publish.yml` — the monorepo
   pipeline stays GitHub-Packages-only per ADR-0069 (it has no npmjs credential by design; the
   half-wired `publishConfig.registry: npmjs` fields in open packages are superseded by the
   mirror-owned path).
4. **Catalog completion (sandbox parity):** all 14 à-la-carte module SKUs created in Paddle
   sandbox at the committed display prices; plus two operator-priced additions — the **credit
   pack at $49** (5,000 credits) and **agent-runner listed at $49** as the 15th marketplace
   module (consistent with its registry `priceCents: 4900`). Its absence from the agent-dev
   edition's frozen members map remains the members-fold republish item's scope.

## Rejected

- **Petition npm + defer publishing** — the recommended option; the operator chose immediate
  npm presence under the owned scope over weeks of name-dispute latency.
- **Skipping npmjs entirely** — loses the largest open-source acquisition funnel.
- **Renaming in-repo packages to `@caisson-sh/*`** — the brand/product namespace stays
  `@caisson`; only the public npm artifact names differ.
