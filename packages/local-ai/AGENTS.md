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
- **Zero-egress by default.** Every outbound call routes through the kernel
  `fetchWithTimeout` chokepoint behind the privacy/egress gate; a non-allowlisted host is hard-blocked
  and an empty allowlist means zero egress — fail-closed-to-offline, never a silent fallback to a
  hosted provider. No raw `fetch`, no `AbortSignal.timeout`.
- **File-per-tenant is the isolation boundary.** The resolved SQLite file path IS the tenant
  boundary (ADR-0073); `tenant_id` is a trusted server-derived seam, never user-supplied. Reject
  `..`/null bytes/absolute paths; `path.resolve` then assert the result stays under the tenant-data
  root joined with `path.sep`. A cross-tenant query is unexpressible because each tenant is a separate file.
- **At-rest crypto reuses field-crypto.** Sensitive columns are sealed/opened via the
  `@caisson/field-crypto` seams under a local per-tenant-derived key (`tenant_id` bound into HKDF
  `info`); opening tenant B's file cannot return tenant A's plaintext. No second crypto stack.
- **License verify is offline + fail-safe.** Gate paid surfaces ONLY on
  `verifyLicense(...).valid === true` with the required tier/entitlement (the SIGNED tier is
  authority; the wire prefix is cosmetic). `verifyLicense` never throws — default-deny on everything
  else.
- **No live network/model/cloud in CI.** The `InferenceBackend`, the sync transport, and the
  first-run model fetch are all PORTS — test-doubled in CI. The live transport is the only
  un-exercised path. Integer credits, `crypto.randomUUID()` IDs, Zod `.strict()` at every boundary.

## Public surface (`src/index.ts`)

Composed base seams:

- From `@caisson/local-store`: `LocalStore`, `RRF_K`, `tenantDbPath`, `openTenantDb` (+ `StoreDoc` /
  `HybridSearchOptions` / `SearchHit`).
- From `@caisson/license-verify`: `verifyLicense`, `decodeToken`/`encodeToken`, the strict
  claims/tier schema, `LICENSE_TIERS`, `COMMUNITY_TIER`.
- From `@caisson/field-crypto`: `DerivedKeyProvider`, `deriveTenantKey`, `sealField`/`openField`,
  `encryptedColumn` (+ the `FieldKeyProvider`/`SyncFieldKeyProvider`/`AeadCipher` seams).
- From `@caisson/kernel`: `canonicalize`, `fetchWithTimeout`, `assembleMigrations`.

Edition-only surface:

- **At-rest store:** `AtRestStore` (`src/crypto/at-rest.ts`) — seals/opens a sensitive column under a
  per-tenant derived key before it touches the SQLite file.
- **Inference:** the `InferenceBackend` port + its backends (`src/inference/`) —
  `StubInferenceBackend` (deterministic, CI-only), `OnnxEmbeddingBackend` (the real on-device
  embedding backend, first-run model fetch), `RentedInferenceBackend` + `createLiveRentedTransport`
  (the hosted-inference seam), and three concrete rented transports:
  `createOpenRouterRentedTransport`, `createAzureOpenAIRentedTransport`,
  `createBedrockRentedTransport` (hand-rolled AWS SigV4, no `@aws-sdk` dependency). Ollama is
  self-hosted and unmetered, so it stays outside the rented-transport surface.
- **Privacy / egress gate:** `EgressGuard`/`createEgressGuard` + `parsePrivacyPolicy`,
  `localOnlyPolicy`, `ZERO_EGRESS_POLICY`, the policy/sink/mode schemas, `SANCTIONED_SINK_KINDS`,
  `PRIVACY_MODES` (`src/privacy/`).
- **Sync engine:** `ChangesetLog`/`parseChangeset`, `reconcileReplicas`, `reconcileWithTombstones`/
  `gcTombstones`, `compareStamps`/`stampFromEntry` (`src/sync/`) — per-tenant changeset capture, a
  fail-closed peer-boundary parse, and a persistent LWW/CRDT-with-tombstones reconcile. The local
  store is the convergence target; peers move toward it.
- **Migration assembly:** `migrate`, `assembleEditionMigrations`, `editionMigrations`
  (`src/store/migrate.ts`) — the ordered, idempotent `schema_version` ledger composing local-store's
  retrieval tables with the edition's own tables into one down-only sequence.

## Golden

The two-way-sync conflict goldens (`src/sync/__golden__/lww-resolve.json`,
`tombstone-resolve.json`) are asserted via `matchGolden`; update only with `BLESS=1`.

## Out of scope

The license ISSUER + live credit debit for rented inference (that's a commerce-side concern, not
this package); a shipped desktop shell (Electron/Tauri are buyer-side compositions — the reference
app is a localhost Next server, ADR-0044); a local MCP server (deferred); a true-ANN engine
(brute-force KNN is v1, ANN is the documented upgrade behind the same seam).
