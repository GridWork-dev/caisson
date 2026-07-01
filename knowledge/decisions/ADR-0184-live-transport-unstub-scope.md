# ADR-0184 — Live-transport un-stub scope: defer all three

**Status:** accepted · 2026-07-01 (edition seam-completion, operator-locked) · relates **ADR-0054** (WORM S3
Object-Lock), **ADR-0064** (local-ai ONNX / hosted backends), the doctrine DEPLOY-gate (SHIP stops at the
merged PR; provisioning is a separate operator-gated act). Append-only; supersede with a later ADR, never
edit. **Tags:** `infra`, `external-system`.

## Context

The live-transports recon confirmed (repo-wide grep) that all three transports are **already fully
implemented in code** — `S3ArtifactStore` (real Object-Lock PUT/GET/HEAD against `@aws-sdk/client-s3`, a
non-optional dep), `OnnxEmbeddingBackend` (guarded egress + SHA-256 hash-pin; `@huggingface/transformers`
deliberately not installed, a non-literal dynamic import), and `RentedInferenceBackend` +
`createLiveRentedTransport` (real HTTPS POST + zod + metering sink). None is referenced by any consumer app
outside its own source + test files. **The only gap is creds + infra + one integration test each — NOT
code** (matches `docs/build-state.md:256-261` verbatim). So this was purely a spend + operational-surface
decision: which, if any, to prove against real infra now.

## Decision

**Leave all three stubbed — S3 WORM Object-Lock, hosted/rented inference, and on-device ONNX.** No infra
provisioning, no creds wiring, no integration tests in this initiative. **No build work results from this
ADR.**

The code is already fully implemented for all three; the sole gap is creds + infra + a per-transport
integration test, which the operator has elected to defer for every transport. All three remain
honestly-documented, un-exercised-by-design seams — not fake or incomplete code, but complete code whose
live path has not yet been run against real infra. Each stays DEPLOY-class and operator-gated; un-stub any
one later by provisioning its infra + adding a single env-gated integration test (following
`chain-store.integration.test.ts`), no backend rewrite needed.

## Consequences

- Zero code change lands under this ADR. The three transports' source + fake-driven unit tests stay green
  and untouched.
- `docs/build-state.md:256-261` and the live-transports SPEC are annotated as DEFERRED — the seams stay
  documented as un-exercised-by-design (no silent-rot), with the "creds + infra + one integration test"
  upgrade path named for each.
- The compliance-edition WORM immutability claim, hosted inference, and on-device ONNX remain proven only by
  fake-send unit tests until a future operator-gated un-stub.
