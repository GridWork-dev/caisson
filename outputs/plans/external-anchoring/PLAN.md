# PLAN — External anchoring, **V1 only** (TSA `trusted-timestamped` leg)

- **Phase:** Act 2 (PLAN) for `outputs/specs/external-anchoring/SPEC.md`
- **Locks:** `knowledge/decisions/ADR-0332-external-anchoring-locks.md` (forks A–F)
- **Scope of THIS plan:** V1 = the TSA trusted-timestamped leg + durable outbox + chain-level `verifyExternal` + evidence-pack grade tagging + the CR-16 job-ownership boundary. **ZERO Rekor tasks.** The Rekor v1.1 `externally-transparent` leg is gated on a separate protocol spike (SPEC §"Rekor protocol spike"); it appears here only as a hard gate, never decomposed.
- **Session posture:** PLAN-only. No code is modified in this session. `packages/ui` + `apps/site` are frozen this wave (Kickoff S owns them) — this plan touches neither; the sibling per-row-verification-ui SPEC/ADR-0331 owns all rendering.

---

## 1. Goal (goal-backward from the SPEC)

Give `@caisson/audit-worm`'s per-tenant hash chain an external attestation of its periodic
anchor checkpoints so the trust claim rises above _"tamper is evident to anyone who trusts our
self-hosted WORM store."_ V1 ships **only** the honest weaker half of that: a `trusted-timestamped`
grade — each anchor's canonical bytes (`{length, tipHash, genesisHash}`, hashes only, zero payload/PII)
are imprint-submitted to an RFC-3161 TSA and the returned receipt is stored as a WORM evidence object.
The load-bearing correctness property is **honesty, not reach**: the TSA default must never be marketed
or rendered as "outside parties can detect rewrite" (that sellable line attaches only to the v1.1
`externally-transparent` grade). Around that, V1 must prove the durability discipline every later target
inherits — a **durable outbox** that persists intent _before_ egress and resolves a response-loss crash
window to an operator-reconciliation state (never a blind duplicate submit) — and must never let an
external side effect touch the append transaction. Success = a scheduled, per-tenant, skip-if-receipted
checkpoint job that anchors through the outbox to a TSA, writes a grade-tagged WORM receipt, a
`verifyExternal` that re-checks receipt existence + anchor-byte-match (+ TSA token verification), an
evidence pack that carries the newest receipt tagged with its grade, and docs that state the honest limit
— all with the concrete handler registered from the commercial side, never from Apache-2.0 `packages/jobs`.

---

## 2. Preconditions & premise checks (verified against the tree)

