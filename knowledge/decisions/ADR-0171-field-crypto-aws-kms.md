# ADR-0171 — KMS adapter: wire AWS KMS behind field-crypto's `KmsClient` (license `KmsSigner` excluded)

**Status:** accepted · 2026-06-30 (Stage-2 Stream D, adapter buildout) · extends ADR-0043/0045/0046/0055
(field-crypto per-tenant keys + KMS seam) · realizes `docs/state/adapter-expansion.md` §1B (advisory
"ADR-0120" retires → 0171). Append-only; supersede with a later ADR, never edit.

## Context

`packages/field-crypto` defines `KmsClient` (`kms.ts:30-43`: `generateDataKey` / `decryptDataKey` /
`scheduleKeyDeletion`), injected into envelope encryption via `KmsKeyProvider implements FieldKeyProvider`
(`kms.ts:84-138`). Today only `LocalKmsClient` (a tested AEAD-wrap double) is real; `awsKmsClient` **throws**
(`kms.ts:241`), and no production module constructs a `KmsKeyProvider` at all (only `DerivedKeyProvider.fromEnv`
is wired). The Compliance edition's headline — field-crypto envelope encryption + court-admissible WORM — is
therefore **dev-only** until a real KMS driver lands (`adapter-expansion.md` §1B, highest revenue-risk gap).

## Decision

Replace the throwing `awsKmsClient` stub with a real `createAwsKmsClient(config): KmsClient` in a new sibling
file `packages/field-crypto/src/kms-aws.ts`, over `@aws-sdk/client-kms` (new dependency on `field-crypto`) —
`GenerateDataKey` / `Decrypt` / `ScheduleKeyDeletion` mapped to the three port methods, injected config,
`ConfigError` fail-closed, mirroring `packages/jobs/src/trigger-driver.ts`'s real-vendor-driver shape. **Also
ship a DB-backed `WrappedKeyStore`** (only `InMemoryWrappedKeyStore` exists today; `kms.ts:45` flagged
"DB-backed in P2" and it never landed) — a real KMS driver without persisted wrapped-DEKs is inert. Defer
**GCP KMS / Azure Key Vault / HashiCorp Vault** to on-demand later ADRs (operator lock: AWS-only first).

**Explicitly excluded (operator lock, this round):** the license `KmsSigner` (`packages/license-issue/src/signer.ts:176`)
— it lives in `license-issue` + `services/license`, owned by **no Stage-2 stream** and self-framed as **P7**
work, and needs an asymmetric KMS `Sign` primitive (a different shape than this envelope-wrap `KmsClient`). It
is **not** part of this ADR; its KMS wiring stays a P7 seam.

## Scope — build-now vs DEPLOY-class

**Build now:** `kms-aws.ts` + the DB-backed `WrappedKeyStore` + round-trip tests + wiring `KmsKeyProvider` into
the app that currently uses `DerivedKeyProvider.fromEnv`. **DEPLOY-class:** the AWS KMS key + IAM creds — the
driver is dormant (constructed only when its config is supplied), so merging changes no runtime behavior. Live
KMS is not exercised in CI (`LocalKmsClient` stays the CI double, ADR-0054-class by-design seam).

## Rejected

- **Build all four KMS providers now** — AWS-only first (operator lock); GCP/Azure/Vault on demand.
- **Fold the license `KmsSigner`** — out-of-tree + P7 + different primitive (see above).

## Binding

field-crypto's `KmsClient` gains a real AWS driver behind a DB-backed wrapped-key store; GCP/Azure/Vault are
deferred; the license `KmsSigner` is out of scope (P7). Adding a further KMS provider needs no new ADR; wiring
the license signer to KMS does.

Evidence: `packages/field-crypto/src/kms.ts:30-43,84-138,228-248`; `provider.ts:16-25`;
`packages/license-issue/src/signer.ts:176-179`; `docs/state/adapter-expansion.md:36,61-68`; recon
`wf_fa542371-7e6` (D5:crypto-identity).
