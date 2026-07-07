# ADR-0274 — Evaluation access: generator demo mode + verified time-boxed eval licenses

**Status:** accepted · 2026-07-07 (operator-locked, fourth picker round — "both", with a
binding verification rider). Grounded in the Cookiy deep analysis (trial/sandbox volunteered
as the de-risker in ~11/40; integration mismatch is the deadliest objection, ~6 lived
walk-aways). Append-only; supersede with a later ADR, never edit. **Tags:** `billing`,
`security`, `auth`.

## Context

Buyers want to prove stack fit before paying; the strongest product answer is evaluation
access. But the delivery IS the product — commercial TypeScript source — so a naive trial is
a source-exfiltration hole. The operator's rider is binding: eval access must verify a
legitimate buyer, not just an email that wants the source.

## Decision

Two staged evaluation surfaces:

1. **Generator demo mode** (cheap, immediate): `create-caisson --demo` generates against the
   full catalog with demo stubs/watermarks for commercial modules — runnable scaffolding, not
   the licensed source. No license-service change; never licensable for production.
2. **Time-boxed eval license** (the real lever): a new **eval grant kind** in the license
   service — non-renewing, short window (~14 days), fail-closed expiry, revocable, and
   delivering **watermarked source** marked not-for-production.

**Anti-exfiltration verification floor (the rider, binding on the eval grant):**

- **Identity:** verified work email on a company domain (no free-mail); domain-level
  rate-limit (one active eval per org domain; a global concurrent-eval cap).
- **Legitimacy:** card-on-file with a $0 authorization (identity + friction, no charge), and
  an operator **review queue** — evals are approved, not instant, at least until launch
  volume justifies automation.
- **Traceability:** per-eval watermarking of the delivered source (buyer-identifying marks in
  the tarball), eval grants excluded from redistribution rights, and the standard revocation
  deny-set applies immediately on expiry/abuse.
- **Scope:** eval entitlements expand through the same fail-closed `expandEntitlements`
  boundary; an expired/revoked eval degrades to the free base floor everywhere, like any
  other grant.

## Consequences

- Demo mode ships first (generator work only); the eval grant kind is a license-seam change
  and takes the full SHIP-audit lane (fable on the seam) with its own SPEC covering the
  verification flow, watermarking mechanics, and abuse handling.
- The site's trial-path framing (ADR-0272 §3) upgrades to a real "request an evaluation"
  surface when the eval grant lands.
- Verification thresholds (window length, domain rules, queue SLAs) stay operator-tunable
  config, not code constants.