| #   | SPEC premise                                                                               | Reality (path:line)                                                                                                                                                                           | Verdict                                                                                          |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| P1  | RFC-3161 `TimestampAuthority` pattern already ships, stub-doubled, live transport un-wired | `packages/signing-primitive/src/sign.ts:159` (`TimestampAuthority.countersign`), `:168` (`StubTimestampAuthority`), `:135–193`; header note "NO live TSA call runs in CI"                     | TRUE — pattern exists; **live DER/CMS transport does NOT exist anywhere**                        |
| P2  | The anchor already produces canonical bytes committing the whole prefix                    | `chain-store.ts:96` `encodeAnchor()` → `canonicalize({length,tipHash,genesisHash?})`; `kernel/src/audit-chain.ts:131` `AuditChainAnchor`                                                      | TRUE                                                                                             |
| P3  | Anchoring must never be inside the append txn                                              | `chain-store.ts:20–24` KNOWN-BOUND comment; SPEC non-goal                                                                                                                                     | Binding constraint                                                                               |
| P4  | WORM receipts land under `{account_id}/audit-chain/receipts/…` with key-safety             | `store.ts:93` `assertSafeKey`, `:139` `buildArtifactKey`; existing anchors use `audit-chain/anchors/<len>.json` (`chain-store.ts:57,87`)                                                      | Reusable verbatim                                                                                |
| P5  | Job ownership: handler must not live in Apache-2.0 `packages/jobs`                         | `packages/jobs/package.json` license `Apache-2.0`; `packages/audit-worm`, `packages/compliance`, `packages/signing-primitive`, `packages/compliance-core` all `LicenseRef-Caisson-Commercial` | Enforced — anchoring code lands in commercial pkgs only                                          |
| P6  | A generic scheduling port + pg-boss cron exists to compose                                 | `packages/jobs/src/queue.ts` (`defineTask`,`JobQueue`,`EnqueueOptions.singletonKey`), `pgboss.ts:153` `PgBossSchedule`/`:318` `schedule()` (ADR-0256)                                         | Compose, don't add ports                                                                         |
| P7  | A boot-time, env-gated, inert-until-armed per-tenant scheduler pattern exists to mirror    | `services/license/src/credit-expiry-scheduler.ts` (cron env-gate `:64`, cross-tenant `admin_write` enumerate `:76`, fan-out tick `:86`)                                                       | Model for the checkpoint scheduler                                                               |
| P8  | The evidence-pack generator's canonical body is clock-free/byte-stable and `.strict()`     | `compliance-core/src/evidence/generate.ts:22` "CLOCK AT THE EDGE"; `pack-format.ts:177` `.strict()` manifest + golden `evidence-pack.manifest.json`                                           | Receipt must be **detached**, never in the canonical body (it carries a non-deterministic token) |
| P9  | No ASN.1 / CMS / X.509-chain library is installed                                          | grep of every `package.json` for pkijs/asn1js/@peculiar/node-forge → **none**                                                                                                                 | Drives Fork P2 (transport depth)                                                                 |
| P10 | Existing migration + RLS pattern for a new operational table                               | `packages/audit-worm/src/migrations/0001_audit_chain.sql`, `0003_rls_nullif.sql`; `retention-runner` `0001..0003` audit-RLS pattern                                                           | Model for the `anchor_outbox` migration                                                          |
| P11 | Version bump ripples the frozen bundle members pin                                         | `packages/compliance/manifest.ts:49–63` `members` map pins `@caisson/audit-worm: 0.3.0`                                                                                                       | A minor bump needs a members-fold republish (note in changeset task)                             |

**No prior anchoring code exists** (grep for `verifyExternal`/`anchor-transparency`/`TrustedTimestampLog`/`anchor_outbox` → empty). This is greenfield inside a commercial package.

---

## 3. Task decomposition (atomic; one commit each)

> Lane key: **sonnet** = bounded implementation; **opus** = review-grade / security-seam judgment.
> Every task inherits the binding invariants: TS-strict, Bun-only, Zod `.strict()` at boundaries, `crypto.timingSafeEqual` for any secret/token compare, `fetchWithTimeout` for outbound fetch, integer money units (n/a here), append-only versions, open-core no-depend-up. Each implementation task ships its own unit tests; integration/live tests are called out inline. Commit scope in **bold**.

### T1 — Anchor-transparency types, target model, receipt + outbox schemas (no transport)

- **Scope:** `audit-worm`
- **Files:** NEW `packages/audit-worm/src/anchor-transparency.ts` (types + Zod only).
- **What changes:** `TransparencyTarget` (v1 discriminated union carrying only `{ kind: "tsa"; url; grade: "trusted-timestamped" }`, but shaped so the v1.1 `{ kind: "rekor"|"ots"; grade: "externally-transparent" }` slots in without a rewrite — Fork F target-agnostic). `TrustedTimestampLog { submit(anchorBytes: Uint8Array): Promise<TimestampReceipt> }` port (SPEC Design §1, verbatim shape). `TimestampReceipt`/`AnchorReceipt` Zod `.strict()` schema: `{ accountId, target, anchorLength, anchorDigest (sha256 hex of encodeAnchor bytes), grade, token: TimestampToken-shaped, receiptedAt }`. `AnchorOutboxState = "pending"|"submitted"|"receipted"|"failed"|"needs_reconcile"`. `AnchorOutboxRow` `.strict()` schema keyed `(accountId, target, anchorLength, anchorDigest)`. **Grades are two distinct string literals in one enum used everywhere — never a boolean, so code cannot conflate them** (ADR-0332 Binding).
- **Verify:** `bun test packages/audit-worm/src/anchor-transparency.test.ts` (schema round-trip: valid receipt parses, extra field rejected, wrong grade rejected). `bunx tsc -p packages/audit-worm` clean.
- **Size:** S · **Lane:** sonnet

