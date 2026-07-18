---
"@caisson/ai-kit": minor
"@caisson/ai-meter": patch
---

The AI kit gains `runToolLoop` — a bounded, governed agent tool loop. Each model step and
each tool execution reserves credits before it runs and settles to actuals after (the same
debit-before-spend ledger every gateway call uses), with a hard step ceiling, a caller-side
integer credit budget that fails the run closed when the next step cannot fit, and a full
append-only trajectory of the run (prompts, tool arguments, and results travel as content
digests, never bodies). Tools are executed by the loop itself between model steps, so a
declined reservation or an exhausted budget stops execution before any spend. The meter
now also accepts a zero output-token bound on reservations, which lets non-generating
actions take a zero-credit, cap-checked reservation.
