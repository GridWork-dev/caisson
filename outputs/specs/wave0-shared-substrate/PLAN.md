# PLAN — Wave 0: shared substrate

Act 2 (PLAN) for `outputs/specs/wave0-shared-substrate/SPEC.md`. Atomic tasks, one commit each,
dependency order. Every task lists its verify command(s); iterate to green before committing.

Build order rationale: kernel primitives are leaf (no new deps) → the `@stack`→`@caisson` regex fix
unblocks any real manifest (`@caisson/field-crypto` would not parse under the old regex) → field-crypto
(the largest) → registry runtime (builder/ledger/read-path/Worker seam/CI) → cli skeleton (depends on
the registry read path + credits). Threat model: §"Threat model" below (drives the SHIP SECURITY audit).

## Tasks

### T1 — kernel primitives (`packages/kernel`) · scope `kernel`

- `src/audit-chain.ts` — SHA-256 append-only chain. `canonicalize(payload)` = deterministic JSON
  (recursively sorted keys) so the hash is reproducible (load-bearing — documented + tested).
  `chainEntry(prevHash, payload)` → `{ seq, prevHash, payload, hash }` (genesis `prevHash = null`);
  `verifyChain(entries)` → `{ valid: boolean, brokenAt: number | null }` (first broken index).
  Hash = `sha256(prevHash ∥ canonicalize(payload))`.
- `src/versioning.ts` — append-only `supersedes_id` chain. Pure: `isCurrent(versions, id)` (current
  iff nothing supersedes it), `currentVersions(versions)`, `versionChain(versions, id)` (lineage).
  No mutation; a cycle/missing-parent throws (flag, never guess).
- Export both from `src/index.ts`. Tests `audit-chain.test.ts` (round-trip, tamper→brokenAt,
  reorder→brokenAt, canonical key-order independence) + `versioning.test.ts` (current predicate,
  supersede chain, cycle/dangling reject). Goldens `__golden__/audit-chain.json`,
  `__golden__/version-chain.json`.
- **Verify:** `bun test packages/kernel/src` green; `BLESS= bun test packages/kernel/src` (goldens
  matched unset).

### T2 — `@stack`→`@caisson` regex fix (blocking) · scope `registry`

- `registry/schema/module-manifest.ts:47` + `registry/schema/registry-index.ts:9`:
  `/^@stack\/[a-z0-9-]+$/` → `/^@caisson\/[a-z0-9-]+$/`. Fix the stale comment at
  `tooling/standards-gate/src/checks.ts:185` (`@stack deps` → `@caisson deps`).
- Add `registry/schema/module-id.test.ts`: a `@caisson/field-crypto` id parses; a `@stack/x` id is
  rejected by both `ModuleManifest` and `RegistryModuleEntry`/`assertKnownModule`.
- **Verify:** `bun test registry/schema` green; `bun run gate` still green; `index.example.json`
  validates (it already uses `@caisson/...` ids — was failing the old regex).

### T3 — field-crypto (`packages/field-crypto`) · scope `field-crypto` (2 commits)

**T3a — crypto core + provider + cipher + envelope + rotation registry + unit tests + envelope golden**

- `src/derive.ts` — `deriveTenantKey(masterKey, salt, keyVersion, tenantId)` via
  `crypto.hkdfSync("sha256", ikm, salt, info, 32)`; info string EXACTLY
  `"caisson-field-crypto:v" + keyVersion + ":" + tenantId` (ADR-0043). Master key never logged.
- `src/cipher.ts` — the `AeadCipher` seam + `AesGcmCipher` (AES-256-GCM via
  `createCipheriv("aes-256-gcm")`; fresh 12B CSPRNG IV per encrypt; `getAuthTag()`/`setAuthTag()`;
  AAD passed through). `encrypt(key, plaintext, aad)` / `decrypt(key, env, aad)`.
- `src/envelope.ts` — `serializeEnvelope`/`parseEnvelope` for
  `[ver 1B(0x01) | alg 1B | key_version u16 BE | nonce 12B | ct | tag 16B]`, base64↔Buffer; unknown
  ver/alg throws (ADR-0046).