### T2 — `TsaAnchorLog` + deterministic stub + live-transport seam (Fork P2 depth applies)

- **Scope:** `audit-worm`
- **Files:** `anchor-transparency.ts` (impl section) + `anchor-transparency.test.ts` + NEW gated `packages/audit-worm/live/tsa.live.test.ts`.
- **What changes:** `StubTrustedTimestampLog` — deterministic, network-free, reproduces `messageImprint = sha256(anchorBytes)` + an injected clock (mirrors `StubTimestampAuthority`, `sign.ts:168`), fully exercised in CI. `TsaAnchorLog` — the live RFC-3161 client: POSTs the DER `TimeStampReq` (imprint = `sha256(anchorBytes)`) over **`fetchWithTimeout(url, init, ms)`** (never native `AbortSignal.timeout` — repo rule), parses the `TimeStampResp`. **Live DER/CMS depth is gated on Fork P2** — the live test self-skips without a real TSA (mirrors `live/store.s3.live.test.ts` convention). Config (target URL/policy) is **buyer-injected via the constructor**, never a module constant (Fork C).
- **Verify:** `bun test packages/audit-worm/src/anchor-transparency.test.ts` (stub produces a receipt whose imprint == `sha256(encodeAnchor(anchor))`). Live: `bun run test:live` self-skips green with no creds.
- **Size:** M (S if Fork P2 → seam-only; L if Fork P2 → real ASN.1/CMS dep) · **Lane:** opus (crypto/egress seam)

### T3 — Durable outbox: `anchor_outbox` migration + RLS + state machine (CR-02)

- **Scope:** `audit-worm`
- **Files:** NEW `packages/audit-worm/src/migrations/0004_anchor_outbox.sql` + `0005_anchor_outbox_rls.sql`; NEW `packages/audit-worm/src/anchor-outbox.ts` + `.test.ts` + `.integration.test.ts` (PGlite).
- **What changes:** a **mutable operational** table (NOT WORM — states transition) keyed `UNIQUE(account_id, target, anchor_length, anchor_digest)`, columns for state + timestamps + last-error, tenant `account_id`, retention n/a. RLS mirrors `0003_rls_nullif` + an `admin_write` read/write policy so the cross-tenant tick can drive it (same reuse rationale as `credit-expiry-scheduler.ts:14–18`, no policy widening). The state machine enforces **persist-BEFORE-egress**: `enqueue()` writes `pending`; `markSubmitted()` before the network call resolves; a response-loss window (submitted, no receipt) resolves to **`needs_reconcile`** — surfaced, never blind-retried (SPEC Design §3, ADR-0332 Binding). `receipt`/`failed` are terminal.
- **Verify:** `bun test packages/audit-worm/src/anchor-outbox.test.ts` + integration test that **simulates a crash between submit and receipt-persist and asserts the row lands `needs_reconcile`, not a second submit** (the CR-02 acceptance).
- **Size:** L · **Lane:** opus (crash-window correctness is the whole point of the amendment)

### T4 — Checkpoint handler + task definition + per-tenant tick (CR-16 — commercial side)

