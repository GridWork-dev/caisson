# SPEC — Wave 1 · P2: Compliance edition (the hero)

Act 1 (SPEC) of the 7-act cycle for the Compliance edition — the lead edition (ADR-0040). Bound by
the locked ADRs cited below (do not relitigate). Build proceeds per `plan.md §P2` after this kickoff.

## Goal

Ship the **Compliance hero**: a buyer seeds a tenant, writes encrypted SEC/HIPAA fields under a
tenant-scoped crypto boundary, locks an append-only artifact version into WORM storage with a
SHA-256 audit-chain anchor, and emits a **deterministic, signed, control→evidence pack** that
**validates against a golden fixture** — and that **refuses to generate** when any control's
evidence is missing (flag, never guess). P2 is mostly WIRING of green Wave-0 primitives
(`kernel` audit-chain/versioning, the whole `field-crypto` package) plus the **one net-new build**:
a generic control-evidence-pack generator. VERIFY re-asks this exact sentence against the diff.

## Tags

`security` · `secrets` · `data-migration` (append-only + RLS + grant-revoke migrations) ·
`infra` (WORM / S3 Object-Lock store + CI seam-doubling) · `ui` (apps/compliance). Drives SHIP
audits: **SECURITY audit** (security/secrets), **migration-safety + rollback** (data-migration),
**infra review** (WORM/S3), **UI review** (apps/compliance). No `ai` tag → no EVAL act.

## Scope

**Creates (NEW primitive)** `@caisson/audit-worm` — owns the stateful WORM + chain + version DB
layer: `ArtifactStore` port + `LocalArtifactStore` (dev) + seam-tested `S3ArtifactStore` (prod),
append-only Postgres chain-entry table + WORM length-keyed anchor, append-only version table.
**Creates (NEW edition)** `@caisson/compliance` — control registry (`defineControl`/`defineFramework`),
own-authored SOC2-TSC + HIPAA packs + EU-AI-Act named slot, evidence collectors, the deterministic
signed evidence-pack generator, the `withTenantCrypto` composition helper.
**Extends** `@caisson/field-crypto` — DB-backed key/DEK stores, row-bound `encryptField(…,rowId)`,
stored-DEK crypto-shred (ADR-0055). **Creates (exit artifact)** `apps/compliance` (Next.js App
Router, ADR-0044) — the thin reference app that emits + validates one evidence pack.
**Consumes (down-only)** the base `EventSink` port (ADR-0075) for operational events only.

**OUT of scope:** evidence generation is **FREE in v1 — no `@caisson/credits`/402 in P2** (ADR-0007
unit deferred to P6 per the open Pricing fork). No buyer dashboard (thin wiring shell only, P2-19a).
No live cloud (S3 / KMS / RFC-3161 all test-doubled). No OSCAL-native v1 artifact (export = un-wired
seam). No DSSE/Sigstore/Rekor (premium seam). No EU-AI-Act control content (empty manifest only). No
SCF ingest of any kind. No DEPLOY — SHIP stops at the merged PR.

## Locked decisions implemented

