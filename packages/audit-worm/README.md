# @caisson/audit-worm

The Compliance edition's evidentiary primitive: a write-once (WORM) artifact store, a SHA-256
append-only audit chain anchored into WORM, and an append-only locked-version DB with a derived
current. A paid `primitive` (ADR-0020) that composes the `@caisson/kernel` integrity algebra over
`@caisson/tenancy-rls` tenant scoping — down-only, never depending on an edition (ADR-0003).

- **Kind / tier:** primitive · paid · `LicenseRef-Caisson-Commercial`

## Install

```bash
bun add @caisson/audit-worm
```

## Surface

- **`ArtifactStore`** — `LocalArtifactStore` (retention-ignored fs double) +
  `S3ArtifactStore` (Object-Lock; GOVERNANCE default, COMPLIANCE only via the typed
  `irreversibleComplianceOptIn` guard) behind an injected `S3Sendable` port (no live cloud in CI).
  `assertSafeKey` / `buildArtifactKey` enforce the `{account_id}/…` prefix; `retainUntilFrom` is the
  6–7yr HIPAA/SEC retention floor.
- **`AuditChainStore`** — append-only per-tenant chain; every append mints a fresh length-keyed,
  write-once WORM anchor, so tamper, tail-truncation, and wholesale rewrite are all evident
  (`verify` runs `verifyChain(entries, anchor)`).
- **`LockedVersionStore`** — append-only locked versions; "current" is a derived no-successor
  predicate cross-checked against the kernel model (never a stored column).
- **External anchoring (v1, `trusted-timestamped` grade)** — `TrustedTimestampLog`/`TsaAnchorLog`,
  the durable `AnchorOutbox`, the per-tenant checkpoint handler, and `verifyExternal` periodically
  attest the chain's WORM anchor to an RFC-3161 TSA (SPEC `external-anchoring`, ADR-0332/0346). Trust
  grades, the honest-limit language, and the TSA egress note: `docs/security/external-anchoring.md`.

## Golden

`src/__golden__/anchor.json` pins the canonical `{length, tipHash, genesisHash}` anchor (ADR-0013);
update only via `BLESS=1 bun test`.
