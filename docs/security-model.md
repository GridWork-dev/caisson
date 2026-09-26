# Security model

Internal source-of-truth synthesis for contributors + the operator. This file OWNS a
cross-cutting **map** of Caisson's security architecture - one catalog of every security
boundary, the threat it answers, the mechanism that mitigates it, the owning ADR, and the
package that implements it. It does NOT restate ADR prose.

**Canonical source stays elsewhere.** Each row routes to the ADR that decides it
(`knowledge/decisions/`) and the spec that frames it (`specs/`). On any conflict, the ADR
wins over this file; this file is the index, not the decision. The gridwork security floor
(timing-safe compares, Zod `.strict()` boundaries, `fetchWithTimeout`, no `any`/`console.log`,
fail-closed) is inherited globally and is not re-decided here - it is the baseline every row
below assumes.

## Build state (verified against the filesystem, 2026-07-09)

Legend: **BUILT** = `src/` implementation + `*.test.ts` present on disk. **SPEC-ONLY** =
ADR locked, no implementation. Build state is per the working tree; it does NOT assert
CI-green, app-wiring, or production-readiness (run `bun test` / `turbo build` to confirm).
Counts for the base rows below carry forward from the 2026-06-28 pass (unaffected by the carve);
`docs/build-state.md`'s per-package table is machine-regenerated (`ADR-0253`) and is the source to
re-verify against.

| Mechanism                                                              | Package                                  | src / test files (non-test `.ts` / `*.test.ts`) | State |
| ---------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- | ----- |
| Typed error model (`CaissonError`)                                     | `packages/kernel`                        | 12 / 9                                          | BUILT |
| Audit chain (`anchorChain`/`verifyChain`/`canonicalize`)               | `packages/kernel` (`audit-chain.ts`)     | (in kernel)                                     | BUILT |
| Append-only versioning (`validateVersionSet`)                          | `packages/kernel` (`versioning.ts`)      | (in kernel)                                     | BUILT |
| Fail-closed RLS (`withTenant`)                                         | `packages/tenancy-rls`                   | 2 / 1                                           | BUILT |
| Field-crypto (HKDF + AES-256-GCM + envelope + crypto-shred + KMS port) | `packages/field-crypto`                  | 19 / 14                                         | BUILT |
| Credit gate (debit-before-spend, 402)                                  | `packages/credits`                       | 3 / 2                                           | BUILT |
| Billing webhook (HMAC)                                                 | `packages/billing`                       | 4 / 1                                           | BUILT |
| License/entitlement verify (Ed25519 offline)                           | `packages/license-verify`                | 4 / 2                                           | BUILT |
| Session/JWT seam                                                       | `packages/auth`                          | 3 / 1                                           | BUILT |
| WORM ArtifactStore + chain-store + version-store                       | `packages/audit-worm`                    | 7 / 6                                           | BUILT |
| Evidence-pack generation (collectors, pack-format, crosswalk rollup)   | `packages/compliance-core` (`evidence/`) | 13 / 9                                          | BUILT |
| OSCAL export + pinned NIST reference catalog                           | `packages/oscal-spine`                   | deterministic adapters + conformance fixtures   | BUILT |
| Evidence-pack signing (Ed25519 + RFC-3161)                             | `packages/signing-primitive`             | 2 / 1                                           | BUILT |
| Control-framework mappings (SOC2/HIPAA/EU-AI-Act, crosswalks)          | `packages/frameworks-pack`               | 7 / 3                                           | BUILT |
| Guardrails (moderation + PII redaction, fail-closed)                   | `packages/guardrails`                    | 4 / 2                                           | BUILT |
| SSO + owner-gated member management + admin-write RLS layer            | `packages/org-controls`                  | 6 / 5                                           | BUILT |
| Multi-provider billing driver + idempotent webhook fulfillment         | `packages/billing-orchestration`         | 7 / 6                                           | BUILT |

> **Carve note (`ADR-0257` §1, 2026-07-06).** The four rows above pulled out of `packages/compliance`
> and `packages/billing` were carved into standalone commercial packages by the six-bundle catalog
> rework — `packages/compliance/src/evidence/` now holds only `oscal-bundle.ts` (the collectors,
> `generate.ts`, and `pack-format.ts` moved to `compliance-core`; `sign.ts` moved to
> `signing-primitive`). Impl paths in the "Evidence-pack signing" boundary below are updated to
> match. `org-controls` and `billing-orchestration` are net-new carve packages, not present at the
> 2026-06-28 snapshot this table used to be dated to.

