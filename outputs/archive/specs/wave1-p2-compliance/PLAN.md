# PLAN — Wave 1 · P2: Compliance edition (the hero)

Act 2 (PLAN) for `outputs/specs/wave1-p2-compliance/SPEC.md`. Atomic tasks, one commit each, in
dependency order. Every task lists its verify command(s); iterate to green before committing. Every
task: TS-strict · Bun (never npm/yarn) · Zod `.strict()` at boundaries · no `any`/`console.log` ·
`crypto.randomUUID()` PKs · `crypto.timingSafeEqual` for secret/sig compares · `fetchWithTimeout` on
any outbound fetch · integer units · **fail-closed** · **no live cloud/KMS/network in CI (test-doubled)**.
Each new package ships through `tooling/` with a manifest + golden dir + down-only `depcruise` entry.

**Build-order rationale.** `kernel` + `field-crypto` are green leaves. Two primitives fan out in
parallel — `audit-worm` (A) and the `field-crypto` P2 extension (B) — both depend only on `kernel`
(+ `tenancy-rls`) and their own tree. The `compliance` edition (C) composes both; its control
catalog (C1–C3) is pure config and can author in parallel with A/B, but the **evidence generator is
the convergence point** and obeys golden-file-before-logic (ADR-0013/0058): the format + BLOCKED
goldens land BEFORE generator logic. `apps/compliance` (D) is last — it wires the whole leg.

---

## A — `@caisson/audit-worm` primitive (WORM store + chain + version DB) · scope `audit-worm`

### T1 — ArtifactStore port + LocalArtifactStore + retention helper

- Creates: `packages/audit-worm/src/store.ts` (`ArtifactStore` port: `put`/`get`/`head` carrying retention meta + `assertSafeKey` `{account_id}/…` guard), `src/store.local.ts` (`LocalArtifactStore`, **retention-ignored** fs store), `src/retain.ts` (`retainUntilFrom(now, years)` calendar-correct, 6–7yr HIPAA/SEC floor), `src/store.test.ts`, `src/retain.test.ts`.
- ADR: 0054. Verify: `bun test packages/audit-worm/src/store.test.ts packages/audit-worm/src/retain.test.ts`.
- Routing: `gw-typescript-pro` / **sonnet** (bounded ~200 LOC).

### T2 — S3ArtifactStore (seam-tested) + GOVERNANCE/COMPLIANCE mode guard

- Creates: `packages/audit-worm/src/store.s3.ts` (`S3ArtifactStore` over `@aws-sdk/client-s3`; write-once via `IfNoneMatch:'*'` → 412 `ArtifactExistsError`; `ObjectLockMode`+`RetainUntilDate`; **GOVERNANCE default**, **COMPLIANCE only via typed `irreversibleOptIn` guard**, refuses COMPLIANCE outside a real deployment), `src/store.s3.test.ts` (injected `S3Sendable = Pick<S3Client,"send">` stub — **no live call**; assert 412→error, mode plumbing, never-COMPLIANCE-in-test).
- ADR: 0054, 0051. Verify: `bun test packages/audit-worm/src/store.s3.test.ts`.
- Routing: **sonnet** (bounded; the live transport is the only un-exercised path). **Threat: TM-A (COMPLIANCE footgun), TM-C (cross-tenant key), TM-G (live cloud in CI).**

### T3 — append-only audit-chain entry table + WORM anchor + serialization

