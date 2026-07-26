# LANE-A PLAN — Code residuals and the provider adapter wave

- **SPEC:** `/home/gw/lab/caisson/outputs/specs/full-state-completion/SPEC.md`
- **Decisions:** ADR-0379 (program) · ADR-0380 (fork locks 1–5, 8)
- **Branch:** `feature/completion-lane-a`, based on `feature/full-state-completion`
- **Worktree:** `/home/gw/lab/caisson-lane-a`
- **Engine:** codex `gpt-5.6-sol`, `model_reasoning_effort=ultra`, two parallel sub-lanes
- **Output:** one PR, pushed not merged (ADR-0328)

## Sub-lane split (tree-disjoint inside the worktree)

| Sub-lane  | Tree        | Tasks             |
| --------- | ----------- | ----------------- |
| **A-app** | `apps/`     | A1 → A2 · A3 · A4 |
| **A-pkg** | `packages/` | A5 · A6 · A7      |

A1 is the shared seam both A3 and A4 consume — it lands before either starts. A2 is independent of
A1 and may start immediately. Inside A-pkg, A5/A6/A7 touch different packages and run concurrently.

## Tasks

### A1 — Internal proof proxy seam (ADR-0380 lock 2)

An authenticated internal endpoint that owns the WORM credential and reuses
`/home/gw/lab/caisson/apps/admin/src/lib/audit-proof.ts`'s proof-assembly transform. Callers pass a
server-derived account id plus a service credential; the proxy never accepts a client-supplied
account. Bearer comparison uses `crypto.timingSafeEqual`; the route is not publicly bound.

- **Evidence:** route tests for authenticated success, missing/invalid credential, cross-account
  refusal, and absent-key `NotFoundError` mapping.

### A2 — Admin proof viewer and export (T5B, ADR-0380 lock 1)

Wire `apps/admin` `business/audit/page.tsx`: six-state row chips computed server-side for the
rendered window, expand-to-`ProofPanel` fetching each proof lazily through
`GET /api/admin/audit/proof`, the anchor-provenance header, and an export action returning the
`EvidencePack` file map plus its `sha256` verbatim — no archive transport. The payload viewer's
redaction affordance counts **distinct redacted key paths**.

- **Evidence:** component/route tests, an export test asserting the digest matches
  `buildEvidencePack` output byte-for-byte, and a redaction-count test with a field repeating across
  rows (the count stays 1).

### A3 — Tenant self-service proof route (T5C, GATE-2 / ADR-0344 §3)

Session-derived, RLS-scoped tenant proof route in `apps/site` plus its dashboard view, reading
through A1. No object-store credential in the site process.

- **Evidence:** auth, RLS scoping, cross-tenant refusal, redaction, and fail-closed tests.

### A4 — Buyer-dashboard crosswalk (T5E, ADR-0380 lock 3)

Read the persisted latest evidence-pack pointer through A1 and render `maps-to` and `implements` as
separately labeled edge kinds. No aggregate coverage number is computed or displayed.

- **Evidence:** real-pack mapper tests, a claim-posture test asserting the two edge kinds are never
  summed, and a11y coverage.

### A5 — Inngest v4 jobs adapter (T6A)

`createInngestJobQueue` behind the existing jobs port with an injected client, strict config
validation, and gated live tests. No ambient credential reads.

- **Evidence:** shared jobs conformance suite plus targeted adapter tests.

### A6 — KMS deletion receipt + Azure Key Vault adapter (T6B, ADR-0380 lock 4)

Widen `KmsClient.scheduleKeyDeletion` from `Promise<void>` to a receipt carrying the proven
destruction state, update all existing adapters (AWS, GCP, local) to report their real state, thread
the state through `cryptoShred` into the `erasure.crypto-shred` audit payload, then add
`createAzureKeyVaultKmsClient`. A pending, cancellable or recoverable deletion is never reported as
irreversible.

- **Evidence:** KMS conformance suite, per-adapter state tests (AWS pending window, GCP scheduled
  destroy, Azure soft-delete vs purge), a crypto-shred payload test, and a golden re-bless.
- **Note:** breaking contract change — every affected package needs a changeset.

### A7 — Artifact version identity + Azure Blob WORM adapter (T6C, ADR-0380 lock 5)

Add the optional version identifier to `ArtifactMeta`, populate it on backends that support
versioned immutability, and target the recorded version on reads and retention extensions. Backends
without versioning leave it absent. Then add `AzureBlobArtifactStore` with create-only upload,
read-back immutability, monotonic retention extension, and fail-closed behavior on unsupported
accounts (ADR-0379 lock 9).

- **Evidence:** artifact-store conformance across all backends, immutability and monotonicity tests,
  an absent-version test for non-versioned backends, and gated live tests.

## Order

```text
A1 -> {A3, A4}
A2 independent
{A5 || A6 || A7} independent of the app sub-lane
all -> reconcile -> gates -> PR
```

## Gates before the PR

`bun run check` · `bun run format:check` · `bun run sot` · changesets for every touched package ·
in-session SHIP audit lane (`gw-code-reviewer` plus `gw-security-auditor` on the KMS, proxy, and
tenant-proof seams).

## Out of scope

T4 fleet reconciliation, migration 0030, deploys, restarts, tags, publishes, and any commerce
change stay held behind their operator gates. `substrate.field-crypto-policy` stays open. The three
module-depth pages belong to lane B.
