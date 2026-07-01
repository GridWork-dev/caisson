# SPEC — Edition Seam-Completion · live transports

> **DEFERRED per ADR-0184 (2026-07-01) — NO BUILD.** The operator elected to **leave all three transports
> stubbed** (S3 WORM Object-Lock · hosted/rented inference · on-device ONNX). No infra provisioning, no creds
> wiring, no integration tests in this initiative. The code for all three is already fully implemented; the
> only gap is creds + infra + one integration test each, deferred for every transport. They remain
> honestly-documented, un-exercised-by-design seams. This SPEC is retained as the future un-stub playbook —
> nothing below builds now; un-stub any one later by provisioning its infra + adding a single env-gated
> integration test.

Act 1 (SPEC) for the **live transports** seam of EDITION SEAM-COMPLETION. Recon verdict (read-only,
repo-wide grep): all three transports are **fully implemented already** — the gap is creds/infra +
one integration test per transport, **NOT code**. This SPEC is therefore mostly a DEPLOY-class
provisioning + verification plan, and its central fork (ADR-0184) is "which un-stub now vs leave
stubbed." Grounded in the live-transports recon (`store.s3.ts`, `onnx-backend.ts`, `rented-backend.ts`)

- `docs/build-state.md:256-261`. Bound by ADR-0054 (WORM/Object-Lock), ADR-0064 (local-ai backends) —
  do not relitigate the backend code.

## Goal

Prove one or more of the three built live transports against real infra, so the seam stops being "typed
but never run." WHY: `S3ArtifactStore` (real Object-Lock PUT/GET/HEAD), `OnnxEmbeddingBackend` (guarded
egress + hash-pin), and `RentedInferenceBackend` + `createLiveRentedTransport` (HTTPS POST + zod +
metering sink) are complete and unit-tested against injected fakes, but none has ever run against real
infra — so "the live path works" is asserted, not demonstrated. VERIFY re-asks: **for each transport
the operator elects to un-stub, does a single integration test pass against real infra following the
existing `chain-store.integration.test.ts` pattern — and are the transports the operator defers still
honestly documented as un-exercised seams?**

## Tags

`infra` (S3 bucket + Object-Lock, hosted-inference endpoint) · `external-system` (AWS S3, hosted
inference provider, HuggingFace model host) · `security` (egress allowlist + hash-pin on ONNX;
SSE-KMS on WORM). Drives SHIP audits: **INFRA review** + **SECURITY** (egress/allowlist/creds). Every
task here is DEPLOY-class → all re-enter the operator (SHIP stops at the merged PR; provisioning is a
separate operator-gated act per doctrine).

## Open design fork (BLOCK build — operator locks first)

1. **ADR-0184 — live-transport un-stub scope.** Which transports get real infra + an integration test
   NOW (S3 WORM Object-Lock? hosted inference? on-device ONNX?), and which stay honestly-stubbed seams?
   This is a spend + operational-surface decision, not a code decision — the recon confirms zero backend
   code is needed for any of the three.

## Scope (post-lock — per-transport, each independently electable)

**T-LT-1 — S3 WORM Object-Lock (`packages/audit-worm`, IF elected):**

- Provision an S3 bucket with Object-Lock (COMPLIANCE mode) + versioning + SSE-KMS; wire bucket/creds at
  a deploy site (no code — `@aws-sdk/client-s3` is already a non-optional dep).
- One integration test: PUT an artifact → second PUT of the same key returns 412 → `ArtifactExistsError`
  (the real WORM immutability proof); HEAD confirms retention. Follows `chain-store.integration.test.ts`.

**T-LT-2 — on-device ONNX embedding (`packages/local-ai`, IF elected):**

- `bun add @huggingface/transformers` at the deploy site (deliberately non-literal dynamic import so
  tsc/CI never touch it); configure model cache + the SHA-256 hash-pin + single-host egress allowlist.
- One integration test: embed a fixture string → vector of expected dim; a tampered model hash → egress
  guard rejects (the hash-pin proof).

**T-LT-3 — hosted/rented inference (`packages/local-ai`, IF elected):**

- Deploy or point at a real hosted-inference endpoint; add its host to the egress allowlist; wire the
  `credits.debit` metering sink to the real P6 shape.
- One integration test: `createLiveRentedTransport` POST → zod-valid response → metering sink debited.

**ALWAYS (regardless of which are elected):**

- For every transport NOT elected, leave the code untouched and reconcile `docs/build-state.md:256-261`
  so the deferred seams stay documented as un-exercised-by-design (no silent-rot).

**OUT OF SCOPE:** any backend/driver rewrite (none needed); RFC-3161 live TSA (tracked under the OSCAL
SPEC / P7); new provider drivers (that was Stream C ADR-0160).

## Verify commands

```bash
bun test packages/audit-worm/src/store.s3.test.ts        # existing fake-send unit tests stay green
bun test packages/local-ai                               # existing backend unit tests stay green
# per elected transport, gated behind an env flag so CI without creds skips:
CAISSON_S3_INTEGRATION=1 bun test packages/audit-worm/src/store.s3.integration.test.ts
```

## Failure modes

An integration test hardcodes creds → secret in the tree; creds come from env only, test skips when
unset. Un-electing a transport but editing its code → scope creep; the recon is explicit that no code
change is needed — resist it. A deferred seam left undocumented → `build-state.md` drifts; the ALWAYS
task reconciles it.
