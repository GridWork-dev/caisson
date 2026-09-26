# Package catalog

Internal source-of-truth index for the **original 24** workspaces under `packages/` (kernel +
base substrate + edition + shared packages, as scoped at ADR-0082 §3). `packages/*` has since
grown to **54 dirs** — the 30 later additions (Stage-2/harvest waves, the W1/W7 catalog-rework
carves, `ui-pro`, `agent-runner`, etc.) are not catalogued here; see
[`docs/build-state.md`](build-state.md) for per-package status and
[`docs/state/package-catalog.md`](state/package-catalog.md) for license/sold-as/price.

**What remains live here:** the purpose + dependency-direction mapping for the 24 original
packages. The per-layer BUILT/STUB status tables (a 2026-06-28 snapshot, superseded and
four-edition-framed) are archived at
[`docs/archive/original-24-package-catalog-2026-06-28.md`](archive/original-24-package-catalog-2026-06-28.md).
Canonical sources stay authoritative:

- Architecture + package taxonomy: [`specs/01-architecture.md`](../specs/01-architecture.md), [`specs/00-product-spec.md`](../specs/00-product-spec.md)
- The decision record: [`knowledge/decisions/`](../knowledge/decisions/) (ADR-NNNN, append-only)
- Live decision board: [`docs/state/decisions-and-forks.md`](state/decisions-and-forks.md) (CLAUDE.md SoT #1)
- Build plan P0-P7: [`docs/archive/plan.md`](archive/plan.md)

On any conflict, the canonical source wins over this catalog.

## Dependency direction

Base substrate composes down, never up — an edition/bundle package may depend on base substrate
or shared packages, never the reverse ([`ADR-0003`](../knowledge/decisions/ADR-0003-composable-package-base-split.md)).
Shared/cross-edition packages (`cli`, `mcp-server`, `license-verify`, `ui`, `email`, `jobs`) are
composed by multiple bundles and never depend "up" on one.

Not in `packages/` (referenced as `@caisson-sh/*` deps, resolved from sibling workspaces
`tooling/*`, `registry`, `services/*`): `tooling/lint-policy` / `tooling/tsconfig` /
`tooling/testing` (the single standards gate, `ADR-0002`/`0022`), `tooling/standards-gate`
(dependency-cruiser boundary enforcement, `ADR-0022`/`0016`), `registry/` (`@caisson-sh/registry` —
CI-built index + allowlist + Worker read seam + publish ledger, `ADR-0021`/`0047`/`0071`).

`apps/*` and `services/*` are out of scope for this catalog; see
[`specs/01-architecture.md`](../specs/01-architecture.md).
