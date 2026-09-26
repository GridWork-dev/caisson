# AGENTS — @caisson/agent-trajectory

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a producer (a governed run, an
adapter) or a consumer (an eval, a projection view) must know to record and read trajectories
correctly.

## Invariants (do not violate)

- **Append-only, gapless seq.** A run's events are `seq` `0, 1, 2, …` with no gaps and no rewrites.
  `append` is idempotent on `(runId, seq)` for a byte-identical event; a different event at a
  recorded seq, or a seq beyond the next slot, throws `ConflictError`.
- **Strict boundary.** Every event parses through the strict schema; an unknown envelope or payload
  key is rejected. Integer units only (tokens, credits, byte lengths) — never floats.
- **Sensitive bodies are `DigestRef` only.** Prompt text, tool args/results, run input/output, and
  checkpoint state are carried as `{ digest, byteLength, encRef? }` — never inlined. Never put raw
  content or key material on an event.
- **Usage honesty.** Stamp `billingStatus` truthfully: `metered` only when the counts reconcile with
  the credit ledger; `estimated` for real-but-unnormalized counts (`credits` = 0); `unsupported`
  when there is no validated usage contract (no token claims).
- **Replay is a pure projection.** `project` sorts by seq and folds; the same log always yields a
  byte-identical `RunProjection`. Do not fold in wall-clock or iteration-order dependence.
- **Two entry points.** `.` is the full node-capable surface; `./browser` is the browser-safe
  subset (contract, in-memory stores, projections, transcript adapter). A client bundle imports
  `./browser`, never `.` — the barrel carries the two Postgres stores. `src/browser.ts` is the
  single list of the shared half and `src/index.ts` re-exports it, so a name added there lands on
  both; a module joins `./browser` only if its whole graph passes the package's static
  source-graph walk (`src/browser-safety.test.ts`), and every `./browser` name must also exist on
  `.`.

## Producing events

Build the envelope, stamp `version` from `TRAJECTORY_VERSION`, `eventId` from `crypto.randomUUID()`,
and a monotonic `seq`, then `store.append(event)`. Reference any sensitive body by computing its
sha256 digest + byte length (and, where the bytes are persisted, an `encRef`) rather than inlining it.

## Consuming events

`store.read(runId)` returns events in seq order (a defensive copy). Pass them to `project()` for the
folded view, or scan the raw log. Adapters (e.g. `parseClaudeTranscript`) turn external transcripts
into `model.usage` events; treat their `billingStatus` as authoritative for trust.

## Out of scope (this slice)

No tool loop, no approval/durability engine, no PG store implementation (the shape is documented in
the README), no MCP/CLI exposure. This package is the trajectory
CONTRACT + the in-memory store + the deterministic projection + the first usage adapter.
