# ADR-0340 — TypeScript bridge to 6.0.3 catalog-wide; native-7 cutover rides a measured ramp

Status: accepted · 2026-07-13 (Kickoff T platform session, tasks 5–6; version map re-derived per
the kickoff's post-audit banner)

The kickoff's TypeScript premise was doubly stale: the original task said "bridge → 6.0" off an
inverted version map, and the audit correction said "no stable 6.0 exists — 7.0.2 is GA". Live
re-derivation found BOTH half-right: typescript@latest = 7.0.2 IS the GA native Go compiler
(bin-only npm package — the classic JS compiler API is gone from the root import; a stable
programmatic API is a 7.1 item), AND stable 6.0.2/6.0.3 exist untagged (dist-tags point beta at
6.0.0-beta, latest at 7.x, which is why every dist-tags-only check missed them). 6.0.x is
Microsoft's explicit last-JS-codebase transition release, API-compatible with 5.9.

## Decision

1. **Catalog moves ^5.7.3 → ^6.0.3.** Two stragglers that had escaped the catalog (the root
   devDependency at ^5.6.3 — which silently hoisted tsc 5.9.3 over the catalog and made the
   first "green" check a mixed-version illusion — and apps/ai-kit at ^5.7.3) are folded back to
   `catalog:`. Non-catalog typescript pins are now a known hazard class: the bridge is only real
   when the hoisted binary matches the catalog.
2. **tooling/standards-gate pins typescript ^6.0.3 explicitly** (not `catalog:`) — its
   `ts.createScanner` usage must survive a future catalog move to 7.x until the 7.1 stable API
   lands and is evaluated.
3. **TS 6.0's new side-effect-import check (TS2882)** is kept ON. brand/ui-pro/demo-registry gain
   local `css.d.ts` ambient declarations for the `@caisson/ui`(+ui-pro) component sources their
   programs pull in (packages/ui already had one for itself).
4. **Generated-project templates fixed, buyer floor unchanged:** TS 6.0 exposed a REAL latent
   template bug — the shipped `golden.test.ts` imports `bun:test` with no `@types/bun` anywhere
   in the template, which only ever compiled because the monorepo's hoisted @types leaked into
   the composition exit-gate. Templates now declare explicit tsconfig `types` (base: bun; next:
   bun+node) + an `@types/bun` devDep; goldens re-blessed. The template `typescript` floor stays
   ^5.6.0 — raising the BUYER floor to 6.x is a deliberate later move, taken with a composition
   exit-gate run, not a side effect of this bridge.
5. **The native-7 cutover is instrumented, not scheduled:** the `toolchain-advisory` weekly lane
   (tooling/scripts/tsgo-agreement.ts) measures per-package agreement + wall-clock between tsc
   6.0.3 and native 7.0.2 (first live sample: agreement on kernel/auth, native ~9× faster), and
   byte-diffs packages/kernel's emitted .d.ts — **byte-equivalent declarations on sold packages
   is the cutover gate** (first sample: 1 of 33 kernel .d.ts files differs → not yet). Cutover
   is a future ADR once the lane's data supports it; the 7.1 stable API is the standards-gate's
   own gate.

## Consequences

Full `bun run check` green under uniform 6.0.3 (197/197 tasks + gate). The `ignoreDeprecations`
class of 6.0 warnings did not fire in this tree. Known follow-ups: the six packages with a second
`tsconfig.ui.json` project are outside the advisory lane's first cut (measure at the next bump);
apps/ai-kit's non-catalog eslint@^9 pin is pre-existing drift left for the dep-wave lane.
