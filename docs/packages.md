# Package catalog

`packages/*` is 48 independently versioned `@caisson-sh/*` packages, all Apache-2.0
(ADR-0428). This file used to carry a hand-maintained purpose table for the original 24
packages; that table is retired. Each package's own README is the source for what it is —
the one invariant worth stating separately here is the dependency-direction rule below.
Canonical sources stay authoritative:

- Architecture + package taxonomy: [`specs/01-architecture.md`](../specs/01-architecture.md), [`specs/00-product-spec.md`](../specs/00-product-spec.md)
- The decision record: [`knowledge/decisions/`](../knowledge/decisions/) (ADR-NNNN, append-only)

On any conflict, the canonical source wins over this catalog.

## Dependency direction

Base substrate composes down, never up — a bundle package may depend on base substrate or
shared packages, never the reverse ([`ADR-0003`](../knowledge/decisions/ADR-0003-composable-package-base-split.md)).
Shared/cross-bundle packages (`cli`, `mcp-server`, `ui`, `email`, `jobs`) are composed by
multiple bundles and never depend "up" on one.

Not in `packages/` (referenced as `@caisson-sh/*` deps, resolved from sibling workspaces
under `tooling/*`): `tooling/lint-policy` / `tooling/tsconfig` / `tooling/testing` (the
single standards gate, `ADR-0002`/`0022`), `tooling/standards-gate` (dependency-cruiser
boundary enforcement, `ADR-0022`/`0016`).

`apps/*` is out of scope for this catalog; see
[`specs/01-architecture.md`](../specs/01-architecture.md).
