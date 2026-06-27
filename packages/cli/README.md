# @caisson/cli — create-caisson

The generator that composes a tailored repo from the versioned registry. ADR-0004 (generator) ·
ADR-0048 (engine) · ADR-0049 (codegen debit) · ADR-0021 (allowlist).

## Wave-0 scope (skeleton)

The **allowlist gate**, the **codegen debit-before-spend seam**, and the **idempotency contract**
are real and tested now. The full P5 generation drive (disk materialization + the buyer-MCP path) is
deliberately deferred — it plugs in behind the same seams.

- **`generate(index, raw)`** — Zod-`.strict()` selection → validate **every** module id + version
  against the registry allowlist (`assertKnownModule` / `assertKnownVersion`) **before any path or
  subprocess** → materialize a deterministic workspace skeleton (golden-fixtured). An unknown id or
  version throws before the engine runs.
- **`runGeneration(tx, deps, raw, meter)`** — the gated flow inside `withTenant`: validate → **debit
  before spend** (`meterGeneration` → `credits.debit`, `eventType: "codegen_debit"`) → write (P5
  seam). A short balance returns **402 with nothing written**; a retry with the same
  `idempotencyKey` debits once (ADR-0024).
- **`create-caisson` CLI** — `--name <slug> --edition <e> --module <id@version> …`; arg-parse + the
  same allowlist gate.

## Engine seam (ADR-0048)

The default engine is a deterministic in-repo template copy + typed token/JSON-merge (no network) —
the generated file SET for a fixed selection is the golden fixture. A ts-morph wiring pass can slot
in later behind the same `GeneratorEngine` interface.

## Tests

`bun test packages/cli/src` — `generate.test.ts` (allowlist gate throws before the engine; the
generated file set golden) + `meter.integration.test.ts` on PGlite inside `withTenant`
(debit-before-write; 402 aborts with nothing written; same-key retry debits once).

> Net-new (no seed). Pro-private `media-pipeline` contributes patterns only, never code.
