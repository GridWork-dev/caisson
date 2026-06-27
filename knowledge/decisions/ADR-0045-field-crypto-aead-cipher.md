# ADR-0045 — Field-crypto AEAD cipher: AES-256-GCM via node:crypto

Status: accepted · 2026-06-27 (Wave-0 shared-substrate session, Fork 1. Implements the cipher
half of the field-crypto column under ADR-0043/0006.)

The encrypted field column (ADR-0006/0043) needs one authenticated cipher. The choice trades
dependency cost, nonce headroom, and FIPS posture.

## Decision

**AES-256-GCM through native `node:crypto`**, written behind an `AeadCipher` seam so an
alternate is a drop-in (same swappability ethos as the `FieldKeyProvider` port).

- **Zero dependency** — matches ADR-0043's explicit "no added dependency" value; the HKDF step
  already uses native `crypto`. AES-NI hardware-accelerated. **FIPS 140-approved** — a real
  selling point for the SOC2/HIPAA Compliance _hero_ buyer.
- The 96-bit-random-nonce ceiling is **2^32 messages per key** (NIST 2^-32 collision bound). Because
  keys are **per-tenant-derived** (ADR-0043), that ceiling is **per tenant** (~4.3B encrypted
  fields) — ample headroom.
- Mitigate GCM's catastrophic nonce-reuse: a **fresh CSPRNG 96-bit IV per write** and **bind
  `tenant_id || key_version || column-context` as AAD** (Tink's defense against moving a ciphertext
  between rows/tenants/columns). Tamper and AAD-mismatch MUST throw on decrypt.

## Rejected

- **XChaCha20-Poly1305 (libsodium)** — 192-bit nonce removes the per-key volume ceiling and is
  misuse-resistant, but costs a native/WASM dependency (against the zero-dep ethos) and is **not
  FIPS-validated** (a deduction for compliance buyers). Kept as a drop-in behind the `AeadCipher`
  seam if a buyer ever needs unlimited per-key volume.
- **AEGIS-256** — safest with hardware AES per libsodium, but newer/less ubiquitous and no
  `node:crypto` path. Reject for v1 (immaturity + dependency).

## Binding

The field cipher is AES-256-GCM behind an `AeadCipher` interface; a fresh CSPRNG 96-bit IV per
encrypt; `tenant_id || key_version || column-context` bound as AAD; decrypt authenticates (tamper +
AAD-mismatch throw); a `(key, nonce)` pair is never reused. The alternate-cipher seam exists but
ships only AES-256-GCM in Wave 0. Evidence: libsodium AEAD table; CFRG `draft-irtf-cfrg-aead-limits`;
Google Tink AEAD guidance; `node:crypto` `createCipheriv("aes-256-gcm")`.
