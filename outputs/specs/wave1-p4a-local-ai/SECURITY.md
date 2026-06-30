# SECURITY — Wave 1 · P4a: Local-first AI edition (retroactive adversarial audit)

SHIP-act conditional audit (Act 7) for tags **security** + **data-migration** declared in
`SPEC.md`. Closes the documented SECURITY-debt (P4a merged green in PR#11 carrying only SPEC.md +
PLAN.md; VERIFY.md/SWEEP.md later closed the VERIFY/SWEEP debt and queued this as follow-up 2).
Retroactive: written by reading the merged code + tests, not a live PR diff.

- **Scope:** `packages/local-ai/`, `packages/local-store/` (the shared base it composes — file-per-
  tenant isolation + the egress-guard sibling), `packages/license-verify/`. Pre-existing Wave-0
  primitives this edition composes (`@caisson/field-crypto`, `@caisson/kernel`) were already audited
  at Wave-0 SHIP and are not re-audited here except at the composition seam (`crypto/at-rest.ts`).
- **Method:** FORCE stance — every threat in `PLAN.md` §"Threats to model" treated as unmitigated
  until a code location proves it, then the proving tests read to confirm the mitigation is actually
  _exercised_, not merely asserted in a comment. One pass, not a 13-agent adversarial fanout (unlike
  the live Wave-0 SECURITY); the threats are individually scoped enough for direct verification.
- **ASVS posture:** L2-equivalent (the gridwork-core security floor, `identity/security.md`).

## Verdict: **PASS**

| Severity   | Count |
| ---------- | ----- |
| BLOCKER    | 0     |
| HIGH       | 0     |
| MEDIUM     | 0     |
| LOW / INFO | 1     |

All seven P4a threats (TM-EGRESS, TM-MODEL, TM-ISO, TM-REST, TM-LIC, TM-SYNC, TM-RENT) are
**MITIGATED** with a proving code location and an exercising test. One LOW/informational note is
recorded (the on-device ONNX path is real code with no live-execution evidence, by design per
ADR-0064); it does not block ship. No implementation file was modified by this audit (read-only;
only this `SECURITY.md` written).

---

## Threat verification

| Threat ID | Category                     | Disposition | Status        | Evidence                                                                                                                     |
| --------- | ---------------------------- | ----------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| TM-EGRESS | security / network           | mitigate    | **MITIGATED** | `local-ai/src/privacy/egress-guard.ts:78-100,111-127`; `egress-guard.test.ts:125-238`                                        |
| TM-MODEL  | security / supply-chain      | mitigate    | **MITIGATED** | `local-ai/src/inference/onnx-backend.ts:223-298`; `.npmignore`                                                               |
| TM-ISO    | security / tenancy           | mitigate    | **MITIGATED** | `local-store/src/tenant-db.ts:28-56`; `tenant-db.test.ts:22-66`                                                              |
| TM-REST   | security / crypto            | mitigate    | **MITIGATED** | `local-ai/src/crypto/at-rest.ts:36-89`; `at-rest.integration.test.ts:30-122`                                                 |
| TM-LIC    | security / auth              | mitigate    | **MITIGATED** | `license-verify/src/verify.ts:71-139`; `verify.test.ts:70-208`                                                               |
| TM-SYNC   | security / data-migration    | mitigate    | **MITIGATED** | `local-ai/src/sync/changeset.ts:266-281`; `clock.ts:54-59`; `tombstone.ts:66-119`; `convergence.integration.test.ts:150-250` |
| TM-RENT   | security / network / billing | mitigate    | **MITIGATED** | `local-ai/src/inference/rented-backend.ts:140-237`; `rented-backend.test.ts:69-145`                                          |

---

## TM-EGRESS — A raw `fetch` bypasses the privacy gate, data leaves the device — **MITIGATED**

Declared mitigation: all outbound routes through the guarded kernel `fetchWithTimeout`; a
non-allowlisted host is hard-blocked; an empty allowlist is zero egress; fail-closed-to-offline,
no silent hosted fallback (`PLAN.md` T14).

Evidence (`packages/local-ai/src/privacy/egress-guard.ts`):