| ADR                                     | Requires in code                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0051** WORM retention mode            | `S3ArtifactStore` `mode` option: **GOVERNANCE default everywhere**; **COMPLIANCE per-evidence-class, opt-in** behind a typed irreversible-opt-in guard; **never COMPLIANCE** in `LocalArtifactStore`/test; DB `retain_until` == S3 `RetainUntilDate`.                                                                                                                                                           |
| **0052** chain entry+anchor persistence | Entries → append-only PG table (immutable by withheld `UPDATE`/`DELETE` GRANT); `anchorChain()` mints `{length,tipHash,genesisHash}` per append → WORM under a **length-keyed write-once** key; `verifyChain(entries,anchor)` reads both; per-tenant appends serialize via `pg_advisory_xact_lock` **or** unique `(account_id,seq)`+`23505`→`ConflictError`; payload `canonicalize`d.                           |
| **0053** version DB schema              | One append-only version table; **`REVOKE UPDATE,DELETE`** from the app role; `supersedes_id` FK validated by `kernel/versioning.ts` on read; **`current` DERIVED** (no-successor SQL predicate, never stored); `provenance` JSONB **Zod `.strictObject` parsed pre-INSERT**.                                                                                                                                    |
| **0054** WORM ArtifactStore             | `ArtifactStore` port (`put`/`get`/`head` + retention meta); prod `S3ArtifactStore` over real `@aws-sdk/client-s3` (Object-Lock; `IfNoneMatch:'*'` 412→`ArtifactExistsError`) **unit-tested against an injected `S3Sendable` stub, no live CI call**; dev `LocalArtifactStore`; **`{account_id}/…` key prefix + `assertSafeKey`**; 6–7yr retention floor via `retainUntilFrom`.                                  |
| **0055** field-crypto P2                | Stored per-tenant/subject DEK behind `KmsKeyProvider` → `kms schedule-key-deletion` crypto-shred + `erasure.crypto-shred` audit event; **chained PII committed as ciphertext**; **`encryptField(ctx,columnContext,rowId,plaintext)`** with AAD `tenant∥kv∥column∥rowId` **required for SEC/HIPAA columns**; `crypto.randomUUID()` PKs on those tables. Base stays derived (ADR-0043).                           |
| **0056** evidence-pack signing          | **Per-tenant Ed25519** (`@noble/ed25519`, distinct from the Caisson license key) — **detached** signature over `canonicalize(manifest) ∥ chain-anchor tipHash`; **RFC-3161** timestamp countersign (test-doubled); signer **behind a port** (buyer-KMS drop-in).                                                                                                                                                |
| **0057** control model                  | **Clean-room own-authored** SOC2-TSC + HIPAA catalog — canonical control set + per-framework crosswalk packs; **NEVER ingest/copy/transform SCF CC-BY-ND JSON**; typed `defineControl`/`defineFramework` + Zod `.strict()`, golden-fixtured; EU-AI-Act = reserved empty named slot.                                                                                                                             |
| **0058** evidence-pack format           | Typed canonical `manifest.json` (control→evidence index) + per-control evidence + auditor summary; **canonical body excludes timestamp+signature** (injected at the edge), `canonicalize`d → byte-stable golden; **flag-never-guess** (UNRESOLVED hard-blocks → throws, no partial pack; FLAGGED needs recorded reason); **readiness/posture copy, never "compliant/certified"**; OSCAL export = un-wired seam. |

## Consumed seams (down-only — a package NEVER depends up on an edition, ADR-0003/0022)

- `packages/kernel/src/audit-chain.ts` — `canonicalize`, `chainEntry`, `anchorChain`, `verifyChain(entries,anchor)`, `AuditChainAnchor` (reused **verbatim**; audit-worm adds only the DB+WORM persistence).
- `packages/kernel/src/versioning.ts` — `validateVersionSet`/`isCurrent`/`currentVersions`/`versionChain` (reused verbatim over the version table).
- `packages/kernel/src/errors.ts` — `CaissonError` hierarchy (`ConflictError`, `NotFoundError`, `ValidationError`, `InternalError`); plus `EventSink` base port (ADR-0075).
- `packages/field-crypto/src/{column,provider,kms,aad,registry}.ts` — `encryptedColumn`/`withFieldCryptoContext`/`derivedContext`/`sealField`/`openField`, `SyncFieldKeyProvider`, `KmsKeyProvider`/`WrappedKeyStore`/`KmsClient`/`LocalKmsClient`, `buildAad`, `KeyVersionRegistry`.
- `packages/tenancy-rls/src/rls.ts` — `withTenant`, `buildTenantPolicySql`, `TENANT_GUC` (the encryption boundary EQUALS the RLS boundary, ADR-0005).
- **NOT consumed:** `@caisson/credits` (evidence FREE in v1). Dep graph: `compliance → {audit-worm, field-crypto, tenancy-rls, kernel}`; `audit-worm → {kernel, tenancy-rls}`; `field-crypto → {kernel}` (stays kernel-only).

## Exit gate

DONE when, with `BLESS` unset and **no live cloud call in CI**: (1) `bun install` clean; `bun run gate`

- `bun run check` green; `depcruise` proves the down-only graph above. (2) An append-only artifact
  version locks **immutable + hash-chained** — a PGlite integration test proves `UPDATE`/`DELETE` is
  refused under `SET ROLE app` and `verifyChain(entries,anchor)` catches tamper/truncation/rewrite.
  (3) A SEC/HIPAA field **round-trips** through `encryptField(…,rowId)` and a **cross-row relocate
  fails to authenticate**; a crypto-shred renders a subject's ciphertext unrecoverable while
  `verifyChain` still passes. (4) The **evidence pack validates against its golden fixture** (canonical
  body byte-stable; signature + timestamp asserted in their own layers) and the **BLOCKED-case golden**
  proves an unresolved flag **throws with no partial pack written**. (5) `apps/compliance` runs the
  full leg (seed → encrypt → lock-to-WORM+anchor → emit → validate) end to end. (6) `audit-worm` +
  `compliance` each ship through `tooling/` with a manifest + golden dir + AGENTS.md; new ADRs already
  locked (0051–0058); PR open + CI green; no service restarted.