- **Scope:** `audit-worm`
- **Files:** NEW `packages/audit-worm/src/anchor-checkpoint.ts` + `.test.ts`; small public accessor added to `chain-store.ts` (e.g. `readCurrentAnchor(accountId): Promise<{ length, anchor, bytes } | null>` — the job needs the current anchor + its exact `encodeAnchor` bytes; today `anchorKey`/`encodeAnchor` are private).
- **What changes:** `defineTask(ANCHOR_CHECKPOINT_TASK, schema, handler)` + an `enqueueAnchorCheckpoint(queue,{accountId})` helper (mirrors `retention-runner/src/schedule.ts`). The **handler** (the concrete anchoring logic, deliberately in commercial `audit-worm`, never `packages/jobs`): read the current WORM anchor → **skip if a receipt already exists** for `(len, target)` → outbox `enqueue` (`pending`) → `submit` via `TrustedTimestampLog` → on success write the receipt to WORM under `buildArtifactKey(accountId, "audit-chain", "receipts", `${len}.${target}.json`)` (write-once, same retention floor as the anchor) → outbox `receipted`. Uses `singletonKey = accountId` for overlap safety (`EnqueueOptions.singletonKey`). **All of this runs in a scheduled job AFTER the append commits — never inside `append()`** (P3).
- **Verify:** `bun test packages/audit-worm/src/anchor-checkpoint.test.ts` — with `StubTrustedTimestampLog` + `LocalArtifactStore`, one tick produces a WORM receipt at the expected `assertSafeKey`-valid key; a second tick is a no-op (skip-if-receipted); receipt key round-trips through `assertSafeKey`.
- **Size:** L · **Lane:** opus

### T5 — `verifyExternal` (Fork E v1 depth)

- **Scope:** `audit-worm`
- **Files:** `anchor-transparency.ts` (add `verifyExternal`) + tests; export via `index.ts` (see T8).
- **What changes:** `verifyExternal(store, accountId, target)` beside `AuditChainStore.verify()`. V1 checks, fail-closed: (1) the latest receipt object exists in WORM for the current anchor length; (2) the receipt's `anchorDigest` **byte-matches** `sha256(encodeAnchor(currentAnchor))` (constant-time compare of the digests via `safeEqualFixed`/`timingSafeEqual`); (3) **TSA token verification** — recompute the imprint and constant-time compare to the token's `messageImprint` (the `timestampCountersignsSignature` pattern, `sign.ts:291`), plus token-structure/parse validation. **Depth of (3)'s certificate-chain check rides Fork P2.** It does **NOT** attempt inclusion-proof verification (no public-log target exists in v1 — Fork E lock). Returns a typed verdict `{ grade, verified, reason? }`; **`grade` is always `trusted-timestamped` in v1** — the function must refuse to ever report `externally-transparent` (ADR-0332 Fork E: "a receipt Caisson hasn't independently verified is not externally anchored").
- **Verify:** `bun test` — passes for a matching stub receipt; fails closed on missing receipt, on a tampered anchor (digest mismatch), and on an imprint-mismatched token.
- **Size:** M · **Lane:** opus (fail-closed verification path)

### T6 — Boot-time checkpoint scheduler in a service (Fork B cadence, Fork C config; Fork P3 location)

- **Scope:** `license` (or the service locked by Fork P3)
- **Files:** NEW `services/<svc>/src/anchoring-scheduler.ts` + `.test.ts`, mirroring `credit-expiry-scheduler.ts`.
- **What changes:** an env-gated, **inert-until-armed** scheduler (`ANCHOR_CHECKPOINT_SCHEDULE` unset ⇒ returns immediately, no pg-boss connection — exactly `loadCreditExpiryScheduleConfig` posture). When armed: a daily parent tick (Fork B: **daily default, configurable, hourly floor** — validate the interval ≥ 1h, fail-closed below) enumerates every account with an **active audit chain** cross-tenant via the already-provisioned `admin_write` role (no policy widening; reuse `withAdminWrite`), enqueues `ANCHOR_CHECKPOINT_TASK` per account. The buyer's **target URL/keys come from deployment config** (Fork C) injected here into the `TsaAnchorLog`. **Default target = TSA (`trusted-timestamped`), default-ON** (Fork D) — but only the TSA target is constructible in v1; the public-log branch is a v1.1 gate. On-evidence-pack-generation anchoring (Fork B second trigger) enqueues the same task from the generator path — see T7 note. Boot-failure posture: one stderr line, never throws past the start fn (a misconfigured cron can't take the service down — `credit-expiry-scheduler.ts:20–24`).
- **Verify:** `bun test services/<svc>/src/anchoring-scheduler.test.ts` — unset env ⇒ inert (no connection); armed ⇒ tick enumerates accounts and enqueues per-account (fake queue asserts the calls); a sub-hourly cron/interval is rejected.
- **Size:** M · **Lane:** sonnet