- `EgressGuard.assertAllowed` (`:78-100`) is the single decision point. It throws **before** any
  network call in three closed cases: a malformed URL (`ValidationError`, `:80-84`), a non-https
  scheme — closing `http:`/`data:`/`file:`/`javascript:` smuggling (`AuthzError`, `:85-90`), and a
  host absent from the allowlist (`AuthzError`, `:91-98`) — the comment is explicit that an **empty**
  allowlist makes this last branch fire on every call, i.e. zero egress with no implicit host.
- `EgressGuard.fetch` (`:111-118`) calls `assertAllowed` **first**, then routes through
  `fetchWithTimeout` — a blocked host never opens a socket. `guardedFetch` (`:125-126`) exposes the
  same decision as the `(input, init) => Response` shape another runtime's outbound hook accepts
  (transformers.js `env.fetch`, the rented transport), so neither downstream consumer can egress
  out-of-band of this one chokepoint.
- The thrown error's `details` carry only `host`/`scheme`/`privacy` — never the full URL, whose
  path or query string could hold a token or PII (`:87-89,94-97`).

Test evidence (`egress-guard.test.ts:125-238`): empty allowlist blocks every host (`:126-135`); a
non-https scheme is blocked even when the host is allowlisted (`:152-166`); a non-allowlisted host
is blocked with **no silent hosted fallback** (`:167-173`); a malformed URL fails closed
(`:174-178`); the block error never leaks the request path (`:179-193`); a blocked host throws
**before** any network call (`:203-211`); `guardedFetch` blocks a non-allowlisted host in the
`env.fetch` shape transformers.js installs (`:220-228`).

A repo-wide grep for raw `fetch(` in `packages/local-ai/src` and `packages/local-store/src` (outside
test files) returns exactly one hit — `EgressGuard.fetch` itself, which immediately delegates to
`fetchWithTimeout` after the gate. No other outbound call bypasses the guard.

## TM-MODEL — The first-run model fetch is an unsanctioned / un-integrity-checked egress sink — **MITIGATED**

Declared mitigation: the fetch host is an explicit privacy-gate allowlist entry; the model is
hash-pinned; air-gap buyers pre-seed the cache (`PLAN.md` T13).

Evidence (`packages/local-ai/src/inference/onnx-backend.ts`):

- `#guardedFetch` (`:252-297`), installed as transformers.js's `env.fetch` (`:232`), is the runtime's
  **only** outbound hook — `OnnxEmbeddingBackend` opens no socket at module load (the header asserts
  this) and the runtime is loaded by a non-literal dynamic import (`:78,226`) so it is never resolved
  by tsc or pulled into a default build.
- Host allowlisting is hard-coded to the **single** sanctioned `modelHost`, not the general egress
  policy: `:265-273` rejects any hostname other than `this.#config.modelHost`, and `:259-264` rejects
  any non-https scheme — both **before** `fetchWithTimeout` is reached (`:274-276`).
- Integrity: every fetched file with a configured pin is SHA-256 hashed (`:280-281`) and compared
  with `safeEqualFixed` (`:282`) — a **fixed-length** digest compare, correct per the security floor
  (both sides are 64-char hex digests of equal length). A mismatch throws `InternalError` and the
  bytes never reach the runtime (`:283-291`) — fail-closed, not a silent fallback to the unverified
  download. `resolveConfig` (`:129-170`) refuses to construct the backend at all unless at least one
  pin is supplied (`:142-147`) and every supplied pin matches the `SHA256_HEX` shape (`:148-155`).
- Air-gap posture: `offline: true` sets `allowRemoteModels = false` and `local_files_only: true`
  (`:231,239`) — a pre-seeded cache buyer makes zero network calls, not merely a smaller number.
- Tarball hygiene: `.npmignore` excludes `.cache/`, `models/`, `**/*.onnx`, `**/*.onnx_data`,
  `**/*.bin`, `**/*.safetensors` — the model is genuinely first-run-fetched, never shipped, so the
  hash-pin (not a bundled artifact) is the real integrity anchor.

