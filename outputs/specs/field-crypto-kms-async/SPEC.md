---
status: locked (ready to build)
owner: operator
---

# SPEC — Field-crypto on Azure Key Vault: moving the production key path off `SyncFieldKeyProvider`

- **Repo:** caisson · **Tags:** `security`, `auth`, `external-system` · **Status:** LOCKED, not started
- **Lock:** **ADR-0387** (2026-07-25) — Azure Key Vault KMS backs field-crypto in production, and this
  wave lands **before** the one-SHA fleet deploy (T4). The deploy does not proceed until it ships.
- **Parents:** ADR-0043 (per-tenant derivation, the `FieldKeyProvider` port, the NO-REMIGRATION
  invariant) · ADR-0046 (self-describing envelope) · ADR-0014 (append-only wrapped-DEK store,
  crypto-shred as an act on the KMS) · ADR-0005 (fail-closed tenant scoping) · ADR-0380 (lane A,
  which shipped `kms-azure.ts` and its live test).
- **Explicitly NOT opened:** which cloud hosts the KMS long-term (`kms-aws.ts` and `kms-gcp.ts` are
  shipped and untouched here); the ADR-0383/0384/0386 oscal-spine wave; the release train.

## Goal (why now)

Production has never chosen a key-management backend. Two are shipped, and the one currently wired —
`DerivedKeyProvider`, reading `MASTER_FIELD_KEY` and `FIELD_CRYPTO_SALT` from the environment — is
not the one ADR-0387 locked. The deploy is blocked on this because switching backends after a real
buyer seals a BYOK secret means re-encrypting every field: there is no rewrap helper, and BYOK
ciphertext has no recovery path.

The work is a refactor, not a configuration change. `KmsKeyProvider` implements the async-only
`FieldKeyProvider`; both production consumers require `SyncFieldKeyProvider`, which only
`DerivedKeyProvider` implements. Done means the site's BYOK path and ai-kit's MCP run tools seal and
unseal through Azure Key Vault, with no plaintext DEK outliving a request.

## The seam (read this before designing anything)

`packages/field-crypto/src/column.ts` is where the sync assumption actually lives:

- `FieldCryptoContext` is `{ tenantId, deriveKey(keyVersion) → Buffer, currentVersion() → number }` —
  both members **synchronous**.
- `sealField` / `unsealField` are sync pure functions over that context.
- The context is bound per request through `AsyncLocalStorage`; `currentFieldCryptoContext()` throws
  when a query reaches an encrypted column unscoped (fail-closed, ADR-0005).
- `derivedContext(provider, tenantId)` builds one from a `SyncFieldKeyProvider`.

Consumers requiring sync: `apps/site/lib/byok.ts:137` (`getFieldKeyProvider(): SyncFieldKeyProvider`,
an HMR-safe global singleton) and `packages/ai-kit/src/mcp-run-tools.ts:61`.

## The one open design question — resolve it here, not in a comment

**Where does the async boundary go?**

The recommended shape: add a `kmsContext()` builder alongside `derivedContext()` that resolves DEKs
asynchronously **at context-bind time** and hands `FieldCryptoContext` already-unwrapped key material
for that request. `sealField`/`unsealField` stay sync, and the change stops rippling into every
encrypted-column read. This is **not** the cache ADR-0387 rejected: the key material lives only for
the request scope inside `AsyncLocalStorage`, never for the process lifetime.

The obstacle is the **NO-REMIGRATION INVARIANT** (`provider.ts:16`): a context must answer
`deriveKey(tenantId, v)` for **any past** `v`, because an envelope written under v1 stays decryptable
forever after `currentVersion` moves on. Bind time does not know which versions a request will read.

Options, to be decided and recorded in the implementing ADR:

1. **Pre-fetch every version at bind.** Unwrap all wrapped DEKs for the tenant when the context binds.
   Correct by construction and cheap while rotations are rare, but cost grows linearly with version
   count and every request pays for versions it may never read.
2. **Pre-fetch current, fail loudly on a historical miss.** Smallest bind cost; turns a legitimate old
   read into an error. Violates the invariant — listed only to be rejected explicitly.
3. **Make `sealField`/`unsealField` async.** Honest and general; the largest diff, rippling into every
   encrypted-column call site.

Whichever is chosen, state the reasoning and the cost. Do not settle it in a code comment.

## Scope

1. **Provider wiring.** `apps/site/lib/byok.ts` and `packages/ai-kit/src/mcp-run-tools.ts` move off
   `SyncFieldKeyProvider` to the KMS-backed path. `DerivedKeyProvider` stays for dev/test and for
   self-hosting buyers — ADR-0043's two-variable story survives for them, and the existing
   labelled DEMO vector fallback must keep working with zero config under `bun dev` / `bun test`.
2. **Azure Key Vault.** Wire `createAzureKeyVaultKmsClient` (`kms-azure.ts`) into the production path:
   key name, purge protection, wrap algorithm, and service authentication. Purge protection must be
   **required**, not merely observed — a vault that permits purge breaks ADR-0014's crypto-shred
   receipt semantics.
3. **Wrapped-DEK store.** `DbWrappedKeyStore` persists through a `KeyValueStore` seam that nothing
   wires in production. Give it a real home, with a migration if one is needed. The store is
   **append-only** (ADR-0014) — crypto-shred acts on the KMS, never by deleting rows.
4. **Fail-closed on KMS loss.** Azure becomes a runtime dependency of the seal path. A failed unwrap
   must fail closed — never fall back to the derived provider, never to the DEMO vector, never return
   partial plaintext. Test this explicitly; it is the single most likely production incident.
5. **Provisioning path.** `KmsKeyProvider.provision(tenantId)` generates and stores a tenant's first
   wrapped DEK. Decide and test when a tenant is provisioned (first seal vs. tenant creation) and what
   a concurrent double-provision does.
6. **Runbook + arming.** `docs/ops/launch-runbook.md`'s boot-blocking table currently names
   `MASTER_FIELD_KEY` + `FIELD_CRYPTO_SALT` as the field-crypto requirement with "no arming record".
   Replace with the Azure variables and keep the warning intact — the failure mode that made this
   dangerous (clean boot, clean probes, throws in front of a paying buyer) is unchanged by the swap.

## Verification

- The existing golden/conformance suites (`kms-conformance.test.ts`, `isolation.integration.test.ts`,
  `store.pg.integration.test.ts`, `encrypt-field.test.ts`, `column.test.ts`, `envelope.test.ts`) stay
  green — the envelope format and tenant isolation are unchanged by this wave.
- A round-trip test proving a value sealed under key version N stays readable after `currentVersion`
  advances past N. This is the NO-REMIGRATION invariant and it is the thing most likely to break.
- A negative test proving a KMS unwrap failure fails closed rather than degrading to any other
  provider.
- A test proving no plaintext DEK survives the request scope.
- `bun run gate`, `bun run check`, `bun run format:check`, `bun run sot`,
  `bash tools/security/scan.sh --layer ci` — the last must report a real file count near 3,969. A
  scan reporting zero files crashed; never read a findings count without checking the exit code.
- Code review, security audit, and an adversarial self-review over the full diff. This wave sits in
  the tenant-secret path; the independent-lane grill on 2026-07-25 found three P1s in code whose
  author had self-reported all three reviews PASS, so treat a clean self-review as unproven.

## Out of scope

Re-encrypting existing data (nothing is sealed), the rewrap helper, AWS/GCP wiring, and any change to
the envelope format or the tenant-isolation boundary.
