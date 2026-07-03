---
"@caisson/ai-evals": minor
---

Eval runs, eval-spend ledger entries, and reflexivity-queue captures now read their timestamp
from an injected `Clock` (`systemClock` by default) instead of reading the system clock directly.
New exports: `Clock`, `systemClock`, `fixedClock`, `sequencedClock`. `defineEval`'s result also
carries a `ranAt` timestamp.

Practically, this means a historical backtest can replay a past eval run through the exact same
code that runs live evals today, just by supplying a fixed or sequenced point in time — no
separate "replay mode" to keep in sync with the real thing, and no risk of a backtest silently
drifting from live behavior over time.