- `src/provider.ts` — `FieldKeyProvider` port (`keyFor`/`currentVersion`) + `DerivedKeyProvider`
  (default; constructed from env `MASTER_FIELD_KEY`/`FIELD_CRYPTO_SALT` validated by Zod `.strict()`
  - the rotation registry for `currentVersion`).
- `src/registry.ts` — key-version rotation registry: current version per tenant; older versions stay
  derivable/decryptable; lazy-re-encrypt-on-next-write semantics documented.
- Tests `src/cipher.test.ts` (round-trip; tamper→auth-fail; AAD-mismatch→fail; wrong-key→fail),
  `src/derive.test.ts` (KAT: fixed master+salt+kv+tenant → fixed 32B hex; distinct tenants → distinct
  keys; distinct kv → distinct keys). Golden `src/__golden__/envelope.json` (parsed structure).
- **Verify:** `bun test packages/field-crypto/src/cipher.test.ts packages/field-crypto/src/derive.test.ts` green.

**T3b — Drizzle column + KMS adapter + cross-tenant isolation integration test + package wiring**

- `src/column.ts` — Drizzle `customType` encrypted column: `toDriver` encrypts+serializes (emits the
  base64 string — `toDriver` cannot return a raw SQL type), `fromDriver` parses+decrypts; bound to a
  tenant-key resolver (`FieldKeyProvider` + tenantId + column-context for AAD).
- `src/kms.ts` — `KmsKeyProvider` documented adapter (AWS KMS envelope: per-tenant DEK wrapped by a
  KEK; GCP/Azure/Vault drop-in seam). Test-doubled — no live AWS in CI; the network call is behind the
  port; envelope-tagging real.
- `src/index.ts` barrel; `manifest.ts` (`defineModule`, `kind: "primitive"`, `tier: "paid"`,
  `LicenseRef-Caisson-Commercial`, dep `@caisson/kernel`); `package.json` (deps `@caisson/kernel` +
  `drizzle-orm`; dev `@caisson/{tsconfig,eslint-config,testing}`), `tsconfig.json`, `eslint.config.js`,
  `AGENTS.md`, `README.md`.
- `src/isolation.integration.test.ts` — on PGlite, inside `withTenant` (`SET ROLE app`): two tenants
  → distinct derived keys; tenant B cannot decrypt tenant A's envelope (auth-fail); a v1 ciphertext
  still decrypts after the tenant rotates to v2.
- **Verify:** `bun test packages/field-crypto/src` green (incl. integration); `bun run gate` green
  (manifest↔package.json agreement); `bunx eslint packages/field-crypto` + depcruise green.

### T4 — registry runtime (`registry/` + `tooling/` + Worker seam + CI) · scope `registry` (2 commits)

**T4a — index builder + ledger + read path + built-index golden**

- `registry/ledger.jsonl` — git-tracked version ledger; seed with field-crypto + cli first gated
  entries (`{id, version, manifest, attestation, publishedAt}` per line). Deterministic.
- `registry/scripts/build-index.ts` — read the ledger → group by id → newest `latest` → validate each
  via `RegistryVersion`/`RegistryIndex` → write `registry/index.json` (stable key order, trailing
  newline). Deterministic (no `Date.now()`; timestamps come from the ledger).
- `registry/schema/registry-index.ts` — add `loadRegistryIndexFromFile(path)` (read + parse-or-throw,
  no cast).
- `registry/index.json` — the built artifact (committed; CI proves byte-identical rebuild).
- Golden `registry/scripts/__golden__/index.json` (or assert rebuild == committed in the test).
- Tests `registry/scripts/build-index.test.ts` (rebuild is deterministic + byte-identical;
  `loadRegistryIndexFromFile` parses the built file + throws on a malformed file).
- **Verify:** `bun registry/scripts/build-index.ts && git diff --exit-code registry/index.json`
  (byte-identical); `bun test registry` green.

**T4b — Worker read seam + CI registry-index job + docs**

- `registry/worker/handler.ts` — typed `fetch`-handler seam serving the parsed index (parse-or-throw);
  `// P6:` entitlement-filter hook (no logic); unit-tested as a plain function. `registry/worker/wrangler.toml`
  (config only, not deployed). `registry/worker/handler.test.ts`.
