# @caisson-sh/agent-trajectory

The engine-neutral **trajectory contract** — one append-only, replayable event schema every governed
agent run records into: `run → step → model call → tool proposal → approval → tool result →
checkpoint`. This package is the observation substrate the ai-kit gateway and the agent-runner CLI
emit into; the bounded tool loop that produces the events rides a later slice.

This README is the contract RFC. The rules below are binding on every producer and consumer.

## Entry points

- `.` — the full surface, node-capable: everything below plus the two Postgres-backed stores
  (`createPgTrajectoryStore`, `createPgRunStateStore`), which reach a `pg` driver, tenant RLS, and
  field encryption.
- `./browser` — the browser-safe subset, importable inside a client bundle: the strict event
  schema, the in-memory append-only store, the run-state port with its in-memory implementation,
  both deterministic projections, and the Claude-transcript adapter. Every name on `./browser` is
  also on `.`.

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

- `metered` — the numbers **are** the credit ledger's stored settlement for the call (the ai-kit
  gateway path). `credits` is always the reconciled actuals; the token integers are
  provider-reported when the provider reported usage, and the ledger's reservation-shaped estimate
  when it did not (the gateway settles that case at the estimate rather than refunding — the tokens
  were consumed either way). Billing-grade.
- `priced` — pricebook-computed integer credits attached to real adapter-extracted counts
  (ADR-0360 U-4). A **cost statement, never a charge**: the credits are computed against a price
  book and are never ledger-settled. `metered` stays the only ledger-truth band. Provenance is
  carried in `priceBookVersion` — only valid on `priced` events (schema-enforced), and optional
  even there per the U-4 lock; the price-normalizing producer always stamps it.
- `estimated` — real counts from a trusted adapter (e.g. a Claude Code transcript) but **not
  price-normalized**, so **not** billing-grade; `credits` is `0`.
- `unsupported` — the surface has **no validated usage contract**; no token claims are made.

A producer must not stamp `metered` unless the event carries exactly what the ledger settled and
charged — never an independent claim. The schema enforces the credit invariant: `credits > 0` is
only legal on `metered`/`priced`; `estimated`/`unsupported` events carry `credits: 0`.

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
