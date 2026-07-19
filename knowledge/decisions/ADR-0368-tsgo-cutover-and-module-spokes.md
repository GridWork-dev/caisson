# ADR-0368 — Native TypeScript 7 cutover (full swap) + the 13 module-spoke wave

**Status:** accepted · 2026-07-19 (night picker round, operator-locked). Executes and
supersedes the ADR-0340 measured ramp: the cutover fires NOW under a pre-launch operator
override of the byte-equivalence gate. Extends ADR-0237 F2 (module depth pages) to the full
sold catalog. Append-only; supersede with a later ADR, never edit.
**Tags:** (none — toolchain + marketing surface; REVIEW-only at SHIP).

## Context

The full-catalog measurement (2026-07-19, operator-directed): **63/63 packages agree** on
type-checking with zero diagnostics drift; aggregate tsc wall time **60.3s → 8.7s (7.0×)**.
Declaration emit: 22 packages byte-identical, 16 differ only in `.d.ts.map` sourcemaps, 18
differ in ~25 real `.d.ts` files — every diff verified to be the same cosmetic class
(member ordering inside inferred Zod object types; zero API changes; spot-proven on kernel
and agent-kernel). `typescript-eslint` and gate tooling consume the TypeScript JS API,
which the native compiler does not ship. ADR-0340 gated cutover on byte-equivalent
declarations across sold packages; the operator overrode: pre-launch, no buyers and no
public code, so a one-time declaration reorder is acceptable.

## Decision

| Fork               | Lock                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Swap scope**     | **Full swap.** Every package `check`/`build`/declaration-emit lane invokes the native TypeScript 7.0.2 binary. `typescript@6.0.3` stays installed solely for JS-API consumers (typescript-eslint, gate tooling); no lane invokes its `tsc` bin anymore. Generator **templates keep plain `tsc`** — buyer projects compile with their own toolchain.                                                                                                                    |
| **Mechanism**      | `@caisson/tsconfig` (already a devDep of every package) grows a `tscn` bin — a bun launcher resolving the `tsc-native` alias (`npm:typescript@7.0.2`, bin-only publish, per-platform binaries via optionalDependencies). Package scripts swap `tsc -p` → `tscn -p` (63 files). No PATH/bin-collision reliance: the launcher resolves the aliased package explicitly.                                                                                                   |
| **Churn handling** | **Accept as the new baseline.** The reordered declarations ship as-is; the follow-up consume ride re-versions the lock-sensitive packages once. No annotate-first pass.                                                                                                                                                                                                                                                                                                |
| **Module spokes**  | **All 13 missing depth pages ship**: agent-trajectory · tool-exec · org-controls · compliance-core · billing-orchestration · ui-pro · local-inference · local-privacy · local-sync · frameworks-pack · signing-primitive · compliance-updates (entitlement-only SKU — artifact grounds in the real registry-worker updates-window enforcement) · credits. Authored via the Fork-B adversarial workflow (opus skeptics on compliance/money seams); lands as its own PR. |

## Consequences

- CI `check`/`build` lanes and local gates drop ~52s of aggregate compile wall time per run.
- Shipped `.d.ts` bytes change in 18 packages (+16 sourcemap-only); the next consume ride
  re-versions affected sold packages under the sibling-churn/lockHash mechanics.
- The weekly `toolchain-advisory` measurement lane loses its cutover purpose; it may be
  retired or repurposed (drift watch) at the next dep wave — not in this change.
- MODULE_PAGES grows 12 → 25 records; every sold standalone id then carries a depth page.
- ADR ceiling moves to 0368.