- Creates: `packages/audit-worm/src/chain-store.ts` (`appendEntry` writes an append-only PG row, `canonicalize`s payload, mints `anchorChain()` per append → `ArtifactStore.put` under a **length-keyed write-once** key; `loadChain`+`verifyAnchored` call `verifyChain(entries,anchor)`; per-tenant serialize via `pg_advisory_xact_lock` or unique `(account_id,seq)`+`23505`→`ConflictError` retry), `src/migrations/0001_audit_chain.sql` (table + `buildTenantPolicySql` ENABLE+FORCE RLS + **withhold `UPDATE`/`DELETE` GRANT**), `src/chain-store.integration.test.ts` (PGlite under `withTenant`/`SET ROLE app`).
- ADR: 0052, 0014. Consumes: `kernel/audit-chain.ts`, `tenancy-rls`, `store.ts` (T1). Verify: `bun test packages/audit-worm/src/chain-store.integration.test.ts`.
- Routing: **opus main-thread** (cross-package: chain×WORM×RLS×advisory-lock, security-bearing). **Threat: TM-D (immutability bypass), TM-H (anchor overwrite), TM-I (tamper/truncation/rewrite).**

### T4 — append-only locked-version table + derived current

- Creates: `packages/audit-worm/src/version-store.ts` (`insertVersion` parses `provenance` via Zod `.strictObject` **pre-INSERT**, `supersedes_id` FK; `currentVersion` = **no-successor SQL predicate**; reads validated by `kernel/versioning.ts validateVersionSet`), `src/migrations/0002_versions.sql` (append-only table + `REVOKE UPDATE,DELETE` from app role + RLS policy; optional `BEFORE UPDATE/DELETE RAISE` trigger belt), `src/version-store.integration.test.ts` (PGlite: insert+supersede, `UPDATE`/`DELETE` refused under `SET ROLE app`, derived current never drifts).
- ADR: 0053, 0014. Consumes: `kernel/versioning.ts`, `tenancy-rls`. Verify: `bun test packages/audit-worm/src/version-store.integration.test.ts`.
- Routing: **sonnet** (bounded schema + store). **Threat: TM-D (immutability bypass).**

### T5 — audit-worm manifest + barrel + package wiring (gate-blocking)

- Creates: `packages/audit-worm/manifest.ts` (`defineModule` `kind:"primitive"`, `tier:"paid"`, `priceCents` placeholder `4900` pending the open Pricing lock, `license:"LicenseRef-Caisson-Commercial"`, `dependencies:["@caisson/kernel","@caisson/tenancy-rls"]`, `golden:"src/__golden__"`), `src/index.ts` barrel, `src/__golden__/anchor.json`, `package.json`/`tsconfig.json`/`eslint.config.js`/`AGENTS.md`/`README.md`; depcruise down-only entry.
- ADR: 0021 (P2-21). Verify: `bun run gate` (manifest↔package.json agreement); `bunx eslint packages/audit-worm`; depcruise green.
- Routing: **sonnet** (config/wiring); AGENTS.md/README prose → **haiku** sub-step.

---

## B — `@caisson/field-crypto` P2 extension · scope `field-crypto` (parallel with A)

### T6 — DB-backed KeyVersionStore + WrappedKeyStore (FORCE-RLS, append-only)

- Creates: `packages/field-crypto/src/store.pg.ts` (`PgKeyVersionStore` + `PgWrappedKeyStore` over `field_key_version(account_id,key_version,…)` + `field_wrapped_dek(account_id,key_version,wrapped bytea)`, **append-only per version**, through `withTenant`), `src/migrations/0001_field_keys.sql` (`buildTenantPolicySql` ENABLE+FORCE RLS), `src/store.pg.integration.test.ts` (PGlite under `withTenant`: persist current version + wrapped DEK; old versions stay decryptable — lazy re-encrypt).
- ADR: 0055 (P2-7), 0043, 0014. Implements the `WrappedKeyStore` interface already in `kms.ts:24`. Verify: `bun test packages/field-crypto/src/store.pg.integration.test.ts`.
- Routing: **sonnet** (bounded store + migration).

### T7 — row-bound `encryptField(…,rowId)` AAD (SEC/HIPAA columns)

