# ADR-0399 — @caisson/agent-usage folds into @caisson/agent-trajectory as a `/usage` subpath

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the 2026-08-09 ponytail-audit remediation picker)
- **Parent:** ADR-0349/0351 (agent-trajectory, the engine-neutral trajectory primitive) ·
  ADR-0271/0359 (module/version delist machinery, append-only)
- **Supersedes:** the 2026-07 board memo's KEEP-separate disposition
  (`outputs/audit/2026-07-board/memos/t4-memo.md`), re-litigated with the operator

## Context

`@caisson/agent-usage` is a 349-source-line package: a barrel re-exporting
`parseClaudeTranscript` verbatim from `@caisson/agent-trajectory`, price normalization on top
of it, an alias map, and a genuinely independent 193-line Codex-rollout JSONL parser. It is
indexed `sellable:false`, was never published (rider-3), sits in no bundle, and has zero
importers repo-wide. The July board memo voted KEEP-separate to avoid coupling a Codex adapter
into the engine-neutral package; the audit surfaced that the package has since accrued no
consumer, no publish, and no bundle seat — the separation is paying carrying cost for a
boundary nothing exercises.

## Decision

1. **Fold agent-usage into agent-trajectory as a dedicated `./usage` subpath entry** —
   `@caisson/agent-trajectory/usage` carries priceUsage, the alias map, and the Codex-rollout
   parser. The memo's engine-neutrality concern is answered structurally: the core `.` and
   `./browser` entries stay engine-neutral; engine-specific usage adapters live behind the
   subpath, never on the barrel.
2. **`packages/agent-usage` is deleted** after the fold; its tests move with the code.
3. **Registry handling follows the dissolved-meta pattern:** agent-usage was never published,
   so no delist row is needed — its `sellable:false` index entry and sidecar rows drop from the
   generated index at the next rebuild; `ledger.jsonl` history (none exists for it) is
   untouched.

## Consequences

- One fewer workspace, one fewer registry sidecar to carry through every consume.
- agent-trajectory's browser-safety walk must exclude the `/usage` subpath or prove it —
  the fold decides per the existing ADR-0396 walk discipline.
- A future standalone usage SKU would be a carve-out, not a resurrection.

## Rejected

- KEEP-separate (the memo's vote) — two more months produced zero consumers; the boundary
  protects nothing that a subpath cannot.
- Deleting the capability outright — the Codex parser and price normalization are real code
  with a plausible near-term consumer (trajectory pricing surfaces).
