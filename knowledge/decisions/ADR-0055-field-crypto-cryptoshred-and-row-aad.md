# ADR-0055 — field-crypto P2: crypto-shred key granularity + row-level AAD

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Settles the two carried
field-crypto P2 forks — crypto-shred key granularity (P2-9) and row-level AAD (P2-10) — for the
Compliance edition.)

ADR-0043 derives one per-tenant key and ADR-0045 binds `tenant||key_version||column-context` as
AAD. Two gaps remain for the regulated buyer: derived keys cannot be _destroyed_ (so no GDPR
Art.17 erasure-by-key-destruction), and column-scoped AAD does not pin a cell to its row. Both
resolve **hybrid** — the cheap default stays, the regulated path is an explicit opt-in.

## Decision

**Crypto-shred key granularity (P2-9) — hybrid.** Derived per-tenant keys remain the base default;
**ADR-0043 stands unchanged.**

- A **stored per-tenant/subject DEK** behind the existing `KmsKeyProvider` port is the
  regulated-buyer upsell. It enables **GDPR Art.17 erasure via `kms schedule-key-deletion`** on the
  subject's DEK plus an **`erasure.crypto-shred` audit event** — destroying the key renders that
  subject's ciphertext permanently unrecoverable without rewriting rows.
- **BINDING (chained payloads):** if PII ever enters a payload covered by the SHA-256 audit chain
  (ADR-0006), the chain MUST commit to **ciphertext, not plaintext**, so the audit chain survives
  key destruction — shredding the DEK must not break verifyChain or expose erased plaintext.

**Row-level AAD (P2-10) — hybrid.** The transparent Drizzle `encryptedColumn` stays for
low-sensitivity fields.

- An explicit **`encryptField(ctx, columnContext, rowId, plaintext)`** with
  **AAD = `tenant || key_version || column || rowId`** is **REQUIRED for SEC/HIPAA-tagged columns** —
  pinning the cell to its row closes the cross-row relocate/rollback gap left by column-scoped AAD.
- Use **`crypto.randomUUID()` primary keys** so `rowId` is known **before** the INSERT seals the
  cell (the AAD must be bound at encrypt time, not after the row exists).

**Amends ADR-0043 and ADR-0006** (append-only — extends the key-provider port and the chained-payload
commitment without editing either). **Closes the carried Wave-0 board fork TM2 (row-level AAD).**

## Rejected

- **Derived-only (no crypto-shred)** — sacrifices Art.17-by-key-destruction, a hero selling point for
  the Compliance buyer. The derived default cannot destroy a key, so a stored-DEK path must exist.
- **Stored-DEK-always at base** — reintroduces the key-storage + backup + rotation surface ADR-0043
  deliberately avoided; the stored DEK belongs behind the opt-in KMS provider, not the base default.
- **Column-scoped AAD only** — leaves the cross-row relocate/rollback gap: a valid ciphertext can be
  moved between rows of the same column/tenant/version undetected.
- **Deterministic AES-256-SIV** (one option for stable row identity) — leaks plaintext-equality
  across cells; kept **only as a documented alternate behind the `AeadCipher` seam**, never a default.

## Binding

Base field-crypto stays derived-per-tenant (ADR-0043); the Compliance edition adds a stored
per-tenant/subject DEK behind `KmsKeyProvider` whose deletion (`kms schedule-key-deletion`) emits an
`erasure.crypto-shred` audit event and crypto-shreds the subject. Any PII inside a chained payload is
committed as ciphertext so the SHA-256 audit chain survives key destruction. SEC/HIPAA-tagged columns
encrypt through `encryptField(ctx, columnContext, rowId, plaintext)` with AAD bound over
`tenant||key_version||column||rowId`, and such tables use `crypto.randomUUID()` PKs so `rowId` is
available before the sealing INSERT; AES-256-SIV is reachable only as a documented seam alternate.
Evidence: ADR-0043 (`FieldKeyProvider`/`KmsKeyProvider` port, per-tenant derivation), ADR-0006 (WORM

- SHA-256 audit chain / verifyChain), ADR-0045 (`AeadCipher` seam + AAD binding), AWS KMS
  `schedule-key-deletion`, GDPR Art.17; fork analysis in `outputs/research/wave1-forks.md` (P2-9, P2-10).
