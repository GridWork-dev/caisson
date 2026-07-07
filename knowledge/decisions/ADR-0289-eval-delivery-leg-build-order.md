# ADR-0289 — Eval-license delivery leg: full-wave build, watermark-before-issuance order

**Status:** accepted · 2026-07-07 (operator-locked, ninth-sitting picker). Refines ADR-0274
(evaluation access + the binding anti-exfiltration rider) and ADR-0280 (eval verification flow).
Builds on the E2 slice (PR #156) that shipped the hybrid scorer + the signed `eval` claim
discriminator. Append-only; supersede with a later ADR, never edit. **Tags:** `security`,
`billing`, `ai`.

## Context

PR #156 shipped verified-eval scoring and the `eval:true` signed-claim discriminator, but left
issuance fail-closed dark: no route sets `card_validated`, so `/eval/issue` always 409s. The
pieces that make eval licensing actually issue — the Paddle card-validation callback, the admin
review queue, and per-eval tarball watermarking — are unbuilt. The fable audit of PR #156 set a
binding order: because an eval token grants real `tier:pro` delivery within its window,
per-eval source watermarking (the ADR-0274 rider) MUST be keyable and live BEFORE issuance flips
on. The E2 discriminator now makes it keyable. The design-partner program (ADR-0273) and
evaluation-access GTM (ADR-0274) are dead levers until this leg lands.

## Decision

Build the delivery leg as ONE next wave, in this fail-closed order:

1. **Watermarking first (the hard constraint).** The registry/npm delivery layer keys on the
   signed `eval` claim to apply per-eval buyer-identifying marks in the delivered tarball
   (the ADR-0274 rider). Issuance stays 409-dark until this is live and tested.
2. **Card-validation callback.** The Paddle card-authorization callback sets `card_validated`
   (the gate `/eval/issue` already checks) — a real payment-instrument check, no charge.
3. **Admin review queue.** The `apps/admin` surface wires `decideEvalReview` /
   `markEvalCardValidated` / `revokeEval` (store primitives already shipped + tested in E2) so
   borderline applications route to an operator decision.
4. Issuance flips live only at the end, once 1–3 are green and watermarking is proven.

The eval→session binding on the future `apps/site` proxy (flagged in E2 as server-to-server
trust today) is bound in this wave when that surface lands.

## Consequences

- SPEC before code: `outputs/specs/eval-delivery/SPEC.md` locks the watermark scheme, the
  card-callback contract, and the review-queue state machine; the build follows it.
- Sequenced AFTER the admin OAuth (ADR-0283) + catalog (ADR-0284) merges drain and the admin
  intel page (ADR-0286 §4) — the review queue is a fourth `apps/admin` surface; no parallel
  writer on that app.
- Rejected: watermark-only-now (leaves the eval funnel closed indefinitely) and
  defer-whole-leg-post-launch (costs the design-partner/eval funnel in exactly its design window).
