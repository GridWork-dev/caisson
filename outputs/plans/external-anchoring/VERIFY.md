# VERIFY — External anchoring, V1 (TSA `trusted-timestamped` leg)

- **Act:** 4 (VERIFY) for `outputs/specs/external-anchoring/SPEC.md` + `outputs/plans/external-anchoring/PLAN.md` (V1)
- **Branch:** `feature/exec-anchoring` · range `feature/kickoff-t-platform..HEAD` (merge-base `fe2509f3`)
- **Method:** goal-backward — re-read SPEC Goal / Trust-grades / Design §1–7 / Acceptance + ADR-0332 (forks A–F) + ADR-0346 (PLAN locks P1–P4), then interrogated the shipped diff and RAN the gates. Not a task checklist.
- **Verdict: PASS** (chartered V1 scope). Every load-bearing correctness property is proven in code + green tests. One integration-wiring item is deferred to the wave reconcile by design (the cross-lane chain-store seam gates it) — enumerated below, not a defect.

---

## Build under review

10 commits, 24 files, +3080/−24. T1→T9 all present:

| Commit     | Task | Surface                                                                                    |
| ---------- | ---- | ------------------------------------------------------------------------------------------ |
| `75338918` | T1   | types + schemas + TSA target/receipt/outbox Zod + port + key/hash helpers                  |
| `8eae4e9d` | T2   | `StubTrustedTimestampLog` + live `TsaAnchorLog` (pkijs DER) + `live/tsa.live.test.ts`      |
| `fafc7cf4` | T3   | `anchor_outbox` DDL + RLS + admin_write + state machine + integration test                 |
| `323cdf65` | T4   | checkpoint handler + `defineTask` + `enqueueAnchorCheckpoint` + `CurrentAnchorReader` port |
| `5acf008c` | T8a  | audit-worm changeset                                                                       |
| `edd6f968` | T5   | `verifyExternal` full-CMS timestamp-token verification                                     |
| `411cb7d7` | T6   | `services/license` boot-time checkpoint scheduler                                          |
| `042b84d4` | T7   | detached external-anchor grade tag on evidence packs                                       |
| `f76a24f0` | T9   | trust-grade docs + honest-limit language + TSA egress note                                 |
| `da54c250` | —    | build-state count-parity                                                                   |

## Gate evidence (ran, not asserted)

- `bunx turbo run build lint test --concurrency=25% --filter=@caisson/audit-worm --filter=@caisson/compliance-core --filter=@caisson/service-license` → **29/29 tasks green** (FULL TURBO cache — code unchanged since EXECUTE).
- Cache-bypass re-run (deps freshly installed: `pkijs@3.4.0`, `asn1js@3.0.10`):
  - `anchor-transparency`/`anchor-outbox`/`anchor-checkpoint`/`verify-external` unit → **36 pass / 0 fail**.
  - `anchor-outbox.integration` (PGlite, real FORCE RLS) → **7 pass / 0 fail**.
  - `anchor-checkpoint.integration` (PGlite) → **4 pass / 0 fail**.
  - `verify-external` (real signed CMS token round-trip via pkijs) → **9 pass / 0 fail**.
- `bunx tsc --noEmit -p packages/audit-worm` → **exit 0** (strict).

---

## Goal-backward claims — proven individually

**1. Honesty (the load-bearing property). PASS.**
`verify-external.ts:45` hard-codes `V1_GRADE = "trusted-timestamped"`; the verdict type's `grade` is `typeof V1_GRADE` in both arms, so the function _cannot_ return `externally-transparent`. Fork-E guard at `:132` fails closed if a target claims another grade; `:161` fails closed on a receipt whose stored grade isn't v1. Test `verify-external.test.ts:403` ("a receipt stamped externally-transparent is refused in v1") is green. Grades are one two-literal `z.enum` (`anchor-transparency.ts:47`), never a boolean — code can't conflate them. Docs (`docs/security/external-anchoring.md:32`) state the binding copy invariant and the auditor-summary phrase for `trusted-timestamped` says "a private, third-party-clock-attested receipt … not a public-transparency proof" (`external-anchor.ts:43`). No over-claim of "externally verifiable" on the TSA default anywhere in the diff.

