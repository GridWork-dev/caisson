# ADR-0405 — The Python seller plane stays: docs-RAG + support-bot kept, Python frozen at two islands

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the D1–D15 board fork-walk, D8 — the walk's one
  no-board-pick row, preserved as a live operator split)
- **Parent:** confirms ADR-0009 · ADR-0096 · ADR-0105 · ADR-0206 (the seller-plane ADR chain
  the rejected horn would have superseded by name)

## Context

Board D8 preserved a real dissent unaveraged: T1 argued the seller plane (`services/docs`
docs-RAG + `services/support-bot`, both live on Railway) is deliberate reckless debt — scale
both to zero, superseding ADR-0009/0096/0105/0206 by name, preserving only llms.txt and a
health-safe unavailable state (kill-cost ~7k LOC + the eval suite). T4 argued keep both, with
Python frozen at exactly these two islands. The board declined to pick; the operator picked
2026-08-09.

## Decision

**T4's horn: both services stay live and maintained.** The confirmed ADR chain stands. Freeze
rider: **Python is frozen at exactly these two islands** — no third Python service, package, or
surface enters the repo without a superseding ADR. Maintenance (dep waves over `uv.lock`,
eval-suite upkeep, deploy legs) continues as normal work.

## Consequences

- The 2026-08 consolidation audit (board D9, reopened the same walk) carries this as a hard
  out-of-scope: seller-plane kill/merge proposals are pre-rejected.
- T1's horn stays reversible-by-design in history: if a future ADR supersedes this one, its
  named-supersession move (ADR-0009/0096/0105/0206 by name) is the template.
- The docs-RAG golden harness and support-bot eval suite remain load-bearing CI surfaces —
  freezing the island count does not freeze their quality gates.