> **LOW / INFO (non-blocking, by design — ADR-0064):** this path has no live-execution test. CI runs
> only `StubInferenceBackend`; the guarded-fetch + hash-pin logic above is verified by reading the
> code, not by a test exercising a real model download. This is the declared ADR-0064 boundary (no
> live model in CI), already recorded as a SEAM in `VERIFY.md` and a follow-up in `SWEEP.md` ("wire
> the ONNX seam"). Not a new finding — confirmed here as the one un-exercised security-relevant path.

## TM-ISO — Cross-tenant data access via the `tenant_id → path` map — **MITIGATED**

Declared mitigation: file-per-tenant (ADR-0073): `path.resolve` + assert under the tenant-data root

- `path.sep`; reject `..`/null bytes/absolute; `tenant_id` server-derived, never user-supplied
  (`PLAN.md` T10).

Evidence (`packages/local-store/src/tenant-db.ts`):

- `tenantDbPath` (`:28-42`) is a **pure** function — no filesystem access — so a bad id is rejected
  before anything is opened or created. It rejects, in order: empty (`:29`), a null byte (`:30`), a
  `..` segment (`:31`), a path separator (`:32`), and an absolute path (`:33`) — then resolves the
  candidate and asserts `candidate.startsWith(rootResolved + sep)` (`:40`), the authoritative
  backstop per the security floor (`path.resolve()` + root-prefix-plus-separator assert) that holds
  even if the filename scheme above it ever changes.
- `deny` (`:17-21`) throws a `TenancyError` with a **category reason only** — never the raw rejected
  id, which could itself leak a tenant id into an error/log.
- `openTenantDb` (`:52-56`) calls `tenantDbPath` **first** (`:53`) — a malformed id throws before any
  `mkdirSync`/`Database` open — and the returned connection is bound to exactly one tenant's file, so
  a cross-tenant read is not an authorization check that can be bypassed, it is **inexpressible**: the
  local tier has no RLS to forget (the file header states this explicitly — physical isolation is the
  local-tier mirror of the ADR-0005 fail-closed `WHERE` floor).

Test evidence (`tenant-db.test.ts:22-66`): traversal/absolute/null-byte/separator ids are all
rejected before any open; two tenants resolve to distinct files under the root; a cross-tenant query
is demonstrated not expressible (separate connections, separate files, not merely separate rows).

## TM-REST — An exfiltrated SQLite file leaks plaintext — **MITIGATED**

Declared mitigation: at-rest field-crypto, per-tenant-derived key, AEAD envelope; tenant-B file
cannot open tenant-A ciphertext; local master key read once, never logged (`PLAN.md` T11).

Evidence (`packages/local-ai/src/crypto/at-rest.ts`):

- `AtRestStore` is a **composition**, not new crypto (`:1-18`): `@caisson/field-crypto` (Wave-0
  audited) supplies HKDF + AES-256-GCM behind the `AeadCipher`/envelope seam; this file binds
  `tenant_id` into it. Two **independent** bindings make a tenant-B file unable to open a tenant-A
  ciphertext: (1) the HKDF `info` carries `tenant_id` (`contextFor`, `:69-71`, delegating to
  `derivedContext`) — tenant B derives a _different_ key outright; (2) `tenant_id` is bound into the
  GCM AAD (via `sealField`/`openField`, `:78-88`) — even an identical key would fail to authenticate.
  Either binding alone makes `open` throw on mismatch (AEAD auth-fail); the file documents this as
  deliberate defense-in-depth, not redundancy.
- `columnContext` is bound into the AAD too (`:75-76,86-87`) — a ciphertext sealed for one column
  cannot be relocated to another column of the same tenant.
- `fromEnv` (`:51-56`) is the only constructor path that touches the local-deployment master secret;
  it fails closed at construction on a missing/malformed `MASTER_FIELD_KEY`/`FIELD_CRYPTO_SALT`
  (delegated to `DerivedKeyProvider.fromEnv`, Wave-0 audited) — never a silent unkeyed write — and the
  master key is read once and never logged (the class comment states this is enforced by
  `DerivedKeyProvider` keeping it private).
- `openDb` (`:64-66`) delegates to `openTenantDb` (TM-ISO above), so the at-rest store inherits the
  same fail-closed path resolution — the two threats compose rather than stack independent gaps.

Test evidence (`at-rest.integration.test.ts:30-122`): round-trip seal→open recovers the plaintext; a
tenant-B file constructed against tenant-A's stored envelope fails with an AEAD auth error (not a
wrong-but-decodable value); a missing master key fails closed at construction, before any DB touch.

