# ADR-0323 — Browser-audit remediation full wave + Cookiy-response locks

- **Status:** accepted
- **Date:** 2026-07-11
- **Decider:** operator (picker, four questions)
- **Grounds:** `outputs/browser-audit/2026-07-10-full-01/REPORT.md` (ADR-0322 lane, first full
  run — 7 findings, 16/20); the Cookiy 12-real-interview round 2026-07-10 (study
  `019f4a11-8029-7726-ab71-aef06ac4dcae`, report 2026-07-10T21:03Z; the ADR-0319 R-wave
  already shipped its four copy fixes — these locks cover the residuals)

## Context

PR #203 merged the Codex production browser-audit lane (ADR-0322) with its first full-run
evidence: four P1 accessibility/behavior defects and three P2s on the public surface, triaged
to Linear CAISSON-89/90/91. The same sitting reviewed the Cookiy real-interview residuals that
ADR-0319's copy wave did not consume. The operator ran a four-question picker.

## Decisions

1. **Remediation — FULL wave now (all 7 findings, one branch).** CAISSON-89 (homepage codecard
   zero-height · docs skip-link/landmark · marketplace compare WCAG 2.5.8 target size ·
   docs-search focus return) + CAISSON-90 (systemic 44px hit-area pass, invisible padding where
   the visual control stays compact) + CAISSON-91 (docs GitHub SVG accessible name · silent
   WebGL poster fallback) execute in this sitting as one `apps/site` wave: SHIP audit → merge →
   site redeploy. Over the "P1s-now/P2s-later" recommendation.
2. **Deterministic graduation — after fixes.** The four P1 clean replays graduate into
   deterministic Playwright tests in a **separately authored and reviewed change** once the fix
   wave lands (the ADR-0322 advisory→deterministic boundary, operator-approved here). The audit
   lane itself stays advisory.
3. **Rings 2/3 — provision probe profiles (operator act).** Distinct buyer + admin Codex
   Computer-Use profiles get provisioned by the operator; the next audit run executes the
   authenticated rings with reversible probe-account mutations per the ADR-0322 design. Until
   then the authed boundary stays covered by the deterministic suite + the ADR-0224 live
   harness, and Ring-2/3 rows stay `not-covered` (not passes).
4. **Cookiy response — all three residual arms.**
   - **Trust/copy wave (build now):** weeks-saved ROI framing on pricing (the buyers' own
     CFO pitch — qualitative, true-to-built, no fabricated numbers per ADR-0080) · renewal
     scope clarity (releases vs human support — extends the shipped R6 sentence) ·
     perpetual-ownership anti-lock-in foregrounded · a "why this price" trust signal for the
     too-cheap-to-be-true cluster.
   - **Architecture-fit diagram (build now):** a production-fit integration visual (how the
     modules land in an existing stack) on the marketing surface, brand floor per ADR-0078.
   - **Sandbox/demo — SPEC first:** the pre-purchase interactive environment (poke at real
     code, not a video) gets a spec with forks tabled; the build waits for its own operator
     lock per the spec-first cadence.

## Consequences

- Two build branches this sitting (remediation wave · Cookiy copy+diagram wave), worktree-
  isolated, merged serially through the in-session SHIP-audit lane; one `caisson-site`
  redeploy after both.
- A third, separately reviewed PR authors the four Playwright graduation tests after the fix
  wave merges (Decision 2).
- `outputs/specs/` gains the sandbox/demo spec (Decision 4c) — spec only, no product code.
- Probe-profile provisioning is an operator-owed row; the next audit run is three-ring.
- Linear: CAISSON-89/90/91 move In Progress → Done with the wave; the sandbox spec files a
  new issue at its lock.
