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
- **Adds:** a two-way sync engine (CRDT/LWW + tombstones behind a `SyncEngine` port) · an
  `InferenceBackend` port (real local embeddings; completion seam; stubbed in CI) · a zero-egress
  privacy gate · the file-per-tenant resolver (ADR-0073) · the edition migration assembly
- **Key ADRs:** ADR-0064 (two-way sync + hybrid-retrieval exit gate) · ADR-0050
  (fully-commercial) · ADR-0067/0073 (local-store + file-per-tenant) · ADR-0010 (offline license)

## Local inference backend (`OnnxEmbeddingBackend`)

The real on-device embedding backend (`src/inference/onnx-backend.ts`) runs a MiniLM-class ONNX model
via transformers.js (`@huggingface/transformers`) behind the `InferenceBackend` port. It is **never
exercised in CI** (ADR-0064) — the deterministic `StubInferenceBackend` is the only backend CI runs,
leaving the live model load the single un-exercised seam — so the runtime is an **optional peer**:
`bun add @huggingface/transformers` only where you actually run local inference.

- **Model is first-run-fetched + cached, never in the tarball** (`.npmignore` keeps the cache,
  `*.onnx`, and weight blobs out of the published package). Air-gap deployments pre-seed the cache and
  construct the backend with `offline: true` for literally zero egress.
- **Hash-pinned integrity:** the config requires at least one `filename → SHA-256` pin;
  every pinned file is verified before its bytes reach the runtime, fail-closed on mismatch.
- **Single guarded egress chokepoint:** transformers.js's `env.fetch` is overwritten with
  a guard that hard-blocks any host but the one sanctioned `modelHost` (and any non-https scheme) and
  routes through the kernel `fetchWithTimeout` — no raw `fetch`, no out-of-band download, no silent
  hosted fallback. (The package's privacy/egress guard later wraps this same chokepoint.)
- Embedding-only: text generation is a separate seam (the rented, hosted-inference backend) —
  `complete()` fails closed here.