## TM-LIC — Forged/replayed license unlocks paid tier — **MITIGATED**

Declared mitigation: Ed25519 `crypto.verify` over the canonical payload, baked-in public key; the
signed tier is authority (the wire prefix is cosmetic); verify never raises, fail-safe-to-community
(`PLAN.md` T7).

Evidence (`packages/license-verify/src/verify.ts`):

- `verifyLicense` (`:71-76`) pins the explicit-key core to the **baked-in** production public key
  (`LICENSE_PUBLIC_KEY_SPKI_B64`, `:34-35`, imported once at module load, `:38-42`) — the gate-trusted
  entrypoint every consumer calls. `verifyLicenseWithKey` (`:87-139`) is exported separately for
  tests/self-hosting but is explicitly documented (`:78-86`) as NOT the gate-trusted path.
- Verification order is fail-safe at every step, each returning the shared `COMMUNITY` constant
  (`:57-62`) rather than throwing: null/empty token (`:92-94`); the Ed25519 signature check over the
  **exact signed bytes** via `cryptoVerify` — explicitly `crypto.verify`, not `timingSafeEqual`,
  because a signature check is its own discipline, not a secret comparison (`:99-103`); claims fail
  `licenseClaimsSchema.safeParse` (`:105-110`); the signed payload is **not** the kernel-canonical
  serialization of its own claims, which would indicate a crafted-but-validly-signed token
  (`:113-118`); and an elapsed or unparseable expiry (`:120-127`). A catch-all (`:135-138`) routes any
  unexpected throw (JSON parse, codec edge) to community too — the function genuinely never raises.
- The **signed** `tier`/`entitlements` are returned as the sole authority (`:129-134`) — the file
  header states the wire prefix/tier are cosmetic and ignored, closing a "relabel the wire prefix"
  forgery that never touches the signature.

Test evidence (`verify.test.ts:70-208`): a byte-exact KAT against the shipped production public key
(the golden-pinned `prod-signed-token.json`); 8 distinct fail-safe paths including a wrong signing
key, a non-canonical payload, and claims carrying an extra (unsigned) key — every path resolves to
`COMMUNITY`, none throws.

## TM-SYNC — A cross-tenant or rolled-back changeset corrupts a peer — **MITIGATED**

Declared mitigation: changesets are per-tenant-file partitioned (ADR-0073) — a tenant-A changeset
cannot apply to a tenant-B file; hybrid-logical-clock tiebreak resists clock forgery; tombstones
don't resurrect (`PLAN.md` T15-T19).

Evidence:

- **Partition guard** (`changeset.ts`): `ChangesetLog.assertApplicable` (`:266-281`) throws a
  `TenancyError` if an inbound changeset's `tenantId` does not match the file this log is bound to —
  the comment is explicit that this runs **before** any entry is integrated. `ChangesetLog.open`
  (`:181-223`) independently fails closed if a file already bound to a different tenant is reopened
  under a new tenant id (`:206-212`) — the file-per-tenant boundary cannot be re-pointed. Boundary
  input is `.strict()`-parsed first (`parseChangeset`/`changesetSchema`, `:79-105`) with a
  cross-field invariant (an `upsert` MUST carry values, a `delete` MUST NOT, `:64-77`) — a malformed
  peer payload throws before it reaches the tenant check.
- **Forged-clock resistance** (`clock.ts`): `compareStamps` (`:54-59`) is a strict total order over
  `(physical, node, counter)` where `node` is a non-forgeable per-replica UUID minted locally
  (`changeset.ts:199`, never peer-suppliable) — a peer cannot win a tie by minting another replica's
  id, and a skewed/forged `physical` wall-clock hint can only bias which _true_ concurrent edit wins,
  never make the merge non-deterministic (file header, `:11-16`).
- **No resurrection — single batch** (`reconcile.ts:48-104`): a winning `delete` excludes the row
  from the live set (`:85` only materializes `upsert` winners); a lower-stamped concurrent upsert is
  simply not the winner — by construction, not a special case.