### T7 — Evidence-pack grade tagging (detached receipt, optional)

- **Scope:** `compliance-core` (+ its wiring in the generator caller)
- **Files:** `packages/compliance-core/src/evidence/generate.ts` + `pack-format.ts` (envelope only) + a new golden fixture; tests.
- **What changes:** the generator optionally attaches the **newest `AnchorReceipt`** for the tenant as a **DETACHED archive entry** (`external-anchor-receipt.json`) + a **grade tag on the result envelope** (like `generatedAt`/the detached signature) — **NEVER a field in the canonical `manifest.json` body** (the receipt carries a non-deterministic token; putting it in the hashed body would break the byte-stability the whole generator guarantees — P8). Absence of a receipt (anchoring off, or none minted yet) is **not** an unresolved-evidence gap — the pack generates normally with no external-anchor entry (anchoring is buyer-optional; flag-never-guess does not fire). The grade tag renders in `auditor-summary.txt` as the honest phrase for the grade (`trusted-timestamped` ⇒ "a private, third-party-clock-attested receipt", never "externally verifiable").
- **Verify:** `bun test packages/compliance-core` with `BLESS` unset — the **existing** `evidence-pack.manifest.json` golden is unchanged (canonical body untouched); a new fixture covers the receipt-attached archive + grade tag; a no-receipt run still produces a valid pack.
- **Size:** M · **Lane:** opus (golden/determinism discipline is easy to break)

### T8 — Barrel exports + version bump + changeset (append-only)

- **Scope:** `audit-worm` (+ changeset)
- **Files:** `packages/audit-worm/src/index.ts` (export the new surface), `packages/audit-worm/package.json` version (minor bump), NEW `.changeset/*.md`.
- **What changes:** export `TrustedTimestampLog`, `TsaAnchorLog`, `StubTrustedTimestampLog`, receipt/target/outbox types, `verifyExternal`, the checkpoint task + enqueue helper. Minor version bump (append-only, ADR-0006). **Changeset must note the frozen-members ripple** — a bumped `@caisson/audit-worm` version needs the Compliance bundle members-fold republish (`compliance/manifest.ts:49`). No `packages/jobs` change (it already carries every generic port needed) — **assert this in the changeset** (CR-16 boundary evidence).
- **Verify:** `bun run --filter @caisson/audit-worm check`; `bunx changeset status --since=origin/main` green; standards-gate manifest/package.json agreement passes.
- **Size:** S · **Lane:** sonnet

### T9 — Docs: trust-grades table, honest-limit language, buyer egress-sink doc

- **Scope:** `docs`
- **Files:** NEW `docs/security/external-anchoring.md` (buyer-facing) + the in-repo trust-grades table; a note appended to the audit-worm package README if present.
- **What changes:** the two-grade table (SPEC §"Trust grades") verbatim in intent; the **honest-limit** paragraph (SPEC Design §7) stating a `trusted-timestamped` receipt in the buyer's own domain only defeats non-receipt-destroying rewriters, and only `externally-transparent` (v1.1) makes rewrite detectable to a party holding nothing; the new **TSA egress sink** documented in the buyer security surface. **Copy invariant: the TSA default is never described as "externally verifiable" / "outside parties detect rewrite"** (ADR-0332 Binding). **Cross-repo follow-up (flagged, NOT executed here — outside this kickoff's tree):** for caisson's _own_ deployment, a row in gridwork-core `identity/security-surfaces.md` for the TSA egress sink, per the security-surfaces invariant.
- **Verify:** `bun run sot` advisory green (frontmatter/archive); manual read confirms no conflation of the two grades and no over-claim on the TSA default.
- **Size:** S/M · **Lane:** sonnet

