# ADR-0236 — Ask-AI question-text capture: store with consent notice

**Status:** accepted · 2026-07-03 (fifth picker round). Locks the follow-up fork ADR-0234 F6
deliberately split out (counts-only telemetry shipped day one; text capture deferred to its own
consented decision). **Extends ADR-0234** (F6 Plausible counts stay as-is); relates ADR-0118
(Plausible) and the privacy posture in `apps/site` legal copy. **This pick is an operator
OVERRIDE of the tabled recommendation** (defer). Append-only; supersede with a later ADR,
never edit.
**Tags:** `ai`, `frontend`, `security`.

## Decision

- **Capture question TEXT server-side, with a visible consent notice in the widget.** Questions
  (never answers, never session identity beyond the existing lane flag) are stored for product
  insight — what prospects actually ask is the highest-signal roadmap input the site produces.
- **Disclosure:** the widget carries a one-line notice ("Questions are stored to improve the
  product — don't include secrets or personal data") visible before first submit, plus the same
  line in the site privacy copy. No dark-pattern burying.
- **Scope of the record:** `{day, lane, question_text, answered|escalated}` — no IP, no user id,
  no answer text, no Turnstile token. Anonymous by construction, not by scrubbing.
- **Retention:** 90-day rolling window enforced by the same daily-maintenance path that rolls the
  `ask_ai_spend` rows; a delete is a hard `DELETE`, not a soft flag.
- **Plausible counts (ADR-0234 F6) are unchanged** — text lives only in the site Postgres, never
  in the analytics sink.

## Consequences

- Build (small, rides the next site PR): one `ask_ai_question` table + migration, an insert in
  the `/api/ask` handler after Turnstile passes, the widget notice line, a privacy-copy
  paragraph, and the 90-day retention delete.
- Mining the corpus (clustering what prospects ask → docs/roadmap gaps) is a
  `gw-product-insights` job once volume exists — no build now.
- If a GDPR/CCPA deletion request ever names a question, the anonymous-by-construction shape is
  the defense: there is nothing to correlate a request to; the notice tells users not to submit
  personal data.