- **No resurrection — across rounds** (`tombstone.ts:66-119`): `reconcileWithTombstones` replays
  **persisted** tombstones as synthetic deletes (`tombstonesToChangesets`, `:129-157`) so a stale
  upsert whose original delete already aged out of the batch still loses to the carried-forward
  tombstone. `gcTombstones` (`:114-119`) only drops a tombstone past an operator-supplied `horizon`
  watermark — the safety contract (`:109-112`) states the horizon must be older than the slowest
  replica's un-synced lag, i.e. GC is bounded, not "now". Re-creation (a strictly-newer upsert beating
  a tombstone) is allowed by design, distinct from resurrection (a _stale_ upsert beating one).
- Defense-in-depth: both `reconcileReplicas` (`:51-61`) and `reconcileWithTombstones` (`:73-82`)
  independently re-assert every changeset shares one `tenantId`, failing closed even if a caller bug
  mixed two tenants' files upstream of the per-file partition guard.

Test evidence (`convergence.integration.test.ts:150-250`): two real `bun:sqlite` replicas converge
byte-equal after concurrent per-field edits and a delete; two independent reconcile runs over the
same inputs produce an identical result (order-independence); a persisted tombstone suppresses a
redelivered stale upsert across a sync round while an unrelated fresh-replica control resurrects —
proving the tombstone is load-bearing, not coincidental.

## TM-RENT — The rented-backend path egresses while "offline" is promised — **MITIGATED**

Declared mitigation: the rented backend is off by default, gated by the privacy gate as a sanctioned
opt-in sink; the live debit and transport are P6 seams, not wired here (`PLAN.md` T20).

Evidence (`packages/local-ai/src/inference/rented-backend.ts`):

- **Off by default, construction-gated** (`:140-182`): the constructor calls
  `config.guard.assertAllowed(config.endpoint)` (`:166`) — under the default zero-egress policy this
  throws immediately, so the backend cannot even be built without an explicit allowlist entry. It
  then requires the allowlisted sink's **kind** to be exactly `"rented-backend"` (`:167-172`) — a
  host allowlisted only for the model fetch (TM-MODEL) cannot double as a hosted-inference egress,
  closing a sink-confusion bypass.
- **Re-gated per call, not a construction-time snapshot** (`:185-187,206`): both `embed` and
  `complete` re-call `assertAllowed` before any transport call — a policy that is tightened after
  construction (e.g. an operator revokes the allowlist) takes effect on the very next call.
- **Metered, fail-closed** (`:220-236`): every call builds one `UsageMetering` record — integer
  `quantity` (kernel `usageMeteringSchema`, ADR-0007) with a fresh `crypto.randomUUID()`
  idempotency key per call (`:233`, so a replay of the _same_ key never double-charges) — and hands
  it to the sink **before** returning the result (`:200,216`). If the sink throws, the call fails
  (file header, `:103`): a paid call that cannot be recorded must not silently succeed. The live
  ledger wiring is an explicit `// P6:` seam (`:17-33`) — `@caisson/credits` is not a dependency of
  this edition, so no live debit path exists to audit here; only the shape ships.
- **No network in CI** (`:35-39`): the wire call is the `RentedTransport` port; tests inject a
  deterministic double, and the only implementation that opens a real socket
  (`createLiveRentedTransport`, `:257-300`) routes every byte through `guard.fetch` (TM-EGRESS) and
  re-validates every response against the wire schema (`:288-296`) — a hostile or malformed remote
  response fails the same boundary check a peer changeset would.

Test evidence (`rented-backend.test.ts:69-145`): a zero-egress (default) policy blocks construction
outright; a host allowlisted as the wrong kind (`model-fetch`) is rejected; a non-https endpoint
fails closed even when the host is allowlisted; each call mints a fresh idempotency key so a replay
of one key cannot double-charge; a transport response of the wrong vector width fails the dim-guard;
a meter sink that throws fails the whole call.

---

## Security-floor checks (identity/security.md)