- `.github/workflows/ci.yml` — add a `registry-index` job: rebuild from the ledger and
  `git diff --exit-code registry/index.json` (fails on drift → proves CI-built).
- Update `registry/README.md` (`index.json` now built from `ledger.jsonl`; the Worker seam) +
  `SUMMARY.md` where claims change.
- **Verify:** `bun test registry/worker` green; the CI yaml parses (lint); README/SUMMARY accurate.

### T5 — cli skeleton (`packages/cli`) · scope `cli`

- `src/generate.ts` — `generate(selection, deps)`: validate every id+version
  (`assertKnownModule`/`assertKnownVersion`) + re-assert the slug regex **before any path/subprocess**;
  the in-repo template-copy + typed token/JSON-merge engine behind a `GeneratorEngine` seam (ADR-0048);
  returns the generated file set (golden-fixtured). The full P5 materialize is a documented seam.
- `src/meter.ts` — `meterGeneration(tx, { accountId, idempotencyKey, amount })` → `credits.debit({…
eventType: "codegen_debit", idempotencyKey })` **before** any write; a `Generation` record interface.
- `src/cli.ts` — `create-caisson` entry: arg parse + Zod `.strict()` selection validation. Skeleton —
  wires generate+meter but the agent/MCP drive is P5.
- `src/index.ts` barrel; `manifest.ts` (`defineModule`, `kind: "base"` — the generator is base
  infra, not an edition; justify in the manifest description), `package.json` (deps `@caisson/kernel`,
  `@caisson/credits`, `@caisson/tenancy-rls`, the registry schema), configs, `AGENTS.md`, `README.md`.
- Tests `src/generate.test.ts` (golden-fixtures the generated file SET for a fixed selection;
  asserts an unknown id AND an unknown version each throw BEFORE any path/fs/subprocess — assert via a
  spy/`fs` not-called), `src/meter.integration.test.ts` (PGlite + `withTenant`: debit fires before any
  write; same-key retry debits once; short balance → 402 with nothing written).
- **Verify:** `bun test packages/cli/src` green; `bun run gate` green; eslint + depcruise green.

### T6 — full-repo green + VERIFY/SWEEP/SHIP

- **Verify:** `bun install` clean; `bun run check` green; `bun test` green repo-wide; all goldens
  matched `BLESS` unset; `bun registry/scripts/build-index.ts && git diff --exit-code registry/index.json`.

## Threat model (drives the SHIP SECURITY audit — tags security/secrets/external-system/infra)

| #   | Threat                                        | Mitigation (asserted in code/test)                                                         |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| TM1 | Cross-tenant decrypt (shared key)             | per-tenant HKDF keys (ADR-0043); isolation integration test proves B can't decrypt A       |
| TM2 | Ciphertext moved between rows/tenants/columns | AAD binds `tenant_id∥key_version∥column-context`; AAD-mismatch decrypt throws              |
| TM3 | GCM nonce reuse → catastrophic                | fresh 12B CSPRNG IV per encrypt; never derived from plaintext; per-tenant key bounds 2^32  |
| TM4 | Master key leak via logs/egress               | `MASTER_FIELD_KEY` read once, never logged; Zod-validated; not in any embedding path       |
| TM5 | Path traversal via module id/version          | `assertKnownModule`/`assertKnownVersion` + slug re-assert BEFORE any path/subprocess       |
| TM6 | Ungated/hand-edited registry index            | index is CI-built from the ledger; byte-identical-rebuild CI job; CODEOWNERS on index.json |
| TM7 | Generate-without-paying (runaway loop)        | debit-before-spend; 402 aborts with nothing written; same-key retry debits once            |
| TM8 | Tamper of a locked version/audit entry        | SHA-256 chain `verifyChain` returns `brokenAt`; canonical serialization reproducible       |
| TM9 | KMS adapter leaks DEK/KEK or calls live in CI | network behind the `FieldKeyProvider` port; test-doubled; envelope-tagging real            |

## Done-when

The SPEC §"Exit gate" — all green, run-and-read evidence, PR open + CI green, no service restarted.
