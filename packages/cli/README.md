# @caisson/cli — create-caisson

The generator that composes a tailored repo from the versioned registry.

## Usage

```
bunx @caisson-sh/cli@latest --name my-app --edition compliance --module @caisson/kernel@0.4.2 --out ./my-app
```

(`npx create-caisson@latest ...` also works as a secondary install path.)

Run `bunx @caisson-sh/cli@latest --help` for the full flag list (`--dry-run`, `--sample <id>`, etc.).

## Current scope

The **allowlist gate**, the **codegen debit-before-spend seam**, the **idempotency contract**, and
the **disk materialization** are all shipped and tested. The buyer-MCP generation path is not part
of this package yet.

- **`generate(index, raw)`** — Zod-`.strict()` selection → validate **every** module id + version
  against the registry allowlist (`assertKnownModule` / `assertKnownVersion`) **before any path or
  subprocess** → materialize a deterministic workspace skeleton (golden-fixtured). An unknown id or
  version throws before the engine runs.
- **`runGeneration(tx, deps, raw, meter)`** — the gated flow inside `withTenant`: validate → **debit
  before spend** (`meterGeneration` → `credits.debit`, `eventType: "codegen_debit"`) → write (the
  generation-write seam). A short balance returns **402 with nothing written**; a retry with the same
  `idempotencyKey` debits once.
- **`createFileSetWriter`** — writes the generated file set to disk atomically (temp dir + rename),
  rejecting any path that would escape the target directory.
- **`create-caisson` CLI** — `--name <slug> --edition <e> --module <id@version> …`; arg-parse, the
  same allowlist gate, then disk materialization via `createFileSetWriter`. `<e>` is one of the six
  bundle ids (`compliance`, `ai-production`, `local-first`, `agentic-dev`, `provenance`,
  `everything`) or a legacy edition id (`ai-kit`, `local-ai`, `agent-dev`) — legacy ids resolve to
  their bundle forever (ADR-0257).

## Engine seam (ADR-0048)

The default engine is a deterministic in-repo template copy + typed token/JSON-merge (no network) —
the generated file SET for a fixed selection is the golden fixture. A ts-morph wiring pass can slot
in later behind the same `GeneratorEngine` interface.

## Tests

`bun test packages/cli/src` — `generate.test.ts` (allowlist gate throws before the engine; the
generated file set golden) + `meter.integration.test.ts` on PGlite inside `withTenant`
(debit-before-write; 402 aborts with nothing written; same-key retry debits once).
