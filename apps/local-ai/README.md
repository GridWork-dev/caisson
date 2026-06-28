# apps/local-ai

The **Local-first AI edition** reference app (ADR-0044) — a Next.js App Router server that runs the
edition fully offline, with **zero egress**. It composes `@caisson/local-ai` only; the `@caisson/*`
packages stay framework-free.

## What it demonstrates (the P4a exit gate)

One offline pass (`app/demo/pipeline.ts`, surfaced by the `/` page and the `GET /api/demo` route):

1. **Hybrid retrieval** — sqlite-vec KNN + FTS5 fused by RRF (RRF_K=60), and the FTS5-only degrade.
2. **At-rest field-crypto + file-per-tenant isolation** — a sensitive column is sealed under a
   per-tenant derived key; a tenant-B context cannot open a tenant-A row (AEAD auth-fail).
3. **Offline Ed25519 license verify** — a valid token resolves to `pro`; tampered/absent fail safe
   to `community`. Zero network.
4. **Two-way sync convergence** — two device replicas reconcile concurrent edits + a delete to a
   byte-equal state (LWW/CRDT + tombstone, no resurrection) over a test-doubled transport.
5. **Zero-egress privacy gate** — the empty-allowlist policy blocks every host; the whole pass makes
   no outbound fetch (asserted by `app/demo/pipeline.test.ts`).

## Run

```bash
bun run --filter @caisson/local-ai-app dev    # http://localhost:3040
bun run --filter @caisson/local-ai-app test   # the offline + zero-egress proof
```

The native sqlite-vec extension + bun:sqlite live behind the externalized `@caisson/*` packages
(`serverExternalPackages` in `next.config.ts`), so `next build` never bundles a native/Bun module and
the live model fetch / rented backend stay the only un-exercised paths.

## Reconciliation note (`specs/01` §2)

`specs/01-architecture.md` says the execution plane uses "hosted inference via API (no local
models)". That governs the **seller platform's** Python plane (support-bot + buyers' optional cloud
workers) — **not** this buyer-side local-first edition, which ships **real on-device models** behind
the zero-egress gate. No tension: different planes.