---

## Boundary catalog

Each boundary is framed: **boundary -> threat -> mitigation -> owning ADR**. Routes are
exact relative paths from the repo root.

### 1. Multi-tenant isolation (fail-closed RLS)

- **Boundary:** every tenant-owned row carries `account_id` (platform) / `workspace_id`
  (shipped apps); the DB is the correctness floor under the app filter.
- **Threat:** a forgotten `WHERE account_id = ...` in app code leaks another tenant's rows;
  a code path that forgets tenant scoping entirely reads everything.
- **Mitigation (defense-in-depth, two layers):**
  - App-layer explicit `account_id` filter (index-friendly), AND
  - Postgres RLS policies, **FORCE**'d, keyed by a `SET LOCAL` GUC (`app.current_account`).
    `withTenant(db, accountId, fn)` is the **SOLE entry** to tenant data: it opens a txn, drops
    to the non-superuser `app` role, binds the GUC for the txn lifetime, and **refuses an empty
    account id outright**. A missing `WHERE` returns only the caller's rows; a missing
    `withTenant` binds no GUC and sees nothing. Fail-closed by construction.
  - The account id MUST come from a verified session/JWT (ADR-0015), never request params.
  - A schema test asserts FORCE-RLS on every tenant-owned table; a table shipping without a
    policy + test fails CI (the marketed, publicly-testable "security floor" claim).
- **No-leak rule:** a tenancy/RLS denial surfaces as **404, never 403** - a 403 would confirm
  the row exists in another tenant. Encoded in the error model (row 7).
- **Owning ADR:** `knowledge/decisions/ADR-0005-fail-closed-rls-tenancy.md` ·
  seam in `knowledge/decisions/ADR-0015-auth-session-rls-seam.md` · framed
  `specs/01-architecture.md` (invariant 1). Impl: `packages/tenancy-rls/src/rls.ts`.

### 2. WORM + append-only audit chain

- **Boundary:** court-admissible compliance records (locked versions, audit trail, evidence)
  must be write-once and tamper-evident, surviving a privileged insider and a code bug.
- **Threat:** a stray `UPDATE`/`DELETE` rewrites a locked record; a tampered chain entry goes
  undetected; a self-attesting store lies about its own history; a bad `retainUntilDate`
  bricks a bucket for years.
- **Mitigation (four primitives):**
  - **Append-only versioning** - one version table; a change mints a new row superseding the
    prior via `supersedes_id`; "current" is a DERIVED no-successor predicate (never stored);
    lineage is **linear (fork throws)**, validated by `kernel/versioning.ts` on read; the
    `provenance` JSONB is Zod-`.strictObject`-parsed **before** insert. Immutability enforced at
    the grant level: `REVOKE UPDATE, DELETE` on the table from the app role (not a trigger).
  - **SHA-256 hash chain** - `anchorChain`/`verifyChain` over a `canonicalize`d payload
    (recursive key-sort -> byte-stable hashes). Entries are **append-only Postgres rows**
    (immutable via withheld `UPDATE`/`DELETE` GRANT, keeping a queryable SQL spine); the trusted
    `{length, tipHash, genesisHash}` **anchor is written write-once into the WORM store** under a
    **length-keyed** object key (a new tip can never overwrite a prior anchor). `verifyChain`
    recomputes from BOTH stores - neither attests itself. Per-tenant appends serialize via
    `pg_advisory_xact_lock` or a unique `(account_id, seq)` index (`23505` -> `ConflictError` retry).
  - **WORM ArtifactStore** - an `ArtifactStore` port (`put`/`get`/`head`, retention metadata).
    Prod: `S3ArtifactStore` over real `@aws-sdk/client-s3`, write-once via S3 Object-Lock
    (`IfNoneMatch:'*'` -> 412 `ArtifactExistsError`, `ObjectLockMode` + `RetainUntilDate`);
    no live cloud call in CI (stubbed `S3Sendable`). Dev: retention-ignoring `LocalArtifactStore`.
    Per-tenant isolation by `{account_id}/...` key-prefix through `assertSafeKey`. DB
    `retain_until` stays provably equal to the object `RetainUntilDate`.
  - **Retention mode** - **GOVERNANCE is the default everywhere** (bypassable, dev-safe);
    **COMPLIANCE** (SEC 17a-4 grade, root-proof, irreversible) is **buyer-opt-in per evidence
    class behind a typed irreversible-opt-in guard**; never selected by a default, a test, or
    `LocalArtifactStore`. Safe-by-default, not footgun-by-default.
