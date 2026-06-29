# ADR-0099 — Deterministic design-quality gates (staged) + advisory critic ledger

**Status:** accepted · 2026-06-29 (design-system-harden track — operator lock, picker round F5).
**Relates:** ADR-0016 (CI/CD + the standards gate), ADR-0062 (eval regression-vs-baseline gate precedent),
ADR-0022 (import-boundary lint gates), ADR-0097 (the recipe these gates enforce), ADR-0098 (tokens these
gates check). **Adopts the mechanism of** `outputs/research/wardfile-frontend-playbook.md` §quality (the
three-layer separation). Evidence: the 2026-06-29 grounding of the gate surfaces
(`outputs/kickoffs/design-marketing-rebuild.md` F5).

## Context

Caisson has **zero** design-quality gates today. The only "contrast test" is a hand-transcribed ~6-pair
spot-check, **duplicated and drifted** across `apps/site/lib/contrast.ts` and `apps/studio/src/lib/
contrast.ts` — itself an instance of the copy-paste a copy-guard would catch — with token values typed in
by hand from `tokens.css` (so it silently drifts from the generated source). `bun run gate`
(`packages/kernel/src/gate.ts`) is **structural workspace-conformance only** (extends configs / has
scripts / `@caisson/`-scoped / registry golden+stamp) — no design content. A second gate
(`tooling/standards-gate/src/checks.ts`, CI-only) does AGPL/down-only/license/manifest checks. Neither has a
design remit. The playbook's three-layer model (human doctrine ADRs / **deterministic blocking** CI gates /
**advisory** ledgered critic) is the target.
(`packages/kernel/src/gate.ts:18-198`; `apps/site/lib/contrast.test.ts:7-64`;
`tooling/standards-gate/src/checks.ts:51-216`; `turbo.json:3-8`.)

## Decision

Wire **all six** deterministic gates, **staged** cheapest-first, into the existing pipeline; keep the
advisory critic strictly **non-blocking**. Each gate lands in the home that fits its mechanism (they do
**not** all live in one place):

| #   | Gate                          | What it checks                                                                                                                               | Home / wiring                                                                                                                                                                            |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Token-drift** (cheapest)    | committed `styles/tokens.css` byte-matches `gen:tokens` output                                                                               | a dedicated **CI job** cloning the existing registry-index pattern (`bun run gen:tokens && git diff --exit-code packages/ui/styles/tokens.css`) — needs git state, can't be a turbo test |
| 2   | **Full contrast matrix**      | WCAG AA over **every** legitimate token pair (text 4.5:1 / non-text 3.0:1) in **both** modes, derived from the token object (not hand-typed) | a **`packages/ui` test** (runs under `turbo test`); **replaces + deletes** the two duplicated `apps/*` contrast tests                                                                    |
| 3   | **Anti-slop AST guard**       | bans house AI-slop tells + raw hex / arbitrary color / inline-style in kit code (the recipe demands `var(--cs-*)` only)                      | a flat-config block in **`tooling/eslint-config`** (mirrors the existing `boundaries.js` no-restricted-imports precedent) → every package's `lint`                                       |
| 4   | **TS-compiler copy-guard**    | flags identical non-test modules across packages (parses with the TS compiler)                                                               | a new check in **`tooling/standards-gate/src/checks.ts`** (CI via `cli.ts`)                                                                                                              |
| 5   | **Breakpoint guard**          | every `@media` width is a rung on the ADR-0098 rem ladder                                                                                    | a **`packages/ui` (or apps/site) test** under `turbo test`                                                                                                                               |
| 6   | **axe both-modes + overflow** | browser a11y in dark+light + no horizontal overflow (boundingRect, not `scrollWidth`)                                                        | runs as the **SHIP a11y audit**, **not** inside `bun run check` (operator lock) — needs `axe-core` + a browser harness over the static export                                            |

**Advisory critic (Layer 3, never blocks):** a `gw-frontend-designer`-style pass scores surfaces on the
40-pt Nielsen rubric; findings flow into a **stable-ID `findings.toml`** ledger (id =
`sha256(workflow ∷ surface ∷ normalized-title)`, status `open|accepted|fixed`) with a `reconcile()` step
classifying each run new/regressed/closed/unchanged — so rewording never forks a finding and a
fixed-then-reappearing issue flips to `regressed`. It informs, it does not gate.

**axe placement (operator lock):** gates 1–5 are pure-node/cheap and join `bun run check` (via `turbo
test` + the two CI jobs); **axe is the one heavy gate** (new browser deps + a static-export-served harness)
and runs at SHIP as this track's a11y audit, keeping `bun run check` fast.

## Rejected

- **Put every gate in one home** — the mechanisms differ (eslint AST vs turbo test vs git-state diff vs CI
  copy-guard vs browser axe); forcing one home would break caching/sandboxing. Rejected for per-mechanism
  placement.
- **Wire axe into `bun run check`** — would pull a browser harness + new deps into the default dev loop and
  slow every run; operator chose axe-at-SHIP.
- **Keep the hand-copied contrast spot-check** — it drifts from the generated tokens and duplicates across
  apps; replaced by the derived matrix (gate 2) and deleted.
- **Block on the critic's rubric score** — the band swings ±6 run-to-run; a non-deterministic score must
  never gate. Advisory only.

## Binding

- All six gates are wired, staged cheapest-first (token-drift → contrast-matrix → anti-slop → copy-guard →
  breakpoint → axe).
- Gates 1–5 are **blocking** in `bun run check` / CI; **axe (gate 6) runs at SHIP**, not in `bun run check`.
- The derived contrast matrix lives in `packages/ui` and **replaces + deletes** the two duplicated
  `apps/site` + `apps/studio` contrast tests.
- The advisory critic + `findings.toml` ledger is **non-blocking**; a rubric score never gates a merge.
- Gates land across `tooling/eslint-config`, `tooling/standards-gate`, `packages/ui` tests, and dedicated CI
  jobs — not one monolithic gate.

Implementation in Phase 1 of the harden track; exit = `bun run check` green incl. gates 1–5, axe green at
SHIP.
