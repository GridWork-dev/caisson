# ADR-0230 — WORM retention-mode launch posture: GOVERNANCE now, COMPLIANCE at launch

**Status:** accepted · 2026-07-03 (fourth picker round, operator-locked). Extends **ADR-0201**
(live S3 WORM proof — bucket `caisson-worm`, Object Lock at creation) and **ADR-0202**
(extend-only, chain-evidenced GOVERNANCE→COMPLIANCE retention escalation); keeps the **ADR-0051**
invariant (never COMPLIANCE in local/test). Resolves the residual flagged in
`docs/state/launch-runbook.md` §7 (the DEPLOY block's live anchors landed under GOVERNANCE).
Append-only; supersede with a later ADR, never edit.
**Tags:** `security`, `infra`.

## Context

The 2026-07-03 DEPLOY block live-verified the admin mutation surface's WORM anchors in
`caisson-worm` under Object-Lock **GOVERNANCE** (RetainUntilDate 2033). GOVERNANCE is
operator-overridable (`s3:BypassGovernanceRetention`); COMPLIANCE is not — stronger evidence, but
irreversible on live objects and hostile to pre-launch iteration (a mistaken anchor under
COMPLIANCE is unremovable until 2033). The mode question was left open at the DEPLOY.

## Decision

- **Pre-launch (now): GOVERNANCE stays the live default.** Iteration safety wins while Paddle is
  sandbox and anchors may be re-cut.
- **At launch (the commerce flip): escalate to COMPLIANCE** for launch-forward anchors via the
  ADR-0202 gated, extend-only, chain-evidenced escalation path — an explicit operator DEPLOY act
  in the launch runbook, never inside an autonomous cycle.
- Pre-launch GOVERNANCE-era anchors are NOT retro-escalated by default; the launch escalation
  applies from the flip forward (0202's extend-only invariant — escalation may be applied to
  existing objects only through the gated path, case by case).
- Local/test remain never-COMPLIANCE (ADR-0051).

## Consequences

- `docs/state/launch-runbook.md` gains a launch-gate line: "WORM mode flip GOVERNANCE→COMPLIANCE
  (ADR-0230)" alongside the Paddle production flip.
- Buyer-facing compliance copy may claim COMPLIANCE-mode WORM only for post-launch evidence;
  pre-launch anchors are honestly GOVERNANCE.