- **Owning ADRs:** `knowledge/decisions/ADR-0006-worm-audit-chain-field-crypto.md` (umbrella) ·
  `knowledge/decisions/ADR-0051-worm-objectlock-retention-mode.md` (mode) ·
  `knowledge/decisions/ADR-0052-audit-chain-anchor-persistence.md` (entry + anchor durability) ·
  `knowledge/decisions/ADR-0053-append-only-version-schema.md` (version schema + REVOKE) ·
  `knowledge/decisions/ADR-0054-worm-artifactstore-port.md` (port + backends). Impl:
  `packages/kernel/src/{audit-chain.ts,versioning.ts}`, `packages/audit-worm/src/*`.

### 3. Field-crypto (per-tenant encryption-at-rest for columns)

- **Boundary:** sensitive columns (PII/PHI/SSN) encrypted on write / decrypted on read; the
  encryption boundary MUST equal the RLS tenant boundary (ADR-0005).
- **Threat:** one shared key decrypts every tenant on a single compromise; nonce reuse breaks
  GCM catastrophically; a ciphertext relocated between rows/tenants/columns decrypts in the
  wrong context; GDPR Art.17 erasure with no key to destroy; key-management hard-bound to one cloud.
- **Mitigation:**
  - **Per-tenant derived keys (default, zero infra):**
    `tenant_key = HKDF-SHA256(ikm=MASTER_FIELD_KEY, salt=FIELD_CRYPTO_SALT, info="caisson-field-crypto:v"||key_version||":"||tenant_id)`.
    Deterministic (no key storage/backup surface), per-tenant isolated, rotation-aware. Native
    `crypto.hkdfSync`, no dependency. `MASTER_FIELD_KEY` read once, never logged.
  - **AEAD cipher:** AES-256-GCM via native `node:crypto` behind an `AeadCipher` seam (zero-dep,
    FIPS-140-approved, AES-NI). Fresh CSPRNG 96-bit IV per write; a `(key, nonce)` pair is never
    reused. 2^32-message-per-key ceiling is per-tenant (~4.3B fields). XChaCha20/AEGIS kept as
    documented seam alternates only.
  - **Self-describing envelope** (on-disk, base64 into a `text` column):
    `[ format-version 1B | alg-id 1B | key_version uint16 BE | nonce 12B | ciphertext | tag 16B ]`.
    The decrypt path reads version/alg/key_version **from the value itself** (key rotation + cipher
    migration with no sidecar metadata); an unknown version/alg **throws, never guesses**.
  - **Row-AAD:** AES-GCM AAD binds `tenant || key_version || column-context`; for SEC/HIPAA-tagged
    columns the explicit `encryptField(ctx, columnContext, rowId, plaintext)` extends AAD to
    `tenant || key_version || column || rowId` (pins a cell to its row, closing the cross-row
    relocate/rollback gap). Such tables use `crypto.randomUUID()` PKs so `rowId` exists before
    the sealing INSERT. Tamper or AAD-mismatch MUST throw on decrypt.
  - **Crypto-shred:** the derived dev/self-hosted path cannot selectively destroy a key; the hosted
    KMS path stores a per-tenant/subject wrapped DEK and enables GDPR Art.17 erasure via
    `scheduleKeyDeletion` plus an `erasure.crypto-shred` audit event. **BINDING:** any PII inside a
    chained audit payload is committed as **ciphertext, not plaintext**, so `verifyChain` survives
    key destruction. The low-level primitive validates the scope against the recorded tenant/subject
    and refuses an unprovisioned scope; the authorized host persists and reconciles recoverable
    deletion receipts instead of treating a request retry as proof of idempotent erasure.
  - **KMS port (`FieldKeyProvider`):** `DerivedKeyProvider` serves zero-infrastructure dev/self-hosted
    deployments; `KmsKeyProvider` drives the shipped AWS, GCP, and Azure envelope-encryption clients.
    Caisson's hosted site requires Azure, prefetches historical DEKs into a disposable request
    context, and fails closed on any KMS loss. Vault remains a future port implementation.
