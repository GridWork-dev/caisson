# ADR-0406 — The launch gate: truth-fixes + four receipts + rails, with the wedge tripwire arming at launch

- **Date:** 2026-08-09
- **Status:** Accepted (operator locks at the D1–D15 board fork-walk — D1/D2/D3/D6/D7/D10/D13/
  D14/D15 dispositions consolidated; full row-by-row record in
  `outputs/audit/2026-07-board/WALK-CAPTURE.md`)
- **Parent:** ADR-0040 (compliance-wedge hero, now held **as hypothesis**) · ADR-0082 (artifacts
  true-to-built floor) · ADR-0390/0391 (the 2026-07-26 partial re-walk locks this walk builds
  on) · the board report `outputs/audit/2026-07-board/BOARD-REPORT.md`
- **Supersedes:** ADR-0391 §D15 in part — outreach now waits for the FULL gate below, not the
  four receipts alone; the written cost-to-serve bar deliverable carries over unchanged

## Context

The 2026-07 board audit found two still-public falsifiable claims (verified still true
2026-08-09: the docs' `bunx @caisson-sh/cli@latest` command fails — `@caisson-sh/cli` is not on
npm, the publish leg has never fired; and the pay path runs Paddle sandbox), four missing
security/proof receipts, and unwired instrumentation — while outreach pressure (five drafted
design-partner emails against a one-shot 30/10/5 prospect pool) pushed toward sending anyway.
The operator disposed of all of it as one coherent gate at the 2026-08-09 walk.

## Decision

**One launch gate.** A designated launch push must clear ALL of:

1. **Truth-fixes (D1, deferred to launch by operator pick — a recorded divergence from the
   board's "fix this week"):** the npm publish leg fires so the documented install command
   works anonymously; the Paddle production flip lands. Until then the site stays public
   (D3) with both claims standing — accepted, operator-owned risk.
2. **The four executable receipts (D10):** COMPLIANCE-mode WORM proof · deployed-pooler RLS
   attestation · split-brain recovery proof · KMS-backed signing. T2's file:line reads get
   promoted to auditable evidence items with repro steps; receipts 3–4 require second-source
   verification.
3. **Rails + instrumentation + cost bar (D15):** payment rails dated (or Paddle-as-MoR shown
   to need no Mercury-first) · send-log, `/partners` events, checkout, and exposure-date
   instrumentation wired · the support/security-response/auditor-assistance tail priced, with
   a support-boundary condition attached before "one paid partner" is a pass bar.

**Sequenced on the gate:**

- **The five design-partner emails (D2) send only after the full gate clears** — the
  DIS-T2/DIS-T3 preconditions plus receipts, by operator pick (stricter than the board's
  send-after-D1).
- **The wedge persists as a testable thesis (D6), tripwire VERBATIM:** "zero paid partners at
  day 30 stops further product spend and reopens the wedge or pivot board." **The 30-day clock
  arms when the gate clears and outreach fires** — recorded so the tripwire cannot be gamed by
  never launching: the gate itself is tracked work, not an indefinite hold.
- **The instrument design is ADR-0391's three instruments, which STAND** (kept at the
  2026-08-09 conflict re-ask): D13's economic-buyer map runs first (3–5 economic buyers or
  procurement actors, no developer-only panel) · the commercial leg, relabeled per ADR-0404 ·
  public developer distribution with its own denominator. All run at launch.
- **D14 (auditor acceptance of the WORM evidence pack — the thesis's single point of failure,
  zero evidence today) runs at launch**; per ADR-0391 §D15 it remains a REVENUE precondition —
  no revenue claim counts before an auditor accepts the pack.

## Consequences

- Same-walk companion dispositions, recorded here for the chain: D4 → ADR-0403 (price lock),
  D5 → ADR-0404 (labeling, superseding ADR-0391 §D5), D8 → ADR-0405 (seller plane), D9
  reopened → the 2026-08 consolidation audit lane, D11 → a legal re-verification pass on the
  live Article 50 page (published per ADR-0390/0391 in the `/writing` collection) before its
  row closes, D12 → executing now as the message-match site sitting.
- ADR-0040's hero frame is explicitly a **hypothesis under test**, not a validation claim,
  until the tripwire window closes with a paid partner.
- CAISSON-179 (npm publish leg) graduates from standalone follow-up to launch-gate item 1.
- The launch checklist lives against this ADR; each gate item lands with its own evidence
  (receipts under `outputs/audit/`, instrumentation in-tree, rails dated in the deploy/state
  docs).
