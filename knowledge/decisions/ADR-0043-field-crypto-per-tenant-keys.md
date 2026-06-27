# ADR-0043 — Field-crypto per-tenant key derivation (amends ADR-0006)

Status: accepted · 2026-06-27 (closes the docs-review **HIGH** finding on ADR-0006's
base-tier "env-key". ADRs are append-only, so this amends-by-superseding the base-tier
key-management detail of ADR-0006. Pre-work for the P2 Compliance edition.)

ADR-0006 specified field-crypto as a column custom-type over a key-version rotation
registry, with "env-key at base tier, KMS envelope (per-tenant DEK wrapped by a KEK) at the
SOC2 tier." The base-tier "env-key" — a **single shared key across all tenants** — is a
cross-tenant breach: one key compromise decrypts every tenant's columns, and the encryption
boundary no longer matches the RLS tenant boundary (ADR-0005). This ADR fixes the base tier
and generalizes the key-management swap into one port.

## Base tier — per-tenant derived keys (HKDF), default, zero infra

Each tenant's data-encryption key is derived, never shared:

```
tenant_key = HKDF-SHA256(
  ikm  = MASTER_FIELD_KEY,             // 32B from env/secret store, never logged
  salt = FIELD_CRYPTO_SALT,            // 32B per-deployment, non-secret
  info = "caisson-field-crypto:v" || key_version || ":" || tenant_id
)
```

Deterministic (no per-tenant key storage or backup surface), per-tenant isolated (the
`tenant_id` is bound into `info`), and rotation-aware (`key_version` in `info`). No external
dependency — a buyer self-hosting needs only `MASTER_FIELD_KEY` + `FIELD_CRYPTO_SALT` in env.
`MASTER_FIELD_KEY` is read once, never logged, and compared timing-safe where compared at
all; credential-bearing files stay out of any embedding/egress path per the security floor.
Native `crypto.hkdfSync` (Bun/Node) — no added dependency.

## Upgrade tier — external KMS, pluggable provider port, documented option

The column custom-type stays the abstraction boundary (ADR-0006); key management sits behind
one `FieldKeyProvider` port:

```ts
interface FieldKeyProvider {
  keyFor(tenantId: string, keyVersion: number): Promise<CryptoKey>; // the tenant DEK
  currentVersion(tenantId: string): Promise<number>;
}
```

- **`DerivedKeyProvider`** (default) — the HKDF derivation above.
- **`KmsKeyProvider`** (opt-in, documented) — envelope encryption: a per-tenant DEK wrapped
  by a KEK held in **AWS KMS**, with the seam written so **GCP KMS / Azure Key Vault /
  HashiCorp Vault** are drop-in alternates (one interface, provider selected by config). This
  realizes ADR-0006's "SOC2-tier KMS envelope" as a swappable provider, **not** an AWS
  hard-binding.

Selecting the provider touches key management only — the ciphertext format (versioned,
provider-tagged), the column type, and the rotation registry are unchanged. Rotation: bump
`key_version`, derive/wrap the new key, lazy re-encrypt on next write; older versions stay
readable via the registry.

## Rejected

- **Single shared base-tier env-key** — the cross-tenant breach this ADR closes.
- **pgcrypto-in-DB** — key transits SQL; already rejected in ADR-0006.
- **Hard-coding AWS KMS** — locks out self-host + other clouds; the port keeps KMS optional
  and multi-vendor.
- **Per-tenant random keys (stored) at base tier** — adds a key-storage + backup + rotation
  surface that derivation avoids; KMS envelope is the right home for stored wrapped keys when
  a buyer opts in.

## Binding

Base-tier field-crypto derives a per-tenant key via HKDF (never a shared key); the
`FieldKeyProvider` port ships with the derived default + a documented KMS adapter (AWS, with
a GCP/Azure/Vault seam); the encryption boundary equals the RLS tenant boundary (ADR-0005);
an integration test asserts two tenants' ciphertexts use distinct keys and a cross-tenant
decrypt fails. Golden-file regression before any evidence logic (ADR-0006 binding stands).
Supersedes only the base-tier key-management detail of ADR-0006; the rest of ADR-0006 — WORM,
the SHA-256 audit chain, append-only versioning, the evidence-pack generator — stands.