- **Owning ADRs:** `knowledge/decisions/ADR-0043-field-crypto-per-tenant-keys.md` (HKDF + port,
  amends 0006) · `knowledge/decisions/ADR-0045-field-crypto-aead-cipher.md` (AES-256-GCM) ·
  `knowledge/decisions/ADR-0046-ciphertext-envelope-format.md` (envelope) ·
  `knowledge/decisions/ADR-0055-field-crypto-cryptoshred-and-row-aad.md` (crypto-shred + row-AAD) ·
  `knowledge/decisions/ADR-0387-field-crypto-kms-backing-and-pre-deploy-arming-pass.md` (hosted
  Azure backing) · `knowledge/decisions/ADR-0389-request-scoped-prefetch-all-kms-context.md`
  (request lifetime).
  Impl: `packages/field-crypto/src/{derive,cipher,envelope,aad,crypto-shred,encrypt-field,column,provider,kms,kms-port,kms-budget,kms-aws,kms-gcp,kms-azure,schema,store.pg,crypto,registry,index}.ts`.

### 4. Evidence-pack signing

- **Boundary:** a SOC2/HIPAA evidence pack must prove the BUYER's provenance over its own bytes.
- **Threat:** signing the buyer's evidence with Caisson's identity (wrong trust model); a pack
  that does not bind to the audit-chain state at generation time; non-reproducible signed bytes.
- **Mitigation:** **per-tenant Ed25519** signing key, **distinct from the Caisson license-issuer
  key** (ADR-0010). Detached signature via `@noble/ed25519` (same curve as the license issuer -
  one verify primitive across the product). Signed payload = the `canonicalize`d evidence
  `manifest.json` concatenated with the **audit-chain tip-hash anchor** (ties the pack to the
  WORM-anchored chain state). An RFC-3161 trusted timestamp countersigns. Signer behind a port so
  buyer-supplied KMS is a drop-in; DSSE/in-toto + Sigstore/Rekor are an un-wired premium seam.
- **Owning ADR:** `knowledge/decisions/ADR-0056-evidence-pack-signing.md` (supplies the key +
  scheme ADR-0006 left undefined). Impl (post-`ADR-0257` §1 carve): `packages/signing-primitive/src/sign.ts`,
  `packages/compliance-core/src/evidence/generate.ts`.

### 5. Credit gate (the 402 spend boundary)

- **Boundary:** every metered spend path (codegen, AI feature) must charge an integer-credit
  wallet before doing work.
- **Threat:** spend-then-debit lets a crash leave free work; floating-point credits drift;
  a retried request double-debits; an empty wallet does work for free.
- **Mitigation:** credits are **integer units, never floats**; the wallet ledger is **append-only**
  (grants/debits). **Debit-before-spend**; **DB-anchored idempotency** (partial unique index;
  Postgres `23505` -> `ConflictError`). An empty/short wallet returns the exact **402**
  `InsufficientCreditsError` shape `{ error: { code: "insufficient_credits",
details: { required: <int>, balance: <int> } } }`; clients branch on the `code`.
- **Owning ADRs:** `knowledge/decisions/ADR-0007-credit-metering-model.md` ·
  `knowledge/decisions/ADR-0024-credit-idempotency-index.md` · 402 shape in
  `knowledge/decisions/ADR-0019-error-model.md`. Impl: `packages/credits/src/credits.ts`.

### 6. Licensing + entitlement (offline-verifiable)

- **Boundary:** a paid module/edition loads only for an entitled buyer; verification must work
  without phone-home (local-first), and survive a module being added to an edition later.
- **Threat:** an online-only check breaks local-first and adds a failure mode; a single global
  license kills a-la-carte commerce; a token that snapshots edition membership drifts from the
  registry; symmetric comparison of an asymmetric signature.