- Edits: `packages/field-crypto/src/aad.ts` (extend to a 4-tuple `tenant∥kv∥column∥rowId`). Creates: `src/encrypt-field.ts` (`encryptField(ctx,columnContext,rowId,plaintext)` / `decryptField(ctx,columnContext,rowId,stored)`, fail-closed; doc the **`crypto.randomUUID()` PK** requirement so `rowId` exists pre-INSERT), `src/encrypt-field.test.ts` (round-trip; **cross-row relocate → auth-fail**; cross-column/tenant still fail), golden `src/__golden__/row-aad-envelope.json`. Export from `src/index.ts`.
- ADR: 0055 (P2-10, closes Wave-0 TM2). Verify: `bun test packages/field-crypto/src/encrypt-field.test.ts`. **Threat: TM-E (cross-row relocate).**
- Routing: **sonnet** (bounded crypto API). Keep transparent `encryptedColumn` unchanged for low-sensitivity fields.

### T8 — stored-DEK crypto-shred + `erasure.crypto-shred` event

- Edits: `packages/field-crypto/src/kms.ts` (add `scheduleKeyDeletion(tenantId|subjectId)` to the `KmsClient` port + `KmsKeyProvider`; `LocalKmsClient` test double; documented `awsKmsClient` seam). Creates: `src/crypto-shred.ts` (orchestrates DEK deletion → emits an `erasure.crypto-shred` audit payload; **chained PII is committed as ciphertext** so `verifyChain` survives shred), `src/crypto-shred.test.ts` (shred renders ciphertext unrecoverable; chain over ciphertext still verifies; **no live KMS**).
- ADR: 0055 (P2-9), 0052. Verify: `bun test packages/field-crypto/src/crypto-shred.test.ts`. **Threat: TM-F (DEK leak / chained-plaintext exposure on erasure), TM-G (live KMS in CI).**
- Routing: **opus main-thread** (security design: erasure ↔ immutable chain reconciliation; cross-cutting).

---

## C — `@caisson/compliance` edition (control model + evidence engine) · scope `compliance`

### T9 — control registry builder (`defineControl`/`defineFramework`)

- Creates: `packages/compliance/src/registry/control.ts` (`defineControl`/`defineFramework` typed builders + Zod `.strict()`; canonical-control + crosswalk-reference shape), `src/registry/control.test.ts`, golden `src/__golden__/sample-control.json`.
- ADR: 0057 (P2-11). Mirrors the `defineModule` precedent; depends only on `kernel`. Verify: `bun test packages/compliance/src/registry/control.test.ts`.
- Routing: **sonnet** (bounded builder). Runs parallel with A/B.

### T10 — SOC2-TSC + HIPAA control packs + EU-AI-Act empty slot (clean-room)

- Creates: `packages/compliance/src/frameworks/soc2-tsc.ts`, `src/frameworks/hipaa-security.ts` (**own-authored** canonical controls + crosswalk references — **NEVER ingest/copy/transform SCF CC-BY-ND JSON**; SCF consulted for coverage/structure only), `src/frameworks/eu-ai-act.ts` (named manifest only, `golden:null`, **no control content** — Annex IV headings), golden `src/__golden__/{soc2-tsc,hipaa-security}.catalog.json`.
- ADR: 0057 (P2-12/P2-18). Verify: `bun test packages/compliance/src/frameworks`. **Threat: TM-J (SCF licensing breach — flag-never-guess, no auto-pull).**
- Routing: **opus main-thread** (licensing-sensitive clean-room authoring judgment; content is context-bearing). Depends on T9.

### T11 — evidence collector interface + substrate collectors

- Creates: `packages/compliance/src/evidence/collector.ts` (declarative typed `EvidenceCollector` → `{item, status: "pass"|"flagged"|"unresolved"}` + manual-attachment slots), `src/evidence/collectors/{rls-force,chain-verify,worm-retention}.ts` (read base facts: FORCE-RLS policy present, `verifyChain(entries,anchor)`, WORM `retain_until`), `src/evidence/collector.test.ts`.
- ADR: 0058 (P2-13). Consumes: `audit-worm` (T3/T4), `tenancy-rls`. Verify: `bun test packages/compliance/src/evidence/collector.test.ts`.
- Routing: **sonnet** (bounded interface + collectors). Depends on T3, T4, T9.

