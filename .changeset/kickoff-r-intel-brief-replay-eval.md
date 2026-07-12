---
"@caisson/service-intel": patch
---

Add a judged replay eval lane for the intel daemon's briefs (CAISSON-101). An operator-run recorder
(`src/eval/record.cli.ts`) captures a sanitized cassette per watcher to the pinned path
`services/intel/__cassettes__/<watcher>.json` — request/response exchanges, the watch_state read, the
findings produced, and one embedded LLM verdict per finding — behind a fail-closed scrub gate that
throws if any secret value survives the write. A replay harness re-runs the REAL watcher code against
a cassette with zero network and zero tokens and grades a HYBRID rubric: accuracy + grounding
deterministically in code, and actionability from the cassette's replayed judge verdicts. Two pooled
`defineEval` runs (deterministic at threshold 1.0, judged at 0.7, both with a 0.6 Wilson floor for the
small session-4 sample) gate against a committed baseline via `@caisson/ai-evals`, joined to the turbo
`eval` task. The lane self-skips with zero cassettes, so it stays green until an operator records and
blesses a baseline post-merge. Private package only; no publishable release.
