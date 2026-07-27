---
phase: field-crypto-kms-async
project: caisson
spec: outputs/specs/field-crypto-kms-async/SPEC.md
created: 2026-07-25
status: accepted
---

# Plan — Field-crypto KMS async

Operator acceptance is carried by `KMS-BRIEF.txt`: execute the locked SPEC end to end, resolve the
one open design question, and open one unmerged PR.

## Task 1: Lock the request-scoped async boundary

**SPEC:** “The one open design question” and “Runbook + arming”.

**Files:**

- Create: `knowledge/decisions/ADR-0389-request-scoped-prefetch-all-kms-context.md`
- Modify: `CLAUDE.md`
- Modify: `docs/adr-index.md`
- Modify: `docs/state/decisions-and-forks.md`
- Modify: `docs/build-state.md`

**Steps:**

1. Record option 1: context bind reads the current version and unwraps every version from `1..current`.
2. Record the linear KMS-call/latency cost, the rejection of option 2, and why option 3 is deferred.
3. Bind production callers through a helper that zeroizes every prefetched `Buffer` in `finally`;
   retaining a plaintext DEK process-wide remains forbidden.
4. Record first-seal provisioning and append-only conflict handling for concurrent first seals.
5. Advance the ADR ceiling from 0387 to 0389 in all four enforced surfaces and reconcile the
   build-state header.

**Verify:**

```bash
bun run sot
# expected: ADR ceiling/index/frontmatter checks GREEN; branch-hygiene may report parallel-wave DRIFT
```

**Depends on:** none

## Task 2: Add a disposable all-versions KMS context

**SPEC:** “The seam”, scope items 4–5, and the three named negative/invariant tests.

**Files:**

- Modify: `packages/field-crypto/src/column.ts`
- Modify: `packages/field-crypto/src/column.test.ts`
- Modify: `packages/field-crypto/src/kms.ts`
- Modify: `packages/field-crypto/src/kms.test.ts`
- Modify: `packages/field-crypto/src/index.ts`

**Steps:**

1. Add this public shape beside `derivedContext()`:

```ts
export interface DisposableFieldCryptoContext extends FieldCryptoContext {
  dispose(): void;
}

export async function kmsContext(
  provider: FieldKeyProvider,
  tenantId: string,
): Promise<DisposableFieldCryptoContext>;

export async function withKmsFieldCryptoContext<T>(
  provider: FieldKeyProvider,
  tenantId: string,
  fn: (ctx: FieldCryptoContext) => Promise<T> | T,
): Promise<T>;
```

2. Resolve `currentVersion()` once, unwrap every historical version with `Promise.allSettled`, and
   zero every successful buffer if any unwrap fails.
3. Make `dispose()` idempotently `fill(0)` every stored buffer, clear the map, and reject later key
   access. Run it from `withKmsFieldCryptoContext()` in `finally`.
4. Add `ensureProvisioned()` to `KmsKeyProvider`: use an existing current version or attempt version
   1; on an append-only concurrent conflict, re-read the winner instead of overwriting it.
5. RED then GREEN tests for historical-version reads after rotation, unwrap failure with no fallback,
   partial-prefetch cleanup, post-scope zeroization, and concurrent first provisioning.

**Verify:**

```bash
bun test packages/field-crypto/src/column.test.ts packages/field-crypto/src/kms.test.ts
# expected: 0 fail
```

**Depends on:** task 1

## Task 3: Make Azure production configuration fail closed

**SPEC:** scope item 2.

**Files:**

- Modify: `packages/field-crypto/src/kms-azure.ts`
- Modify: `packages/field-crypto/src/kms-azure.test.ts`
- Modify: `packages/field-crypto/src/kms-conformance.test.ts`
- Create: `apps/site/lib/field-crypto-kms.ts`
- Create: `apps/site/lib/field-crypto-kms.test.ts`
- Modify: `apps/site/package.json`
- Modify: `bun.lock`

**Steps:**

1. Add `@azure/identity` and direct `@azure/keyvault-keys` dependencies to the site.
2. Strictly parse only these production variables:

```ts
{
  AZURE_KEY_VAULT_URL: z.string().url().refine((url) => new URL(url).protocol === "https:"),
  AZURE_KEY_VAULT_KEY_NAME: z.string().regex(/^[0-9A-Za-z-]+$/),
  AZURE_KEY_VAULT_WRAP_ALGORITHM: z.literal("RSA-OAEP-256"),
  AZURE_KEY_VAULT_PURGE_PROTECTION: z.literal("enabled"),
}
```

3. Construct `DefaultAzureCredential`, `KeyClient`, and per-key `CryptographyClient` instances, then
   call `createAzureKeyVaultKmsClient()` with purge protection enabled.
4. Reject any production configuration that does not explicitly require purge protection; never
   fall back to the derived provider or demo vector after KMS configuration begins.
5. RED then GREEN tests for strict env parsing, HTTPS-only vault URLs, required purge protection,
   fixed wrap algorithm, injected client construction, and KMS error propagation.

**Verify:**

```bash
bun test packages/field-crypto/src/kms-azure.test.ts packages/field-crypto/src/kms-conformance.test.ts apps/site/lib/field-crypto-kms.test.ts
# expected: 0 fail
```

**Depends on:** task 2

## Task 4: Persist wrapped DEKs in the site database

**SPEC:** scope items 3 and 5.

**Files:**