- **Mitigation:** a buyer **license is an Ed25519 offline-verifiable token** (from PUBLIC
  `tessera`'s kit, never pro-private `media-pipeline`) carrying entitlements + tier + expiry,
  revocable via `services/license`. Verify with **`crypto.verify()` (asymmetric - NOT
  `timingSafeEqual`)**; fail-safe-to-free for OSS tiers. The token carries **what was bought**
  (edition/bundle/module ids), not the expanded leaf set; a **resolver expands edition/bundle ->
  member-module slugs from the registry INDEX** (the single membership source) at gate time, so a
  module added to an edition reaches entitled buyers with no re-issue. Opaque Bearer/registry
  tokens still compare timing-safe. Licensing is now uniform-commercial across every package and
  edition (no AGPL flank; ADR-0023 + ADR-0050/0083).
- **Owning ADRs:** `knowledge/decisions/ADR-0010-licensing-open-core-boundary.md` (model) ·
  `knowledge/decisions/ADR-0071-entitlement-expansion-registry-graph.md` (edition->slug expansion) ·
  buyer MCP gate `knowledge/decisions/ADR-0008-buyer-mcp-server-auth.md`. Impl:
  `packages/license-verify/src/{verify,token,claims}.ts`.

### 7. Typed error model (`CaissonError`) - the leak-control boundary

- **Boundary:** errors crossing the package graph must propagate with a stable `code`, a mapped
  HTTP status, and a redaction-safe envelope - never a raw `Error`, stack, or SQL string.
- **Threat:** a leaked stack/SQL string reaches the client; a tenancy denial returns 403 and
  confirms cross-tenant existence; per-package ad-hoc shapes break client branching.
- **Mitigation:** one hierarchy in `@caisson-sh/kernel`. `toErrorResponse(err)` ->
  `{ error: { code, message, details? } }`; `details` is **allowlisted per class** (no SQL, no
  stack, no secret); an unknown throw is coerced to `InternalError` (500, generic message; the
  original is logged server-side, never serialized). Load-bearing rows:

  | Class                      | code                   | HTTP    | No-leak rule                                                      |
  | -------------------------- | ---------------------- | ------- | ----------------------------------------------------------------- |
  | `TenancyError`             | `not_found`            | **404** | RLS denial is 404, NEVER 403 (a 403 leaks cross-tenant existence) |
  | `InsufficientCreditsError` | `insufficient_credits` | **402** | the exact credit-gate shape (row 5)                               |
  | `EntitlementError`         | `not_entitled`         | 403     | license/entitlement failure (row 6)                               |
  | `GuardrailError`           | (422)                  | **422** | a guardrail block (AI-Kit, ADR-0063) - added to this hierarchy    |
  | `InternalError`            | `internal_error`       | 500     | the only class an unknown throw becomes (generic message)         |

- **Owning ADRs:** `knowledge/decisions/ADR-0019-error-model.md` (hierarchy + 402 shape + 404
  rule) · `GuardrailError` added by `knowledge/decisions/ADR-0063-ai-kit-guardrails.md`. Impl:
  `packages/kernel/src/errors.ts`.

### 8. Guardrails (AI-Kit input/output enforcement) - fail-closed

- **Boundary:** the single metered-inference gateway moderates content and strips PII at its
  input and output points before/after provider egress.
- **Threat:** a moderator outage passing unmoderated traffic; user content leaking to one
  hardwired vendor (EU/air-gap non-starter); a bespoke second crypto path for PII.
- **Mitigation:** a pluggable `Moderator` port (provider | local | custom, no vendor type past
  the seam). PII that must be retained encrypted **reuses field-crypto `sealField`/`openField`
  (ADR-0055), never a bespoke path**. Hard policies **fail closed** (a guardrail error or
  moderator timeout blocks the call); `failOpen` is a documented per-policy opt-in only. A block
  throws `GuardrailError` (422) and emits to the audit/observability bus without up-importing an
  edition.
- **Owning ADR:** `knowledge/decisions/ADR-0063-ai-kit-guardrails.md`. Impl:
  `packages/guardrails/src/{guard,pii,moderator}.ts`.

---

## Cross-cutting "no-leak" rules (consolidated)

These appear across multiple boundaries above; centralized here so a contributor never has to
re-derive them:

| Rule                                                                     | Why                                                     | Owning ADR                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------- |
| Tenancy denial -> 404, never 403                                         | a 403 confirms the row exists in another tenant         | ADR-0019, ADR-0005                |
| `withTenant` is the SOLE entry to tenant data; empty account id refused  | a forgotten scope must see nothing, not everything      | ADR-0005                          |
| Chained PII committed as ciphertext, not plaintext                       | `verifyChain` must survive crypto-shred key destruction | ADR-0055                          |
| Unknown envelope version/alg throws, never guesses ("flag, never guess") | a wrong-cipher guess is a silent corruption             | ADR-0046, ADR-0006                |
| Encryption boundary == RLS tenant boundary                               | one key per tenant; one compromise != all tenants       | ADR-0043, ADR-0005                |
| `details` allowlisted per error class; unknown throw -> generic 500      | no SQL/stack/secret reaches the client                  | ADR-0019                          |
| Ed25519 license verified with `crypto.verify()`, NOT `timingSafeEqual`   | asymmetric signature, not a secret compare              | specs/01 invariant 3, ADR-0010    |
| Opaque Bearer/registry tokens compared with `crypto.timingSafeEqual`     | timing side-channel on secret compare                   | gridwork security floor, specs/01 |
| COMPLIANCE retention never selected by a default/test/LocalArtifactStore | one bad `retainUntilDate` bricks a bucket for years     | ADR-0051                          |

---

## Threat -> mitigation -> ADR index (the synthesized catalog)

| Threat                                                | Mitigation                                              | Owning ADR(s)      |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------ |
| Cross-tenant row leak via forgotten `WHERE`           | FORCE RLS + `withTenant` GUC floor                      | ADR-0005, ADR-0015 |
| Cross-tenant existence disclosure                     | tenancy denial renders 404                              | ADR-0019           |
| Locked record rewritten by stray UPDATE/bug           | REVOKE UPDATE/DELETE + append-only supersede            | ADR-0053, ADR-0006 |
| Audit trail tampering                                 | SHA-256 chain, anchor in WORM, verify reads both stores | ADR-0052, ADR-0006 |
| WORM store self-attestation                           | length-keyed write-once anchor; verify recomputes       | ADR-0052, ADR-0054 |
| Irreversible bucket lock by misconfig                 | GOVERNANCE default; COMPLIANCE opt-in + guard           | ADR-0051           |
| Single key compromise decrypts all tenants            | per-tenant HKDF derived keys                            | ADR-0043           |
| GCM nonce reuse                                       | fresh CSPRNG 96-bit IV/write; per-key 2^32 ceiling      | ADR-0045           |
| Ciphertext relocated across row/tenant/column         | tenant/version/column/row AAD binding                   | ADR-0045, ADR-0055 |
| GDPR Art.17 erasure with derived (undestroyable) keys | stored DEK behind KMS port + crypto-shred event         | ADR-0055           |
| Cloud vendor lock-in for key mgmt                     | `FieldKeyProvider` port (AWS/GCP/Azure/Vault)           | ADR-0043           |
| Evidence signed with wrong identity                   | per-tenant Ed25519, distinct from issuer key            | ADR-0056           |
| Free work on crash / double-debit                     | integer credits, debit-before-spend, DB idempotency     | ADR-0007, ADR-0024 |
| Empty-wallet free spend                               | exact 402 `insufficient_credits` envelope               | ADR-0019, ADR-0007 |
| License check breaks offline                          | Ed25519 offline verify, fail-safe-to-free               | ADR-0010           |
| Edition-membership token drift                        | resolver expands from registry index, not token         | ADR-0071           |
| Stack/SQL leak to client                              | typed `CaissonError` + allowlisted `details`            | ADR-0019           |
| Moderator outage passes unmoderated traffic           | guardrails fail-closed; opt-in `failOpen` only          | ADR-0063           |
| Second PII crypto attack surface                      | guardrails reuse field-crypto, no bespoke path          | ADR-0063, ADR-0055 |

---

## Route to source

| For...                                                         | See                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| The full architecture + 7 cross-cutting invariants             | `specs/01-architecture.md`                                               |
| Engineering invariants (TS-strict, integer money, `.strict()`) | `knowledge/decisions/ADR-0002-engineering-invariants.md`                 |
| Every locked/open security fork                                | `docs/state/decisions-and-forks.md`                                      |
| Auth/session/RLS seam (where `account_id` comes from)          | `knowledge/decisions/ADR-0015-auth-session-rls-seam.md`                  |
| Buyer MCP server auth + write-surface gating                   | `knowledge/decisions/ADR-0008-buyer-mcp-server-auth.md`                  |
| The gridwork global security floor (general principles)        | inherited from `gridwork-core` `identity/security.md` (not in this repo) |

> The gridwork security floor is referenced as the global baseline; its file lives in the
> `gridwork-core` surface, not in this repo (unverified path from within Caisson).
