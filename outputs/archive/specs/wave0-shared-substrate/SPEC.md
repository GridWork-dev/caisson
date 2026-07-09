# SPEC — Wave 0: shared substrate

Act 1 (SPEC) of the 7-act cycle for the Wave-0 shared-substrate build. Source brief:
`outputs/kickoffs/wave0-shared-substrate.md`. Bound by the ADRs cited there (do not relitigate).

## Goal

Build the **shared substrate that gates the four parallel Wave-1 editions**: the floor every
edition stands on, shipped green through the existing `tooling/` standards gate so Wave 1 can
start editions in isolated worktrees without re-deriving any of it. Nothing here is edition
feature code.

## Tags

`security` · `secrets` · `external-system` (the KMS adapter seam) · `infra` (the CI index-rebuild
job). Drives the SHIP-time conditional audits: **SECURITY audit** fires (security/secrets/
external-system); **infra review** for the CI job. No `ui`/`frontend`/`ai` surface in Wave 0.

## Deliverables (WHAT)

1. **`@caisson/field-crypto`** — per-tenant key derivation (HKDF-SHA256 per ADR-0043) + an
   `AeadCipher`-seamed authenticated field cipher + a versioned self-describing ciphertext envelope
   - a key-version rotation registry + a Drizzle `customType` encrypted column + the `FieldKeyProvider`
     port (`DerivedKeyProvider` default + a documented, test-doubled `KmsKeyProvider`). The encryption
     boundary **equals** the RLS tenant boundary (ADR-0005). Cross-tenant-isolation integration test +
     envelope golden fixture are mandatory before any consuming logic.
2. **registry runtime** — a CI-only `scripts/build-index.ts` that deterministically rebuilds
   `registry/index.json` from a git-tracked `registry/ledger.jsonl` version ledger; a
   `loadRegistryIndexFromFile` parse-or-throw read path; the **`@stack`→`@caisson` regex fix** (the
   blocking bug: `module-manifest.ts:47` + `registry-index.ts:9` reject every real `@caisson/...` id)
   - the stale comment at `checks.ts:185`; a CI `registry-index` job that fails on any byte-drift
     between the committed index and a fresh rebuild (proves the file is CI-built); golden fixture for
     the built index.
3. **`@caisson/cli` + generator skeleton** — `generate.ts` validates **every** module id+version
   against the registry allowlist (`assertKnownModule`/`assertKnownVersion`) **before any path or
   subprocess**; `meter.ts` debits a codegen credit (`credits.debit`, `eventType: "codegen_debit"`,
   caller `idempotencyKey`) **before any file is written** (debit-before-spend, 402 aborts with
   nothing written, retry absorbed); `cli.ts` entry (arg-parse + Zod `.strict()`). The full P5
   generation/MCP drive is OUT of scope — only the allowlist gate + debit seam + idempotency contract
   are real and tested now.
4. **kernel primitives** in `@caisson/kernel` — `audit-chain.ts` (SHA-256 append-only chain with a
   load-bearing canonical serialization; `chainEntry` + `verifyChain` → boolean + first-broken-index)
   - `versioning.ts` (append-only `supersedes_id` chain + a derived `current` predicate; pure, no
     mutation). Unit tests + two golden fixtures. Reused verbatim by the Compliance edition (ADR-0006).

## Forks → ADR declarations

Six forks (brief §"Forks to resolve FIRST") are put to the operator via `AskUserQuestion` BEFORE the
code each gates. New locked forks become append-only ADRs from **ADR-0045** + a board row:

| Fork | Decision                               | Likely artifact                                                    |
| ---- | -------------------------------------- | ------------------------------------------------------------------ |
| 1    | Field-crypto AEAD cipher               | **ADR-0045** (new)                                                 |
| 2    | Ciphertext envelope / serialization    | **ADR-0046** (new)                                                 |
| 3    | HKDF salt management                   | confirms ADR-0043 → board note (new ADR only if operator deviates) |
| 4    | Registry-runtime read-path shape       | **ADR (new)**                                                      |
| 5    | Generator engine                       | **ADR (new)**                                                      |
| 6    | Codegen credit-debit integration point | **ADR (new)**                                                      |

ADR numbers are allocated sequentially (0045, 0046, …) at lock time, in fork order, skipping Fork 3
if it confirms ADR-0043. No locked ADR is edited; supersede only.

## Out of scope / firewall

No edition feature code (no `audit-worm`/evidence-pack/AI-Kit/local-ai/agent-dev). No full P5
generation or MCP wiring or topological backfill — only the seams. No live cloud calls in CI (KMS is
typed + test-doubled). No registry read service/Worker unless Fork 4-B. No DEPLOY — SHIP stops at the
merged PR. Pro-private firewall: nothing from `media-pipeline` seeds anything; rebuild-clean, public
`tessera` is the only reference.

## Exit gate

Per brief §"Exit gate": `bun install` clean; `bun run gate`/`bun run check` green; `bun test` green
incl. the cross-tenant isolation test, the meter integration test, the audit-chain break-detection
test, the `@caisson`-parses/`@stack`-rejected test; all golden fixtures matched with `BLESS` unset;
the index rebuild is byte-identical; the generator rejects an unknown id+version before any
path/subprocess; each new locked fork has an ADR (from 0045) + a board row; PR open + CI green; no
service restarted.