| Floor item                                                                          | Status         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed-length secret/hash compares use `crypto.timingSafeEqual`                      | **PASS**       | `onnx-backend.ts:282` (`safeEqualFixed` over two 64-char SHA-256 hex digests — equal-length, the correct fixed-length form per the floor)                                                                                                                                                                                                                                                                                         |
| Zod `.strict()` at every new boundary                                               | **PASS**       | `changeset.ts` `changesetEntrySchema`/`changesetSchema` (`strictObject`, `:57-94`); `rented-backend.ts` `rentedUsageSchema`/`rentedEmbedResponseSchema`/`rentedCompleteResponseSchema` (`strictObject`, `:61-77`); `licenseClaimsSchema` (license-verify)                                                                                                                                                                         |
| `fetchWithTimeout` on every outbound fetch (never the native `AbortSignal.timeout`) | **PASS**       | `egress-guard.ts:117` (`EgressGuard.fetch`); `onnx-backend.ts:274-276` (the model-fetch chokepoint); `rented-backend.ts:273-277` (the live transport); diff-wide grep for raw `fetch(` outside these chokepoints is clean                                                                                                                                                                                                         |
| No hardcoded secrets; no `localhost`/`127.0.0.1` prod fallback                      | **PASS**       | Grep clean across `packages/local-ai/src`, `packages/local-store/src`, `packages/license-verify/src` (excluding tests)                                                                                                                                                                                                                                                                                                            |
| No `console.log`/`console.error`/`console.warn` in product code                     | **PASS**       | Grep clean across the three packages' `src/`                                                                                                                                                                                                                                                                                                                                                                                      |
| No `any` in product code                                                            | **PASS**       | Grep clean across the three packages' `src/` (one unrelated comment match, not a type annotation)                                                                                                                                                                                                                                                                                                                                 |
| Shell execution — no `execSync`/raw shell string                                    | **PASS (N/A)** | No shell `exec` calls anywhere in the three packages; `db.exec(...)` hits are `bun:sqlite`'s in-process SQL exec, not a shell                                                                                                                                                                                                                                                                                                     |
| RLS fail-closed (ADR-0005)                                                          | **N/A**        | The local tier has no RLS to apply — `tenant-db.ts` header states physical file-per-tenant isolation is the deliberate local-tier mirror of the RLS fail-closed floor (TM-ISO above)                                                                                                                                                                                                                                              |
| Credits/money are integer units, never floats (ADR-0007)                            | **PASS**       | `usageMeteringSchema.quantity: z.number().int().nonnegative()` (kernel, consumed by `rented-backend.ts:227-234`); no float arithmetic on any metered quantity in the diff                                                                                                                                                                                                                                                         |
| Migration safety / rollback check (`data-migration` tag)                            | **PASS**       | `migrate.ts:178-211` — forward-only `schema_version` ledger, idempotent re-apply, **fail-closed on drift**: an already-applied ordinal whose recorded checksum no longer matches throws `ValidationError` rather than silently re-running or rebuilding (`:194-199`); the irreversible `vec0` dim-lock + sync-metadata columns are documented in the file header (`:20-31`) as having no rollback path by design, not by omission |

---

## Unregistered flags

No `SUMMARY.md` exists for this phase (P4a merged inside the Wave-1 integration PR#11, which folded
four editions into one branch — no per-phase SUMMARY was authored, consistent with the VERIFY.md /
SWEEP.md retroactive-authoring note). The diff-wide scans run for this audit (raw `fetch`, shell
`exec`, `console.*`, hardcoded secrets, `any`) found no new attack surface beyond the seven threats
PLAN.md already named. Nothing to reconcile.

---

## Closing

All seven P4a threats (TM-EGRESS, TM-MODEL, TM-ISO, TM-REST, TM-LIC, TM-SYNC, TM-RENT) resolve to
**MITIGATED** with a proving `path:line` and an exercising test, and every named floor item
**PASSES** (one **N/A**, local tier has no RLS by design). One LOW/informational note (the on-device
ONNX path has no live-execution test) is recorded as already-acknowledged, non-blocking ADR-0064
scope — not a new gap.

**Overall verdict: PASS — clear to ship (already shipped; this audit closes the SHIP-act act-trail
debt SWEEP.md queued as follow-up 2).**
