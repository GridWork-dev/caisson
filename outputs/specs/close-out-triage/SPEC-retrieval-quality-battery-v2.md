# SPEC — Retrieval quality battery v2 (the real verdict on the FTS + embed fixes)

**Status: DRAFT — operator lock required; this SPEC does NOT authorize building.** The 2026-07-10
retrieval fixes (FTS5 per-token sanitization `329150a8`, full-corpus embed via the deadline knob)
are DEPLOYED and the corpus is warm (489/489 chunks, cache persisting). What nobody has verified
is whether live hybrid ranking is now GOOD — the golden suite passes on the FTS floor, but the
first live probe ("how do I install a bundle", k=3) ranked compliance/agentic-dev bundle pages
above `getting-started.mdx`. Multi-leg fusion is confirmed firing (scores ~0.029 > the single-leg
ceiling 0.0167); ranking quality is the open question.

- **Surface:** `services/docs` (live `/query`), `services/support-bot` (the consumer),
  `packages/local-store` (only if a fusion-weight fix falls out).
- **Tags:** `ai` (fires EVAL at SHIP — this spec IS mostly an eval).

## Tasks

1. **Finish the interrupted k=5 probes** — the three remaining goldens against live `/query`;
   record rank positions of the expected page per question.
2. **Battery v2** — re-run the 25-question battery through the real Discord→bot→docs pipeline
   (the v1 brief lived in the J session scratchpad and is gone; reconstruct from the v1 battery's
   10 questions + the 6 goldens + new coverage: per-bundle installs, credits/licensing mechanics,
   MCP usage, refund/policy escalation paths). Score: grounded-correct / hedged / escalated /
   hallucinated, with confidence values from the new PostHog `support_answer` telemetry.
3. **Live-hybrid golden variant** — add a golden suite leg that hits the REAL fusion path (vec +
   FTS), not the FTS floor alone, so fusion-ranking regressions like the install-question miss
   fail CI instead of surfacing in production probes. Gate: expected page in top-k.
4. **Refund-policy corpus gap** — add a docs page carrying the 14-day policy (today it lives only
   on site legal pages; the bot correctly escalates but could answer). Only if the operator wants
   it answerable rather than escalated — see fork F1.
5. Verdict note: pass/fail per question, MEDIUM-band confidence calibration readout, and either
   "ranking acceptable" or a named fusion-weight follow-up.

## Operator forks (picker)

- **F1 — refund questions:** (a) keep escalating to a human (safe, current behavior — recommended
  pre-launch), or (b) add the policy page to the corpus and let the bot answer with citation.

## Verify

Battery report posted to #ops-alerts (v1 convention); the live-hybrid golden leg green in CI;
PostHog shows the battery's `support_answer` events with confidence distribution.

## Effort / value

S (half a day, mostly agent-run). Value: the actual quality verdict on the week's retrieval
work; converts "we fixed the pipeline" into "the bot answers correctly."