---

## 4. Task ordering / dependency graph

```
T1 (types/schemas)
 ├─> T2 (TsaAnchorLog + stub)        ─┐
 ├─> T3 (outbox + migration)          ├─> T4 (checkpoint handler) ─> T6 (scheduler wiring)
 └─> T5 (verifyExternal)             ─┘                              │
                                                                     │
T4 ─> T7 (evidence-pack tagging, needs the receipt shape + a produced receipt)
                                                                     │
T2,T3,T4,T5 ──> T8 (exports + version + changeset)  ──────────────> T9 (docs)
```

- **T1 is the root** (every other task imports its types). Do it first, alone.
- **T2 / T3 / T5 are parallelizable** after T1 (distinct files; if run as parallel writers, each takes its own worktree per doctrine). **T4 depends on all three.** **T6 depends on T4.**
- **T7 depends on T4** (needs a real receipt to attach) — and touches `compliance-core`, a _different_ package, so it can start once the receipt schema (T1) + producer (T4) are stable.
- **T8 (exports/version) after the code lands; T9 (docs) last** so the copy matches shipped behavior.
- **Fork P2 (T2/T5 depth) and Fork P3 (T6 location) must be locked before T2/T6 start** — see §5.

---

## 5. Open forks & operator gates

Each fork below is a decision the SPEC/ADR left to PLAN. **None is auto-decided.** Recommendation + confidence + evidence, then:

> **OPERATOR LOCK REQUIRED before EXECUTE.**

### Fork P2 — TSA live-transport & `verifyExternal` cert-verification DEPTH in V1 _(highest-stakes)_

The directive says `verifyExternal` v1 includes "TSA cert verification"; Fork D locks "TSA default-on". But `sign.ts` ships the RFC-3161 live transport as an explicitly **un-wired seam** (stub only, no live CI call), the effort sketch calls V1 "comparable in size to `sign.ts`", and **no ASN.1/CMS/X.509 library is installed** (P9). Two honest options:

- **(A) ADR-0047 seam (RECOMMENDED, confidence med).** Ship the port + a fully-CI-exercised deterministic stub + a live `TsaAnchorLog` behind `fetchWithTimeout`, with its DER round-trip gated to a self-skipping live test (mirrors `store.s3.live.test.ts`). `verifyExternal`'s cert step verifies the token **structurally** (recompute imprint, constant-time compare to `messageImprint`, parse the timestamp) — full DER `TimeStampToken` CMS parsing + TSA cert-chain validation ships **with** the live wiring, as a fast follow. _Evidence:_ the whole package already treats live crypto transports this way; hand-rolling ASN.1 for a security path violates the "never hand-roll crypto / never simplify away security" rule; "TSA default-on" is a positioning lock, not a "live DER must ship in v1" mandate.
- **(B) Production-real in V1 (confidence low-med).** Add a vetted dependency (`@peculiar/asn1-schema` + `pkijs`, or equivalent) and implement real `TimeStampReq` DER encode, `TimeStampToken` CMS parse, and TSA cert-chain verification now, so the TSA default is end-to-end live in V1. _Cost:_ a new runtime dep in a commercial base package + the full ASN.1 surface, likely pushing T2 to L and the whole V1 past the "≈ sign.ts" estimate the amendment fought to keep honest.

**OPERATOR LOCK REQUIRED before EXECUTE.**

### Fork P1 — Reuse `signing-primitive`'s `TimestampAuthority` vs reimplement the TSA port locally

`TimestampAuthority.countersign(bytes)` (`sign.ts:159`) is structurally what `TrustedTimestampLog.submit(anchorBytes)` needs (imprint = `sha256(bytes)` → token). Reuse would DRY the (eventual) single live RFC-3161 transport.

