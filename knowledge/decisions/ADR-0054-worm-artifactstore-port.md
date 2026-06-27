# ADR-0054 — WORM ArtifactStore port shape, backend, retention floor, per-tenant isolation

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Settles where the audit-worm
object store lives, its prod backend, and how it stays write-once + tenant-scoped.)

The `audit-worm` primitive (ADR-0006) needs a real object store for SEC 17a-4 WORM artifacts, but
the Wave-0 cloud-seam ethos forbids a live cloud call on the CI critical path. This fixes the port
shape, the prod-vs-dev backends, and the isolation + retention invariants in one lock.

## Decision

**`audit-worm` ships as a standalone paid primitive that owns its own store** — an `ArtifactStore`
port (`put` / `get` / `head`, each carrying retention metadata) with two backends behind it.

- **Prod backend: `S3ArtifactStore` over the real `@aws-sdk/client-s3`**, write-once via S3 Object
  Lock — conditional `IfNoneMatch: '*'` (412 → `ArtifactExistsError`) plus `ObjectLockMode` +
  `RetainUntilDate`. Unit-tested against an injected `S3Sendable = Pick<S3Client, "send">` stub;
  **no live cloud call in CI** — the only un-exercised path is the live S3 transport. Same
  seam-real / cloud-behind-the-port precedent as `kms.ts` (ADR-0047).
- **Dev/test backend: `LocalArtifactStore`** — a retention-ignoring filesystem store for `bun test`
  and local dev. The buyer wires the real SDK at deploy; the port makes the swap a one-line bind.
- **Per-tenant isolation by key-prefix scoping** — every object key is prefixed `{account_id}/…`
  through an `assertSafeKey` guard; optional per-tenant SSE-KMS. No cross-tenant read is reachable
  through the port.
- **Retention floor enforced at write** — a calendar-correct `retainUntilFrom` helper with a
  conservative default floor (6–7yr, HIPAA/SEC-safe) and a per-`put` override, so the DB
  `retain_until` provably equals the S3 `RetainUntilDate`. Composes with the COMPLIANCE-vs-GOVERNANCE
  retention mode of ADR-0051 (LocalArtifactStore ignores mode by design — never court-admissible).
- **Length-keyed, write-once object keys for chain anchors** per ADR-0052 — the anchor `put` lands at
  a collision-proof key so `verifyChain(entries, anchor)` reads a provably immutable tip.

This is the WORM-store half of the `audit-worm` primitive under ADR-0006 (append-only artifacts,
retention on row AND object, byte-stable checksums); it does not amend ADR-0006, it implements it.

## Rejected

- **Fold the store into the Compliance edition** — kills the à-la-carte sale of `audit-worm` as a
  standalone primitive (ADR-0012) and bloats the edition with a storage layer no other edition can
  buy alone. The primitive owns its store.
- **A new thin DB/storage package to hold the store** — extra manifest + publish + lint-gate surface
  (ADR-0020/0021) for little gain; the store belongs inside the primitive that produces the
  artifacts, not in a sidecar package.
- **A real `S3ArtifactStore` wired e2e against MinIO in Wave-1** — closest to production truth, but
  pulls a cloud SDK and a live integration onto the CI critical path, against the Wave-0
  "cloud call behind the port, no live CI call" ethos. The real SDK ships behind the port,
  seam-swappable, exercised by the buyer at deploy.

## Binding

Future code and agents MUST reach WORM storage only through the `ArtifactStore` port: prod binds
`S3ArtifactStore` (real `@aws-sdk/client-s3`, Object-Lock write-once, never a live call in CI),
dev/test binds the retention-ignoring `LocalArtifactStore`; every object key is `{account_id}`-prefixed
and `assertSafeKey`-guarded; the retention floor is enforced at write with the DB date == the S3
`RetainUntilDate`; chain anchors use length-keyed write-once keys. `audit-worm` stays a standalone
paid primitive (TypeScript-strict, Bun, fully-commercial per ADR-0023 — note ADR-0050 makes the
local-ai edition commercial too, leaving no permissive flank in this surface). Evidence: ADR-0006:10-13
(local + S3 Object-Lock, retention on row AND object, byte-stable checksums); `kms.ts:7-10,157-164` +
ADR-0047 (seam-real / cloud-behind-the-port, un-wired-in-CI precedent); ADR-0012 (à-la-carte primitive
sale); ADR-0051 (retention mode); ADR-0052 (length-keyed anchor keys); `outputs/research/wave1-forks.md`
P2-4 (Wardfile `core/artifact/{store,store.s3,store.local}.ts` seed; Cohasset 2025 / MinIO / R2 parity).