### T12 — evidence-pack GOLDEN fixtures (BEFORE generator logic — ADR-0013/0058)

- Creates: golden `packages/compliance/src/__golden__/evidence-pack.manifest.json` (canonical control→evidence body, **timestamp+signature EXCLUDED**, `canonicalize`d), golden `src/__golden__/evidence-pack.blocked.json` (the unresolved-flag BLOCKED case), `src/evidence/pack-format.ts` (the typed manifest schema, Zod `.strict()`, **no assembly logic yet**), `src/evidence/pack-format.test.ts`.
- ADR: 0058. **Golden-file-before-logic gate** — this task PRECEDES T13. Verify: `BLESS= bun test packages/compliance/src/evidence/pack-format.test.ts` (goldens matched unset).
- Routing: **opus main-thread** (defines the determinism contract that gates the generator). Depends on T9/T11 (control + collector shapes).

### T13 — evidence-pack generator (the net-new build)

- Creates: `packages/compliance/src/evidence/generate.ts` (assemble `manifest.json` + per-control evidence + auditor summary; **clock injected at the edge**; **deterministic ZIP** — fixed epoch mtimes, sorted entries, fixed compression — so the pack sha256 is byte-stable; **flag-never-guess**: UNRESOLVED **throws, no partial pack**; FLAGGED requires a recorded resolution reason in provenance; **readiness/posture output copy, never "compliant/certified"**, flagged → gap/POA&M item), `src/evidence/generate.test.ts` (asserts byte-stable body == T12 golden; BLOCKED case throws with nothing written).
- ADR: 0058 (P2-14/P2-15/P2-17/P2-23). Consumes: `kernel canonicalize`, T11 collectors, T12 format. Verify: `BLESS= bun test packages/compliance/src/evidence/generate.test.ts`. **Threat: TM-K (false attestation / silent inference).**
- Routing: **opus main-thread** (largest net-new, cross-package). Depends on T11, T12.

### T14 — evidence-pack signing (per-tenant Ed25519 + RFC-3161)

- Creates: `packages/compliance/src/evidence/sign.ts` (`Signer` port + `Ed25519Signer` via `@noble/ed25519`; **detached** signature over `canonicalize(manifest) ∥ anchor.tipHash`; **per-tenant key, distinct from the Caisson license key**; RFC-3161 timestamp countersign **test-doubled**; buyer-KMS Sign = documented seam; DSSE/Sigstore = un-wired premium seam), `src/evidence/sign.test.ts` (deterministic sign with a fixed golden test key; verify via the one shared `@noble/ed25519` primitive; `timingSafeEqual` on the sig compare), golden `src/__golden__/signed-manifest.sig`.
- ADR: 0056. Verify: `bun test packages/compliance/src/evidence/sign.test.ts`. **Threat: TM-L (evidence-pack forgery), TM-M (wrong signing identity / live RFC-3161 in CI).**
- Routing: **sonnet** (bounded crypto impl). Depends on T13.

### T15 — OSCAL export adapter (un-wired seam)

- Creates: `packages/compliance/src/evidence/oscal-export.ts` (SAR/POA&M `EXPORT` adapter as a plain seam-tested function; `// P7:` wire hook, no transport), `src/evidence/oscal-export.test.ts`.
- ADR: 0058 (export seam, `kms.ts`/ADR-0047 ethos). Verify: `bun test packages/compliance/src/evidence/oscal-export.test.ts`.
- Routing: **sonnet** (bounded). Independent of T14 (can parallel).

### T16 — `withTenantCrypto` composition helper (boundary == boundary)

