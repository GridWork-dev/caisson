# @caisson/local-ai

Local-first AI edition — fully-commercial (ADR-0050, no AGPL/copyleft anywhere). An offline,
no-lock-in AI stack over a single-file-per-tenant SQLite store. **Your data never leaves the
device.**

A **composition**, not a fork (ADR-0003): it depends down-only on the shipped bases and adds the
edition-only surface.

- **Layer:** edition (`kind: "edition"`, `editions: ["local-ai"]`)
- **Composes (down-only):** `@caisson/local-store` (sqlite-vec + FTS5 RRF hybrid retrieval, ADR-0067)
  · `@caisson/license-verify` (offline Ed25519, ADR-0010) · `@caisson/field-crypto` (at-rest,
  ADR-0055) · `@caisson/kernel`
- **Adds:** a built two-way sync engine (CRDT/LWW + tombstones behind a `SyncEngine` port) · an
  `InferenceBackend` port (real local embeddings; completion seam; stubbed in CI) · a zero-egress
  privacy gate · the file-per-tenant resolver (ADR-0073) · the edition migration assembly
- **Seeds (rebuild-clean):** PUBLIC tessera (license token format) + health-service (SQLite migration
  analog) PATTERNS only — pro-private `media-pipeline` contributes patterns only, never code
- **Key ADRs:** ADR-0064 (built two-way sync + hybrid-retrieval exit gate) · ADR-0050
  (fully-commercial) · ADR-0067/0073 (local-store + file-per-tenant) · ADR-0010 (offline license)

> T9 scaffold: the package barrel composes the shipped base seams; the edition feature surface
> (sync, inference, privacy, at-rest, tenancy, migration) lands per `outputs/specs/wave1-p4a-local-ai/PLAN.md`.
