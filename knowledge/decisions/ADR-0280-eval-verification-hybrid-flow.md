# ADR-0280 — Eval-license verification flow: hybrid scoring

**Status:** accepted · 2026-07-07 (operator-locked, fifth sitting — the design-memo picker
ADR-0279's sequencing lock required before the Track E2 build). Refines and supersedes-in-part
ADR-0274 §2. Append-only; supersede with a later ADR, never edit. **Tags:** `security`,
`billing`.

## Context

ADR-0274 §2 binds an anti-exfiltration floor for time-boxed source-eval licenses but not the
verification flow's operational shape. The eval-verification research memo
(`outputs/research/prelaunch-fanout-2026-07/followups/eval-verification-research-2026-07-07.md`)
produced three candidate flows (manual-first / hybrid scoring / scaled automation) and two
Paddle findings: there is no pure $0-authorization primitive (no Stripe-SetupIntent
equivalent), and the documented equivalent is a free-trial checkout with card-on-file (card
captured and validated, zero charge).

## Decision

**Option 2 — hybrid scoring.**

- **Pre-gate (automated, free):** MX check + domain-age check + disposable-email list on the
  applicant's work-email domain. Free-mail and disposable domains rejected outright
  (ADR-0274 floor).
- **Risk score:** domain age + optional enrichment lookup (~$0–50/mo API tier, operator may
  run without it). Three outcomes: obvious fakes **auto-reject**; low-risk **auto-approve**;
  borderline lands in the **operator review queue**.
- **Card leg:** Paddle free-trial checkout with card-on-file — card captured and validated,
  zero charge during the eval window. This SUPERSEDES ADR-0274's "$0 authorization" wording
  with the mechanism Paddle actually documents.
- **Card-fingerprint reuse alerts:** the same card fingerprint across nominally-different
  applicants within a window flags to the operator (multi-accounting signal).
- **Supersession note:** ADR-0274's "operator review queue (approved, not instant)" clause is
  narrowed — the queue holds borderline applicants only; scored low-risk applicants
  auto-approve. Every other floor element is unchanged and binding: one active eval per org
  domain + a global concurrent cap, per-eval source watermarking, no redistribution, standard
  deny-set on expiry/abuse, expansion through the fail-closed `expandEntitlements` boundary.
- **Thresholds as config** (ADR-0274): score cutoffs, domain-age minimum, caps, and window
  length are config values the operator tunes, never constants.

## Consequences

- Track E2 builds to this flow (fable on the license seam, builds LAST in the
  research-response wave per the SPEC sequencing).
- ~40–50 requests/day capacity without operator saturation; escalation to the memo's Option 3
  (device fingerprinting, ML scoring, scheduled watermark-leak sweeps) is a later,
  demand-driven ADR.
- The enrichment API is optional at launch: with it unset, borderline widens toward the
  review queue (fail-toward-manual, never fail-open).