- Creates: `packages/compliance/src/with-tenant-crypto.ts` (`withTenantCrypto(db, accountId, provider, fn)` nests `withFieldCryptoContext(derivedContext(provider, accountId))` **inside** `withTenant` — keeps `field-crypto` kernel-only per ADR-0003), `src/with-tenant-crypto.integration.test.ts` (PGlite: an encrypted write occurs only under both scopes; either missing → fail-closed).
- ADR: 0055/0005 (P2-6). Consumes: `tenancy-rls`, `field-crypto`. Verify: `bun test packages/compliance/src/with-tenant-crypto.integration.test.ts`. **Threat: TM-N (encrypt outside RLS scope).**
- Routing: **opus main-thread** (the single most security-critical wiring). Depends on T6/T7.

### T17 — migration assembly + schema_version ledger

- Creates: `packages/compliance/src/migrate/assemble.ts` (composes the per-package numbered migrations — `field-crypto` key tables → `audit-worm` chain+version tables → compliance evidence tables — into ONE ordered sequence under a single `schema_version` checksum ledger; ordering: key tables BEFORE encrypted-column tables), `src/migrate/assemble.integration.test.ts` (PGlite: full ordered apply is idempotent; checksum ledger stamped).
- ADR: 0070 (P2-22), 0014. Consumes: T3, T4, T6 migrations. Verify: `bun test packages/compliance/src/migrate/assemble.integration.test.ts`.
- Routing: **opus main-thread** (cross-package ordering). Depends on T3, T4, T6. **Threat: TM-O (migration ordering / RLS-not-in-migration).**

### T18 — compliance manifest + EventSink emit + barrel (gate-blocking)

- Creates: `packages/compliance/manifest.ts` (`defineModule` `kind:"edition"`, `editions:["compliance"]`, `tier:"paid"`, `priceCents` placeholder pending Pricing, `license:"LicenseRef-Caisson-Commercial"`, `dependencies:["@caisson/audit-worm","@caisson/field-crypto","@caisson/tenancy-rls","@caisson/kernel"]`, `golden:"src/__golden__"`), `packages/compliance/eu-ai-act.manifest.ts` (named slot module, `golden:null`), `src/observe.ts` (emit `evidence.generated` + `erasure.crypto-shred` **operational** events through the base `EventSink` port, ADR-0075 — evidentiary record stays in the WORM chain), `src/index.ts` barrel, `package.json`/configs/`AGENTS.md`/`README.md`; depcruise down-only entry.
- ADR: 0021 (P2-21), 0075. Verify: `bun run gate`; `bunx eslint packages/compliance`; depcruise proves `compliance → {audit-worm,field-crypto,tenancy-rls,kernel}` (no `credits`, no up-dep).
- Routing: **sonnet** (config/wiring); prose → **haiku** sub-step.

---

## D — reference app + repo-green

### T19 — `apps/compliance` Next.js reference app (the P2 exit artifact)

- Creates: `apps/compliance/{app,…}` (Next.js App Router, ADR-0044) — a **thin wiring shell** that runs the leg: seed a tenant → write encrypted SEC/HIPAA fields under `withTenantCrypto` → lock a versioned artifact into WORM with a chain anchor → emit + **validate an evidence pack against the golden fixture** → prove an unresolved flag blocks generation. No dashboard.
- ADR: 0044, P2-19a. Tags: `ui`. Verify: `bun test apps/compliance`; `bun run build` (app compiles); the four exit checks pass.
- Routing: **opus main-thread** (cross-package wiring + `ui`). Depends on C complete. **UI review fires at SHIP.**

### T20 — full-repo green + VERIFY/SWEEP/SHIP

- Verify: `bun install` clean; `bun run check` + `bun run gate` green repo-wide; `bun test` green (incl. all integration tests); **all goldens matched with `BLESS` unset**; `depcruise` clean (down-only graph); **no live cloud/KMS/RFC-3161 call ran in CI**.
- Routing: **opus main-thread** (goal-backward VERIFY vs the SPEC goal sentence).

---

## Dependency notes

- **Parallel writers (isolated worktrees, ADR doctrine):** Track **A (T1–T5, audit-worm)** and Track
  **B (T6–T8, field-crypto)** touch disjoint trees and depend only on `kernel`(+`tenancy-rls`) — run
  them in parallel worktrees. **C control catalog (T9, T10)** is pure config and may author in
  parallel with A/B. T15 (OSCAL seam) parallels T14.
