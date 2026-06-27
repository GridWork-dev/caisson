# ADR-0052 — Audit-chain entry + trusted-anchor persistence + append serialization

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Lands the durability layer the
Wave-0 audit-chain seam left abstract.)

The Wave-0 audit chain computes a tamper-evident hash chain (`anchorChain`/`verifyChain`, ADR-0045
family) but never says _where_ entries and the trusted anchor durably live, nor how concurrent
per-tenant appends stay ordered. This ADR locks that storage + serialization contract.

## Decision

Chain **entries** live in an **append-only Postgres table**; the **trusted anchor** lives in the
**WORM ArtifactStore**. Implements the persistence layer under ADR-0006 (append-only artifacts) +
the Wave-0 `anchorChain`/`verifyChain` seam (ADR-0045 family).

- **Entries → append-only Postgres.** Immutability is enforced by **withholding the `UPDATE` and
  `DELETE` GRANT** on the table from the app role (the Wardfile pattern) — cheap, DB-native, and it
  keeps a **queryable SQL spine** for the chain (range scans, tenant filters, replay).
- **Anchor → WORM, length-keyed.** `anchorChain()` mints `{ length, tipHash, genesisHash }` on
  **every append** and writes it into the WORM `ArtifactStore` under a **length-keyed, write-once
  object key** — a new tip can never overwrite a prior anchor; each chain length pins its own
  attestation.
- **Verify reads both.** `verifyChain(entries, anchor)` pulls entries from Postgres and the matching
  anchor from WORM, then recomputes — neither store alone is trusted to attest itself.
- **Per-tenant append serialization.** Concurrent appends for one tenant serialize via a per-tenant
  **`pg_advisory_xact_lock`** _or_ a **unique `(account_id, seq)` index** with `23505` →
  `ConflictError` retry. Either holds strict monotonic `seq` ordering; no two writers claim a slot.
- **Canonical payload.** The chain payload is canonicalized through `audit-chain.ts` `canonicalize`
  before hashing, so byte-stable hashes hold across encoders/locales.
- **RFC-3161 timestamping / transparency-log (Rekor) anchoring is a documented PREMIUM upsell**, not
  the v1 floor — the seam admits it later without reshaping the storage contract.

## Rejected

- **(b) Entire chain in WORM, anchor in Postgres** — inverts where immutability lives: it loses the
  queryable SQL chain spine (every read becomes object-store fetches) and forfeits the cheap
  DB-grant immutability, while making the small, hot anchor the mutable half. Backwards.
- **(c) AWS QLDB** — a managed immutable ledger looked native, but the SDK landscape ruled it out
  (QLDB is end-of-life / on a deprecation path, single-vendor lock-in, and a heavy external
  dependency against the self-hostable substrate ethos). Postgres + WORM is owned, portable, and
  already in the stack.

## Binding

Audit-chain entries are append-only rows in Postgres made immutable by a withheld `UPDATE`/`DELETE`
GRANT; the trusted `{length, tipHash, genesisHash}` anchor is written write-once into the WORM
`ArtifactStore` under a length-keyed object key on every append; `verifyChain` recomputes from both
stores; per-tenant appends serialize via `pg_advisory_xact_lock` or a unique `(account_id, seq)`
index with a `23505`→`ConflictError` retry; the payload is `canonicalize`d before hashing. Future
code MUST NOT move immutability into a single store or skip the canonicalization step, and RFC-3161 /
Rekor anchoring stays a paid add-on, never the floor. Evidence: ADR-0006 (append-only artifacts),
the ADR-0045-family `anchorChain`/`verifyChain` + `audit-chain.ts canonicalize` seam, the Wardfile
withheld-GRANT immutability pattern, and `outputs/research/wave1-forks.md`.