**2. Durable outbox (CR-02). PASS.**
Persist-before-egress fence in the handler (`anchor-checkpoint.ts:138` `enqueuePending` → `:139` `markSubmitted` → `:143` `log.submit`) — the `submitted` row is durable _before_ the network call. The state machine is DB-guarded (`anchor-outbox.ts:201` `#transition` uses `… AND state = ANY($from) RETURNING id`), so "no second submit" is structural: `markSubmitted`'s only `from` is `pending`. A submitted-but-lost row resolves to `needs_reconcile` (`anchor-checkpoint.ts:124`, `:176`), never a blind resubmit. The CR-02 integration test (`anchor-outbox.integration.test.ts:82`) simulates the crash window and asserts `needs_reconcile` + `markSubmitted` rejects with `ConflictError` — green.

**3. No append-transaction contamination (P3). PASS.**
`packages/audit-worm/src/chain-store.ts` is **untouched** in the range (empty diff-stat) and contains zero references to any anchoring symbol. The handler is a scheduled job that reads the anchor _after_ commit via an injected reader — the seam constraint's "consume `encodeAnchor`/anchors as-is" honored without editing `chain-store.ts` or `packages/kernel`.

**4. Job ownership (CR-16). PASS.**
`packages/jobs` has an empty diff-stat — zero anchoring knowledge added. The concrete handler lives in commercial `audit-worm` (`anchor-checkpoint.ts`) importing only the generic `defineTask`/`JobQueue` ports. The changeset asserts the boundary. `audit-worm` gained a `@caisson/jobs` down-edge (both directions ADR-0094-legal: jobs is Apache-2.0 base, audit-worm commercial — commercial→open is allowed).

**5. Receipt discipline. PASS.**
Receipts are WORM objects keyed `{account_id}/audit-chain/receipts/<12-pad len>.<target>.json` through the single `anchorReceiptKey` builder (`anchor-transparency.ts:195`) → `buildArtifactKey` → `assertSafeKey`. Write-once: `store.put` with `retainUntil` from `retain.ts` legal floor; a concurrent `ArtifactExistsError` converges to `receipted` (`anchor-checkpoint.ts:170`). The receipt is a **detached** artifact — never a canonical manifest body field (Design §6).

**6. `verifyExternal` v1 depth (Fork E, ADR-0346 P2 = full CMS). PASS.**
Three fail-closed checks: (1) existence (`verify-external.ts:144`); (2) constant-time byte-match of `receipt.anchorDigest` **and** the token `messageImprint` against live `sha256(anchorBytes)` via `safeEqualFixed` (`:170`, `:175`); (3) **full CMS** — `pkijs` `SignedData.verify` over the current anchor bytes with `checkChain` against buyer trust anchors, signature-verified + `timeStamping` EKU asserted (`:216`–`:233`). No inclusion-proof attempt (Fork E). `chainValidated` honestly reflects whether trust anchors were configured. Nine tests cover happy-path (chain-validated + honest-limit), tamper, CMS-imprint-mismatch, malformed token, missing EKU, and the externally-transparent refusal — all green.