- **Serialize on data dependency:** T3/T4 depend on T1 (the `ArtifactStore`). T11 depends on T3+T4+T9.
  **T12 (golden) MUST precede T13 (generator logic)** — ADR-0013/0058 golden-file-before-logic. T13
  depends on T11+T12; T14 on T13; T16 on T6+T7; T17 on T3+T4+T6; T18 on all of C; T19 on C complete.
- **Critical-path dependency:** `audit-worm` chain+WORM persistence (T1→T3) **and** the control
  catalog+collectors (T9→T11) must both be green before the **evidence-pack golden (T12)**, which
  gates the **generator (T13)** — the single longest chain is
  **T1 → T3 → T11 → T12 → T13 → T14 → T19 → T20**. The generator cannot start until both the WORM/chain
  layer and the golden fixtures exist.
- **Golden-file-before-logic (ADR-0013):** T12 (canonical body + BLOCKED-case goldens) lands before
  T13 (generator); T9 ships a control golden before T10/T11 consume the shape; T7/T14 each ship their
  golden in the same task as the logic they pin (round-trip / deterministic-sign).

## Threats to model (drives the SHIP SECURITY audit — tags security/secrets/infra)

| #    | Threat                                                    | Mitigation (asserted in code/test)                                                             |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| TM-A | COMPLIANCE-mode bricks a bucket (irreversible footgun)    | GOVERNANCE default; COMPLIANCE only via typed irreversible-opt-in; never in Local/test (T2)    |
| TM-C | Cross-tenant WORM read                                    | `{account_id}/…` key prefix + `assertSafeKey`; per-tenant SSE-KMS option (T1/T2)               |
| TM-D | Locked row/entry rewritten by a bug or compromised query  | append-only tables; withheld `UPDATE`/`DELETE` GRANT; tested under `SET ROLE app` (T3/T4)      |
| TM-E | Ciphertext relocated between rows (same tenant/column/kv) | row-bound AAD `tenant∥kv∥column∥rowId`; relocate → auth-fail (T7)                              |
| TM-F | DEK leak / chained plaintext survives erasure             | DEK transient, never logged; chained PII committed as ciphertext so shred ⟂ `verifyChain` (T8) |
| TM-G | Live cloud/KMS call on the CI critical path               | S3/KMS/RFC-3161 all behind ports, test-doubled; only live transport un-exercised (T2/T8/T14)   |
| TM-H | WORM anchor overwritten by a later tip                    | length-keyed write-once object key; `IfNoneMatch:'*'` 412→`ArtifactExistsError` (T2/T3)        |
| TM-I | Tail-truncation / wholesale chain rewrite                 | trusted `{length,tipHash,genesisHash}` anchor; `verifyChain(entries,anchor)` (T3)              |
| TM-J | SCF CC-BY-ND ingest → licensing breach                    | clean-room own-authored catalog; no agent auto-pulls SCF JSON (T10)                            |
| TM-K | False attestation (fabricated/inferred control status)    | flag-never-guess; UNRESOLVED throws, no partial pack; readiness/posture copy (T13)             |
| TM-L | Evidence-pack forgery                                     | per-tenant detached Ed25519 over canonical manifest ∥ anchor; `timingSafeEqual` verify (T14)   |
| TM-N | Encrypted write outside the RLS tenant scope              | `withTenantCrypto` nests crypto inside `withTenant`; either missing → fail-closed (T16)        |
| TM-O | A tenant table ships without its RLS policy               | RLS policy lives INSIDE each migration; assembler composes ordered + checksum-ledgered (T17)   |

## Done-when

The SPEC §"Exit gate" — all green with `BLESS` unset and no live cloud call, run-and-read evidence,
PR open + CI green, no service restarted (DEPLOY is a separate operator-gated act).
