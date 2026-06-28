# AGENTS — @caisson/local-ai

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a buyer
composing this edition must know. This is the **Local-first AI edition** — a COMPOSITION of shipped
base primitives, not a fork (ADR-0003/0064/0067).

## Invariants (do not violate)

- **Compose DOWN-ONLY; never rebuild a base.** The edition imports `@caisson/local-store`,
  `@caisson/license-verify`, `@caisson/field-crypto`, and `@caisson/kernel` and never depends "up" on
  a peer edition (ADR-0003/0022). The down-only edge is enforced by `.dependency-cruiser.cjs`
  (`down-only-no-base-to-edition`) + the edition-isolation rules — `bunx depcruise` must stay 0
  violations. Do not re-implement hybrid retrieval, the license verifier, or field-crypto here.
- **Zero-egress by default (TM-EGRESS).** Every outbound call routes through the kernel
  `fetchWithTimeout` chokepoint behind the privacy/egress gate; a non-allowlisted host is hard-blocked
  and an empty allowlist means zero egress — fail-closed-to-offline, never a silent fallback to a
  hosted provider. No raw `fetch`, no `AbortSignal.timeout`.
- **File-per-tenant is the isolation boundary (TM-ISO).** The resolved SQLite file path IS the tenant
  boundary (ADR-0073); `tenant_id` is a trusted server-derived seam, never user-supplied. Reject
  `..`/null bytes/absolute paths; `path.resolve` then assert the result stays under the tenant-data
  root joined with `path.sep`. A cross-tenant query is unexpressible because each tenant is a separate file.
- **At-rest crypto reuses field-crypto (TM-REST).** Sensitive columns are sealed/opened via the
  `@caisson/field-crypto` seams under a local per-tenant-derived key (`tenant_id` bound into HKDF
  `info`); opening tenant B's file cannot return tenant A's plaintext. No second crypto stack.
- **License verify is offline + fail-safe (TM-LIC).** Gate paid surfaces ONLY on
  `verifyLicense(...).valid === true` with the required tier/entitlement (the SIGNED tier is
  authority; the wire prefix is cosmetic). `verifyLicense` never throws — default-deny on everything
  else.
- **No live network/model/cloud in CI.** The `InferenceBackend`, the sync transport, and the
  first-run model fetch are all PORTS — test-doubled in CI. The live transport is the only
  un-exercised path. Integer credits, `crypto.randomUUID()` IDs, Zod `.strict()` at every boundary.

## Public surface (T9 — composed base seams)

At this scaffold the barrel (`src/index.ts`) re-exports the composed seams the edition is built on;
edition-only surface (tenancy resolver, at-rest, inference port, privacy gate, sync engine, migration
assembly) is appended as each task lands.

- From `@caisson/local-store`: `LocalStore`, `RRF_K`, `tenantDbPath`, `openTenantDb` (+ `StoreDoc` /
  `HybridSearchOptions` / `SearchHit`).
- From `@caisson/license-verify`: `verifyLicense`, `decodeToken`/`encodeToken`, the strict
  claims/tier schema, `LICENSE_TIERS`, `COMMUNITY_TIER`.
- From `@caisson/field-crypto`: `DerivedKeyProvider`, `deriveTenantKey`, `sealField`/`openField`,
  `encryptedColumn` (+ the `FieldKeyProvider`/`SyncFieldKeyProvider`/`AeadCipher` seams).
- From `@caisson/kernel`: `canonicalize`, `fetchWithTimeout`, `assembleMigrations`.

## Golden

No golden output yet (the manifest `golden` is null). The two-way-sync conflict goldens
(`src/sync/__golden__`) are authored golden-before-logic in a later task and asserted with `BLESS`
unset.

## Out of scope

The license ISSUER + live credit debit for rented inference (P6 commerce); a shipped desktop shell
(Electron/Tauri are buyer-side compositions — the reference app is a localhost Next server,
ADR-0044); a local MCP server (deferred); a true-ANN engine (brute-force KNN is v1, ANN is the
documented upgrade behind the same seam); DEPLOY (SHIP stops at the merged PR).