**7. Evidence pack (grade-tagged, non-breaking). PASS.**
`generate.ts` attaches the newest receipt as a detached archive entry (`external-anchor-receipt.json`) + an `externalAnchorGrade` tag on the `EvidencePack` envelope (like `generatedAt`) — **never** in the canonical `manifest.json` body (the TSA token is non-deterministic). The `evidence-pack.manifest.json` golden is **unchanged** (empty diff-stat). Absence of a receipt is not an unresolved-evidence gap — the optional `externalAnchor?` input means a no-receipt pack still generates. `pack-format.ts` untouched (the parallel lane owns any pack-format bump — cross-lane seam honored; the tag rides `generate.ts`'s result interface, the minimal insertion point).

**8. Zero Rekor. PASS.**
Diff grep for `rekor|hashedrekord|opentimestamp|sigstore|inclusion-proof|SigningConfig|TUF` (excluding gate/comment/`v1.1` references) returns **nothing**. `transparencyTargetSchema` is a discriminated union of one (`tsa`) — the v1.1 variants slot in without a rewrite but no `externally-transparent` transport exists. The externally-transparent grade is UNREACHABLE in v1 output.

**9. Egress is imprint-only. PASS.**
`TsaAnchorLog.submit` DER-encodes a `TimeStampReq` whose `messageImprint = sha256(anchorBytes)` (`anchor-transparency.ts:300`) — hashes only, no payload/PII. `fetchWithTimeout` at a 20s default (`:255`), never `AbortSignal.timeout`; sub-1s refused. Docs state imprint-only egress.

**Cadence config surface matches Fork B. PASS.**
`services/license/src/anchoring-scheduler.ts`: inert-until-armed (`ANCHOR_CHECKPOINT_SCHEDULE` unset ⇒ returns, no pg-boss connection — test asserts the queue factory is never called); daily default, configurable; **hourly floor** enforced by `assertHourlyFloor` (rejects any cron whose minute field isn't a single fixed 0–59); cross-tenant enumerate via `withAdminWrite` (no `app`-policy widening); boot-failure logs one stderr line, never throws past start. Hosted in `services/license` (ADR-0346 P3). All green.

## Engineering-floor + lock compliance

- ADR-0346 P1 (reimplement TSA port locally, no `signing-primitive` dep): the port + stub + live client are self-contained in `anchor-transparency.ts`; `audit-worm`'s dependency set gained only `pkijs`/`asn1js`/`@caisson/jobs` — no `signing-primitive` edge.
- ADR-0346 P2 dep choice recorded in the T2 commit body: `pkijs@3.4.0` + `asn1js@3.0.10`, both **BSD-3-Clause** (commercial-redistribution compatible, lands in a commercial pkg so Apache base is unaffected), pinned **exact**, both years old (past the bunfig `minimumReleaseAge` 7-day window). `bun.lock` clean (no drift on install).
- ADR-0346 P4: dedicated `anchor_outbox` PG table, tenant RLS (NULLIF-hardened) + guarded `admin_write` policy, states persisted before egress.
- TS-strict (tsc exit 0), Bun-only, Zod `.strict()` at every boundary (`strictObject`/`parseStrict`), `safeEqualFixed`/`timingSafeEqual` for every digest/imprint compare, `fetchWithTimeout` ≥20s, no `any`, no `console.log` in product code (the one grep hit is a doc-comment). Live TSA test self-skips via `test.skipIf(CAISSON_TSA_LIVE_URL == "")`.
- Changesets `.changeset/exec-anchor-{audit-worm,compliance-core}.md` present; the audit-worm one names the frozen Compliance-members-fold ripple (`compliance/manifest.ts` pins `@caisson/audit-worm`) and asserts the CR-16 `packages/jobs`-untouched boundary.

---

## Gaps / queued follow-ups (non-blocking — plan-acknowledged reconcile-time work)

1. **Production boot-wiring is deferred to the wave reconcile (by design).** `startAnchorCheckpointScheduler` is exported + fully tested but **not yet called from `services/license/src/deploy.ts`** (its twin `startCreditExpiryScheduler` is), and no concrete `CurrentAnchorReader` adapter exists outside the interface + test stubs. Both depend on the parallel lane that adds signed-anchor fields to `chain-store.ts` (the accessor that reads the current anchor's exact `encodeAnchor` bytes) — which the CROSS-LANE SEAM explicitly forbade this lane from editing. The PLAN itself scopes this wiring to "scheduler time (services/license) or reconcile, once the chain-store accessor lands" (T4 note) and Fork C ("deploy.ts constructs these at boot"). The scheduler is inert-until-armed, so an un-wired boot call carries no live risk — the feature is dormant until reconcile wires it. **Action: reconcile session wires `deploy.ts` (construct `AnchorCheckpointDeps`: `TsaAnchorLog` from buyer config + a `CurrentAnchorReader` over the new chain-store accessor) after both parallel lanes merge.** Not a VERIFY failure — it is the seam split's intended boundary.
2. **Operator-owed cross-repo row (flagged, not executed):** gridwork-core `identity/security-surfaces.md` needs a TSA egress-sink row for caisson's own deployment when the scheduler is armed in prod. Documented in `docs/security/external-anchoring.md` §Cross-repo follow-up; outside this repo's tree.
3. **Frozen-members-fold republish** of the Compliance bundle (`compliance/manifest.ts` `@caisson/audit-worm` pin) is a downstream release act, named in the changeset — not a V1 code task.

## Non-goals confirmed absent

No Rekor/OTS/public-log transport, no `hashedrekord`, no offline inclusion-proof verify, no per-row external badge, no UI (`packages/ui`/`apps/site` untouched), no DSSE/in-toto, no Merkle super-root, no `chain-store.ts`/`kernel` edit beyond the (absent) append path, no ADR filed this session.

**VERIFY result: PASS.** V1 achieves the SPEC Goal at library/component depth with every load-bearing property proven and green; the single remaining item is integration boot-wiring the plan deliberately deferred to the wave reconcile behind the parallel chain-store lane. No new PLAN cycle required; the feature does not SHIP end-to-end-live until the reconcile wiring lands (follow-up 1), which is the wave's chartered sequence.
