# @caisson/agent-trajectory

The engine-neutral **trajectory contract** — one append-only, replayable event schema every governed
agent run records into: `run → step → model call → tool proposal → approval → tool result →
checkpoint`. This package is the observation substrate the ai-kit gateway and the agent-runner CLI
emit into; the bounded tool loop that produces the events rides a later slice.

This README is the contract RFC. The rules below are binding on every producer and consumer.

## The event envelope

Every event is a strict object:

```ts
{
  eventId: string;   // crypto.randomUUID()
  runId: string;     // the run this event belongs to
  seq: number;       // monotonic, 0-based, gapless per run
  version: number;   // contract version, starts at 1 (TRAJECTORY_VERSION)
  occurredAt: string; // ISO-8601
  kind: EventKind;   // one of the eleven below
  payload: …;        // shape pinned by `kind` (a discriminated union)
}
```

Zod `.strict()` at every boundary — an unknown envelope OR payload key is a `ValidationError`. All
money/credit/token/byte units are **integers** (never floats, ADR-0007).

### The eleven kinds

`run.started` · `run.finished` · `step.started` · `step.finished` · `model.call` · `model.usage` ·
`tool.proposed` · `tool.approved` · `tool.denied` · `tool.result` · `checkpoint`.

## Ordering & idempotency

- `seq` is a **monotonic 0-based integer per run** with **no gaps**. The first event of a run is
  `seq: 0`; each subsequent event is the previous `seq + 1`.
- `append(event)` is **idempotent on `(runId, seq)`**: re-appending a byte-identical event at an
  already-recorded seq is a no-op (a safe retry after a dropped ack — exactly-once callers stay
  correct).
- **Append-only is enforced.** A different event at an already-recorded seq is a **rewrite** and is
  rejected (`ConflictError`); a seq beyond the next expected slot is a **gap** and is rejected.

## Payload field classification (AR-4, binding)

Two classes of field, and only two:

- **Normalized metadata — inline.** Ids, provider/model strings, statuses, actors, integer token and
  credit counts, `billingStatus`, depths, labels, `byteLength`, `exitCode`, `ok`. Safe to persist,
  replay, and anchor.
- **Sensitive body — `DigestRef` only, never inlined.** Prompt text, tool argument bodies, tool
  result bodies, run input/output, checkpoint state. Each is carried ONLY as
  `{ digest: <sha256-hex>, byteLength, encRef? }` — a content-address, a size, and an optional opaque
  pointer to where the encrypted bytes live. **The trajectory carries no raw content and no key
  material.** A consumer that needs a body resolves the `encRef` out of band.

The fields that MUST be a `DigestRef`: `run.started.input`, `run.finished.output`,
`model.call.prompt`, `tool.proposed.args`, `tool.result.result`, `checkpoint.state`.

## Usage honesty — `billingStatus` (AR-3)

Every `model.usage` event declares how much to trust its numbers:

- `metered` — the numbers **are** the credit ledger's (the ai-kit gateway path). Billing-grade.
- `estimated` — real counts from a trusted adapter (e.g. a Claude Code transcript) but **not
  price-normalized**, so **not** billing-grade; `credits` is `0`.
- `unsupported` — the surface has **no validated usage contract**; no token claims are made.

A producer must not stamp `metered` unless the counts reconcile against the ledger.

## Replay = deterministic projection

`project(events) -> RunProjection` folds a log to its canonical view: `status`, the step tree
(children under parents, per-step status), usage totals per `billingStatus` band, and checkpoints.
The fold **sorts by `seq` first**, so the SAME events yield a **byte-identical** projection regardless
of arrival order (out-of-order stream delivery resolves to one canonical result). It is a pure
function of the log — never of wall-clock or map-iteration order. This is the shape evals score and
the audit chain can anchor.

## Store port

```ts
interface TrajectoryStore {
  append(event: TrajectoryEvent): Promise<void>; // idempotent on (runId, seq); rejects gaps/rewrites
  read(runId: string): Promise<TrajectoryEvent[]>; // seq order, a defensive copy
}
```

`createMemoryTrajectoryStore()` is the in-memory implementation (tests + single-process runs). The
**PG-backed implementation is documented here, not built in this slice**: it mirrors ai-meter's
append-only `usage_event` table — a `(run_id, seq)` UNIQUE makes `append` idempotent, `REVOKE UPDATE,
DELETE` makes it append-only at the database, and it is FORCE-RLS tenant-isolated like every other
row store. The port is the seam so the ai-kit gateway and the agent-runner record into either.

## Adapters

`parseClaudeTranscript(jsonl, { runId })` — the first AR-3 usage adapter. It reads Claude Code JSONL
transcript lines (ccusage-style) and emits one `model.usage` event per usage-bearing assistant turn
(main and subagent alike) with the real token counts and model id, `billingStatus: 'estimated'`. A
malformed line — invalid JSON, or a turn with no usage — is **skipped and counted, never thrown**.
Counts are estimated, not billing-grade, until a price-normalization pass lands.

## Tests

`bun test packages/agent-trajectory/src` — schema round-trip + unknown-field rejection, append-only
enforcement (idempotent duplicate, gap rejected, rewrite rejected), projection determinism under
shuffled arrival, and the transcript parser (subagent counting + malformed-line skipping).