- **RECOMMENDED: reimplement the small TSA-over-anchor-bytes port locally in `audit-worm` (confidence med).** _Evidence:_ the submit-shape differs from countersign-a-signature; `audit-worm` is documented **down-only on `kernel`+`tenancy-rls`(+`ui`)** (`index.ts:14`, `package.json` deps) and adding `→ signing-primitive` (both commercial, so no open-core breach, but a new edge) forces a manifest + frozen-members-pin change for a ~40-line stub. Local reimplementation keeps the dependency graph unchanged. Reuse is defensible if the operator prefers one physical RFC-3161 transport home.

**OPERATOR LOCK REQUIRED before EXECUTE.**

### Fork P3 — Which service hosts the boot-time checkpoint scheduler

The concrete handler is commercial (T4, `audit-worm`); the `.schedule()` boot wiring lands in a deployed service.

- **RECOMMENDED: `services/license` (confidence med-high).** _Evidence:_ it is the **only in-repo pg-boss scheduler home today** (`credit-expiry-scheduler.ts`, `credit-expiry-scheduler.ts:245` already schedules multiple ticks), already owns the `admin_write` cross-tenant enumeration seam and the inert-until-armed posture — near-zero new infra. _Tradeoff:_ a compliance/WORM concern living in the license service is a mild domain smell; the alternative is a compliance-oriented worker service (`apps/compliance` / a new `services/compliance-worker`), cleaner by domain but new boot infra.

**OPERATOR LOCK REQUIRED before EXECUTE.**

### Fork P4 — Outbox persistence: dedicated PG table vs KV _(near-decided)_

SPEC says "small table or KV".

- **RECOMMENDED: a dedicated `anchor_outbox` PG table with tenant RLS + an `admin_write` policy (confidence high).** _Evidence:_ the state is **mutable** (pending→…→terminal), which the WORM store structurally cannot hold; the RLS + admin_write pattern is already established (`retention-runner` migrations, `credit-expiry-scheduler`); Postgres is already the queue substrate (pg-boss). A KV adds a store with no existing home. Rubber-stamp expected, but recorded here because the SPEC left it open.

**OPERATOR LOCK REQUIRED before EXECUTE.**

---

## 6. Risks & unknowns