- Create: `packages/field-crypto/src/schema.ts`
- Create: `packages/field-crypto/src/schema.test.ts`
- Modify: `packages/field-crypto/src/index.ts`
- Modify: `apps/site/lib/site-migrations.ts`
- Modify: `apps/site/lib/site-migrations.test.ts`
- Modify: `packages/field-crypto/src/store.pg.integration.test.ts`

**Steps:**

1. Export the final append-only/RLS field-key schema as `FIELD_CRYPTO_KEY_SCHEMA_SQL`, preserving the
   shipped `0001` + `0002` semantics without editing either published SQL file.
2. Append `0032_field_crypto_keys.sql` to the site-local migration chain and its positional-ledger
   golden; do not re-slot an existing migration.
3. Use the existing `PgWrappedKeyStore` as the real production home behind `KmsKeyProvider`.
4. RED then GREEN PGlite/Postgres tests for table presence, RLS isolation, immutable same-version
   wrapped keys, historical versions, and concurrent version-1 conflict behavior.

**Verify:**

```bash
bun test packages/field-crypto/src/schema.test.ts packages/field-crypto/src/store.pg.integration.test.ts apps/site/lib/site-migrations.test.ts --concurrency=1
# expected: 0 fail
```

**Depends on:** task 2

## Task 5: Rewire site BYOK to KMS at first seal

**SPEC:** scope items 1, 4, and 5.

**Files:**

- Modify: `apps/site/lib/byok.ts`
- Modify: `apps/site/lib/byok.test.ts`

**Steps:**

1. Remove the production `SyncFieldKeyProvider` singleton and construct a request-local
   `KmsKeyProvider` from the HMR-safe Azure KMS client plus the tenant transaction’s
   `PgWrappedKeyStore`.
2. On the first validated seal, call `ensureProvisioned(accountId)`, bind
   `withKmsFieldCryptoContext()`, write the encrypted credential and metadata in the same tenant
   transaction, then zeroize the context in `finally`.
3. Keep the labelled deterministic derived provider only when `NODE_ENV !== "production"` so
   `bun dev` and `bun test` remain zero-config.
4. RED then GREEN tests for KMS round trip, first-seal provisioning, historical read after rotation,
   unwrap failure fail-closed, no demo fallback in production, and plaintext zeroization.

**Verify:**

```bash
bun test apps/site/lib/byok.test.ts --concurrency=1
# expected: 0 fail
```

**Depends on:** tasks 3 and 4

## Task 6: Move ai-kit MCP run tools to an async context factory

**SPEC:** scope item 1.

**Files:**

- Modify: `packages/ai-kit/src/mcp-run-tools.ts`
- Modify: `packages/ai-kit/src/agent-runtime-demo.test.ts`
- Add or modify: `packages/ai-kit/src/mcp-run-tools.test.ts`

**Steps:**

1. Replace `RunToolsDeps.keyProvider: SyncFieldKeyProvider` with:

```ts
readonly fieldCryptoContext: (
  accountId: string,
  fn: (ctx: FieldCryptoContext) => Promise<T>,
) => Promise<T>;
```

using a non-generic exported callback interface if TypeScript requires method syntax. 2. Make store construction async and execute the complete `runStart`/`runStatus` callback within
the supplied request-scoped context lifetime. 3. Keep existing derived-provider tests via a small `withFieldCryptoContext(derivedContext(...))`
adapter and add a KMS-backed test proving context disposal after each callback.

**Verify:**

```bash
bun test packages/ai-kit/src/mcp-run-tools.test.ts packages/ai-kit/src/agent-runtime-demo.test.ts
# expected: 0 fail
```

**Depends on:** task 2

## Task 7: Reconcile arming documentation and release metadata

**SPEC:** scope item 6 and package-delivery requirements.

**Files:**

- Modify: `docs/ops/launch-runbook.md`
- Modify: `apps/site/railway.toml`
- Modify: `packages/field-crypto/AGENTS.md`
- Modify: `packages/field-crypto/README.md`
- Modify: `apps/site/content/docs/provenance/field-crypto.mdx`
- Create: `.changeset/<generated-name>.md`

**Steps:**

1. Replace the production derived-pair boot blocker with the Azure vault URL, key name, wrap
   algorithm, purge-protection sentinel, and service-auth variables while preserving the “clean
   boot, first buyer throws” warning and no-arming-record status.
2. Keep derived-key documentation explicitly scoped to dev/test and self-hosting buyers.
3. Add release notes for `@caisson/field-crypto`, `@caisson/ai-kit`, and `@caisson/site`; changeset
   prose contains no ADR citations.

**Verify:**

```bash
bun run gate
# expected: exit 0
```

**Depends on:** tasks 3–6

## Task 8: Full verification, review, and one-PR publish

**SPEC:** “Verification”.

**Files:**

- Modify only files required by findings from the three full-diff reviews.

**Steps:**

1. Run the named conformance/golden suites and every root gate, capturing complete real output.
2. Run code review, security audit, and adversarial self-review over `origin/main...HEAD` plus the
   working diff; fix every verified finding and rerun affected checks.
3. Run `gw handoff write --act EXECUTE` before the VERIFY act, then perform a goal-backward audit
   against every SPEC/brief item.
4. Commit each task with a plain-ASCII conventional subject, push
   `feature/field-crypto-kms-async`, and open exactly one unmerged PR.

**Verify:**

```bash
bun run gate
bun run check
bun run format:check
bun run sot
bash tools/security/scan.sh --layer ci
# expected: all exit 0; semgrep scans roughly 3,969 real files and prints every per-layer verdict
```

**Depends on:** tasks 1–7
