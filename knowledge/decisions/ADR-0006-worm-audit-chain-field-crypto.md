# ADR-0006 — WORM storage + append-only audit chain + field encryption (Compliance edition)

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

The Compliance edition's data layer (← Wardfile, rebuilt clean) combines four primitives, each
its own package or module:

- **Append-only versioning** — locked artifacts immutable; a new version supersedes via a
  `supersedes_id` chain; a derived "current" predicate; nothing is destroyed.
- **WORM ArtifactStore** (`audit-worm`) — local + **S3 Object-Lock** backends, retention on row
  AND object, byte-stable checksums (the SEC 17a-4 WORM path).
- **SHA-256 hash chain** — an append-only audit chain over locked versions (the 17a-4
  audit-trail alternative path); the combination is the highest-value compliance feature.
- **Field encryption** (`field-crypto`) — a column custom-type (encrypt-on-write/decrypt-on-read)
  - a key-version rotation registry; env-key at base tier, **KMS envelope (per-tenant DEK wrapped
    by a KEK) at the SOC2 tier** — the column type is the abstraction boundary, so the swap touches
    key management only.

The **SOC2/HIPAA evidence-pack generator** maps controls → evidence and emits a signed ZIP (the
recurring-value lever: framework updates as a subscription).

Rejected: mutable versions (destroys the compliance proposition). pgcrypto-in-DB (key transits
SQL, rotation re-encrypts every row). Storing evidence without WORM (not court-admissible).

Binding: "flag, never guess" — unresolved data flags block artifact generation; golden-file
regression before any evidence logic.
