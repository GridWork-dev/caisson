# ADR-0369 — Dependency/toolchain monitoring rework

**Status:** accepted · 2026-07-19 (late-night picker, operator-locked). Retires the
`toolchain-advisory` weekly GitHub Actions lane (ADR-0340 §advisory mechanism) in favor of a
bump-gated PR check; extends the intel daemon (ADR-0286) with a seventh watcher. Append-only;
supersede with a later ADR, never edit.
**Tags:** (none — CI + internal tooling surface; REVIEW-only at SHIP).

## Context

Two separate gaps in how the repo watches its own dependency/toolchain state:

1. The weekly `toolchain-advisory` lane measured tsc-6-vs-native-7 agreement for the PF2-1
   cutover decision. ADR-0368 executed that cutover in full — every lane now compiles through
   `tscn`. The lane's cutover purpose is gone; its `.d.ts` byte-equivalence measurement is still
   worth keeping, but as a narrower, bump-scoped gate rather than a perpetual weekly job that
   compiles the whole catalog twice for no decision left to inform.
2. Nothing watches this repo's OWN dependency posture — stalled Renovate PRs, available major
   bumps, the exact-pinned `better-auth` session-adapter lockstep, or bun/tsc-native releases —
   the way `services/intel`'s other watchers watch competitors, GitHub traction, and compliance
   frameworks. That signal currently only surfaces if a human happens to look.

## Decision

| Fork                           | Lock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **toolchain-advisory lane**    | **RETIRE the weekly measurement job**, keep the declaration-diff capability as a **bump-gated PR check**: `.github/workflows/tsc-native-dts-drift.yml` fires only when a PR touches `tooling/tsconfig/package.json` (i.e. bumps the `tsc-native` pin), byte-diffs every `packages/*` package's `.d.ts` output under the base branch's pin vs the PR's pin, and FAILS on any drift — the buyer-era `.d.ts` stability gate now lands at the moment a bump actually happens, not on a perpetual schedule with nothing left to decide. `tooling/scripts/dts-drift-check.ts` reuses `tsgo-agreement.ts`'s discovery + byte-diff primitives. |
| **dep/toolchain monitor home** | Lives in the **intel daemon** as a new weekly `dep-digest` watcher (`services/intel/src/watchers/dep-digest.ts`), not a new standalone service or GitHub Actions lane — it is exactly the same shape as the existing `github`/`compliance` watchers (deterministic detection, watch_state dedup, Postgres findings), and reuses the daemon's already-provisioned GitHub/npm egress and alerting wiring instead of standing up a second credentialed surface.                                                                                                                                                                           |
| **Alert routing**              | Findings route through the **existing Linear-draft alert path** (`buildAlertChannels` + `deliverImmediate`, the same sink `error-triage.ts` uses) rather than a bespoke CI-comment mechanism. Rationale: a Linear API key in a GitHub Actions job is a second, harder-to-audit credential surface for the same capability the daemon already holds; the daemon's existing `LINEAR_API_KEY`/`LINEAR_TEAM_ID` env + alerting pipeline is the one audited home for "file a Linear issue from an automated signal."                                                                                                                        |
| **Build posture**              | **Build now**, not spec-then-park — this is bounded, low-risk internal tooling (no money/auth/external-system tag), and the toolchain-advisory retirement leaves an immediate small gap (nothing currently gates a tsc-native bump) that the replacement check closes in the same change.                                                                                                                                                                                                                                                                                                                                              |
| **Buyer-impact scope**         | **Direct deps only, v1.** `dep-digest`'s buyer-impact-lite leg maps a flagged dependency to the `packages/*` manifests that DIRECTLY declare it; a transitive resolver is real work with little added weekly-digest value and is explicitly out of scope until a real need surfaces.                                                                                                                                                                                                                                                                                                                                                   |
| **Renovate alias fix**         | `renovate.json`'s `typescript v7 (tsgo) is blocked...` rule moves from `matchPackageNames: ["typescript"]` to `matchDepNames: ["typescript"]` — since the ADR-0368 cutover, `tooling/tsconfig/package.json`'s `tsc-native` alias (`npm:typescript@7.0.2`) resolves to `packageName: "typescript"` too, so the package-name-scoped rule was silently freezing the native compiler pin it was never meant to touch. Dep-name scoping narrows the `<7.0.0` constraint back to the API dependency alone; `tsc-native` bumps freely and trips the new drift-check PR gate instead.                                                          |

## Consequences

- `.github/workflows/toolchain-advisory.yml` is deleted; its git history remains the record of
  the retired lane's mechanism (idiom recoverable for a future advisory-lane need).
- A `tsc-native` bump now gets exactly one signal — a PR-scoped byte-drift check — instead of a
  standing weekly job whose decision it was built for has already been made.
- The intel daemon grows an eighth `FINDING_SOURCES` member (`dep-digest`) and a seventh cadence
  knob (`INTEL_CADENCE_DEP_DIGEST_MS`, default 7 days); no schema migration — `intel.findings.source`
  is plain `text`, not an enum, at the database layer.
- A quiet week (nothing flagged, no stalled PRs) emits zero findings and sends zero Linear
  traffic — the same "no signal, no noise" contract every other watcher in this daemon holds.
- ADR ceiling moves to 0369.