- **R1 (high) — no ASN.1/CMS lib (P9).** Real RFC-3161 `TimeStampToken` parse + TSA cert-chain verify is not achievable with `node:crypto` alone (it has `X509Certificate` but no CMS SignedData parser). This is the entire substance of Fork P2. If P2→(A), risk is contained to a gated seam; if P2→(B), the new dependency must be license-audited (open-core: it lands in a _commercial_ package, so Apache-2.0 base is unaffected — confirm the dep's own license is compatible with commercial redistribution).
- **R2 (high) — determinism regression in T7.** Putting the receipt (which carries a time-varying token) into the canonical manifest body would silently break the generator's byte-stability and the golden fixture. Mitigation: the receipt is **detached** (archive entry + envelope tag), asserted by the unchanged `evidence-pack.manifest.json` golden.
- **R3 (med) — CR-02 crash window is the amendment's reason for existing.** If the outbox state machine egresses before persisting `pending`/`submitted`, or blind-retries a `needs_reconcile` row, V1 fails its own acceptance. Mitigation: T3's integration test explicitly simulates the window; opus lane.
- **R4 (med) — append-transaction contamination.** An implementer wiring anchoring "for convenience" into `append()` (or a post-commit hook inside `withTenant`) violates P3 + the SPEC non-goal. Mitigation: anchoring is a **separate scheduled job** reading the anchor after commit; VERIFY greps for any anchoring call inside `chain-store.ts append()`.
- **R5 (med) — frozen members-pin ripple (P11).** Bumping `audit-worm` without the Compliance bundle members-fold republish red-flags the full-tree-index guard. Mitigation: T8 changeset names it; the actual republish is a downstream release act, not a V1 task.
- **R6 (low) — cross-tenant enumeration blast radius.** Reusing `admin_write` for the account-enumeration read is the established pattern (`credit-expiry-scheduler.ts:14–18`); do not widen the buyer `app` RLS policy. Mitigation: read-only SELECT through `withAdminWrite`, as the credit scheduler does.
- **R7 (low) — "active chain" enumeration definition.** T6 needs "every account with an active audit chain" — the exact predicate (DISTINCT `account_id` from `audit_chain_entry`? a tenant registry?) is an implementation detail to settle at T6; skip-if-receipted makes over-enumeration free (idle tenants cost nothing — SPEC Tenant story).

---

## 7. Goal-backward verification plan (Act 4 will re-ask this)

VERIFY re-asks the SPEC **Goal** and **Acceptance**, not a task checklist:

1. **Honesty (the load-bearing property).** Grep the shipped code + `docs/` + any copy: does the TSA default anywhere claim "externally verifiable" / "outside parties detect rewrite"? It must not — that line attaches only to the v1.1 `externally-transparent` grade (SPEC §Trust grades, ADR-0332). `verifyExternal` must never return `grade: "externally-transparent"` in v1 (Fork E).
2. **Durable outbox (CR-02).** Does a submitted-but-receipt-lost run resolve to `needs_reconcile` and refuse a blind duplicate submit? (T3 integration test is the evidence.)
3. **No append-txn contamination (P3).** Is every anchoring call outside `append()`, in the scheduled job only?
4. **Job ownership (CR-16).** Does `packages/jobs` gain zero anchoring knowledge? Is the concrete handler in commercial `audit-worm`? (T8 changeset asserts it; `git diff --stat` on `packages/jobs` is empty.)
5. **Receipt discipline.** Are receipts WORM objects under `{account_id}/audit-chain/receipts/<len>.<target>.json`, every key through `assertSafeKey`, same retention floor?
6. **`verifyExternal` v1 depth (Fork E).** Existence + anchor-byte-match + TSA token verification — and **no** inclusion-proof attempt.
7. **Evidence pack (grade-tagged, non-breaking).** Newest receipt attached + grade tag; canonical golden unchanged; no-receipt pack still generates.
8. **Zero Rekor.** No `externally-transparent` transport code, no public-log submission, no offline inclusion-proof verify anywhere in the diff (the leg is gated on the spike).
9. **SPEC §Verification / Acceptance:** forks A–F honored as locked in ADR-0332; V1 plan-ready surface complete; the Rekor gate intact.

VERIFY verdict is pass/partial/fail; partial enumerates gaps + queues follow-ups; fail → new PLAN cycle, no ship.

---

## 8. Out-of-scope confirmations (SPEC non-goals restated as guards)

- **No Rekor / public-log / OTS code.** No `externally-transparent` transport, no `hashedrekord`, no signed-submission shape, no SigningConfig/TUF/shard handling — all gated on the protocol spike (SPEC §Rekor protocol spike). This plan references the gate; it does not decompose it.
- **No offline inclusion-proof verification** in `verifyExternal` (Fork E — rides v1.1).
- **No per-row external proof and no per-row badge** (CR-04). External status is chain/checkpoint-level only; the sibling per-row-verification-ui SPEC (ADR-0331) owns all rendering. **No UI in this plan** — `packages/ui` + `apps/site` are frozen (Kickoff S) and untouched.
- **No change to the per-append WORM anchor mechanics** in `chain-store.ts` (the only edit there is a read-only public accessor for the current anchor — additive, no change to `append()`/`verify()` behavior).
- **Anchoring is never inside the append transaction** (P3, KNOWN-BOUND).
- **No DSSE/in-toto** envelopes (stays the separate ADR-0056 seam).
- **No witness/monitor network, no Caisson-operated relay** (Fork C: buyer-configured direct; relay deferred until a buyer asks).
- **No Merkle / deployment-wide super-root aggregation** (documented later optimization; one submission per tenant per tick).
- **`packages/jobs` stays generic** — zero anchoring/chain/WORM knowledge added (CR-16 / ADR-0094 boundary).
- **No new ADR filed in this PLAN session** (ADR-0332 already locks the forks; the Fork P1–P4 PLAN-level locks are recorded at EXECUTE-time per the caisson append-only ADR discipline, ceiling 0333 — a later session's concern, not this one's).
