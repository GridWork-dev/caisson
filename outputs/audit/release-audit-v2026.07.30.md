# Release audit — v2026.07.30 (the state-recon wave: kernel barrel split, blind sot gates, F3 bearer)

- **Scope:** the cumulative diff since the last shipped release tag, `v2026.07.27.1..dba957bb` —
  176 files, +4,597 / −1,001, 17 commits. Carries the ADR-0394 refund-netting money work
  (#361, #365) and its already-deployed `0033` migration, the ADR-0395 state-recon wave
  (#367–#372: three blind `sot` gates, the `@caisson/kernel` node-only split, the hosted macOS
  runner, the F3 internal-proof bearer, the Article 50 draft, and the knip coverage gap), plus the
  `v2026.07.27.1` release/deploy receipts that closed the previous train.
- **Tree:** `main` at `dba957bb`. One pre-tag fix was produced by this audit and rides in #373 (§4).
- **Lanes:** a main-thread review (§2–§6), then the full SHIP-audit lane run independently and
  without sight of it — `gw-security-auditor` (fable, on the money/licence/crypto seams) and
  `gw-code-reviewer` (opus, on correctness and release integrity). §8 records what the independent
  lanes returned, including one finding this audit's main-thread pass got wrong and one the
  security lane got wrong. Every diff read used `snip proxy git`; the plain output is
  hook-filtered and returns false negatives.

## 1. Verdict

**PASS with one pre-tag fix and five disclosures.** No live exploit, over-grant, money defect, or
secret leak found in the diff. The one blocker was mechanical, caught by the repo's own byte gate
rather than by review, and is fixed in #373.

## 2. What was checked and how

| Seam                                               | Method                                                                                                                                                                          | Result                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refund netting / upgrade-credit floor (#361, #365) | Read `apply-billing-event.ts`, `entitlement-store.ts`, `platform-reads`; traced the `charged − refunded` read and the idempotency anchor                                        | Clean; one disclosed ordering hole (D5)                                                                                                                              |
| Migration `0033` integrity                         | `git log d7f7d834..HEAD` over the SQL's defining file — the migration was applied to production in `d7f7d834`, so any later edit fails the next deploy closed on checksum drift | **Untouched since prod apply.** Tail append at the max prefix, `integer` minor units, nonneg CHECK, deliberate NULL-in/NULL-out                                      |
| Secret comparison                                  | Grepped every changed non-test `.ts` for `===`/`Buffer.compare` on token/secret operands                                                                                        | No true positives. Hits were documentation code-samples in `glossary.ts`, a `token === undefined` null check, and a count comparison in `sot-check.ts`               |
| Provider webhook envelope                          | Checked `.strict()` against the Paddle event parser                                                                                                                             | Correct — `paddle-events.ts:25` is explicitly non-strict with the reason recorded. `.strict()` appears only on first-party mutation boundaries                       |
| Outbound fetch                                     | Grepped changed non-test `.ts` for bare `fetch(`                                                                                                                                | None; `fetchWithTimeout` discipline intact                                                                                                                           |
| Hardcoded credentials                              | Pattern scan over added lines across `.ts/.tsx/.yml`                                                                                                                            | None                                                                                                                                                                 |
| F3 internal-proof bearer (#370)                    | Read `internal-proof-auth.ts` end to end                                                                                                                                        | Sound (§3)                                                                                                                                                           |
| Kernel `.` barrel browser-safety (#368)            | Ran `packages/kernel/src/browser-safety.test.ts`                                                                                                                                | 4 pass. The guard is a static source-graph walk, which is the only thing that works here — a Turbopack build substitutes a polyfill for a `node:` import and exits 0 |
| Whole-repo gates                                   | `bun run check`, `bun run sot`                                                                                                                                                  | 224/224 tasks, standards-gate conforms, sot green on all nine                                                                                                        |

## 3. F3 bearer — verified sound

`apps/admin/src/lib/internal-proof-auth.ts` now issues `<unix-seconds>.<hmac-hex>` with the HMAC
over `<unix-seconds>\n<accountId>`. Verified: `timingSafeEqual` behind an explicit length guard;
the account-id schema rejects whitespace and control characters, so `\n` is an unambiguous
separator and the timestamp cannot be smuggled into the account field; the skew check is written
`!(Math.abs(nowSec - issuedAtSec) <= WINDOW)`, the negated form that **rejects** on `NaN` rather
than falling open — the exact failure mode that bit this repo before; and the host must be a
`.railway.internal` name.

## 4. Blocker found and fixed pre-tag

**B1 / P0 — sibling-churn: `@caisson/ui@0.6.3` no longer re-packs to its advertised bytes.** The
version-PR run (30557232550) failed its byte gate: `recorded=04201a00…/123330B` vs
`would-be=0d55cb5f…/123331B`, under a changed `bun.lock` hash. `packages/ui` has **no commits**
since the last tag — its source is untouched. The drift is `@caisson/ds-manifest: "workspace:*"` in
its devDependencies, which `bun pm pack` resolves to a concrete version inside the packed
`package.json`; that sibling moves in this release. `bun.lock` shifted in three commits since the
tag (#360, #368, #372), so this is not attributable to any single change.

Publishing changed bytes under an already-advertised version is exactly the integrity violation the
gate exists to catch. **Fixed** in #373 by the disposition the gate itself prescribes — a changeset
bumping the package's own version so a fresh row is recorded, rather than overwriting an advertised
one. No source change, no behavior change.

Worth stating plainly: this was caught by tooling, not by reading. A reviewer would not have found it.

## 5. Disclosures (none blocking)

**D1 — `native-ext (macos)` is red on every `main` push, for a billing reason.** The leg moved off
the offline self-hosted Mac mini to a hosted `macos-15` runner in #369; the hosted job now fails in
9 seconds with zero steps executed: _"The job was not started because recent account payments have
failed or your spending limit needs to be increased."_ It is **not** in `REQUIRED_CHECKS`
(`check`, `standards-gate`, `registry-index`, `oscal-conformance`, `deterministic`), so it does not
stop the train — but the macOS native-extension leg has no coverage until the spending limit is
raised, the Mac mini returns, or the leg is dropped. #372 separately restored the check's
`native-ext (macos)` name, which the matrix change had silently renamed to
`native-ext (macos, macos-15)`. Operator decision.

**D2 — the F3 legacy bearer branch is still accepted.** The bare-hex form (HMAC over the account id
alone, no expiry) remains valid so the verifier could deploy ahead of the issuer without 401ing the
seam mid-rollout. Until it is removed, a leaked old-format credential has unbounded lifetime, which
is the whole defect F3 set out to close. The removal is marked in-file with a `ponytail:` comment
and is due after the fleet deploy this release carries. **F3's security gain completes only then.**

**D3 — the `@caisson/kernel/node` doc flip is not in the tagged tree yet.** Three buyer-facing
surfaces (`build-vs-buy`, `frameworks/eu-ai-act`, `content/docs/base/kernel.mdx`) still show
`import { verifyChain } from "@caisson/kernel"`. That is correct against the served 0.6.0 and
becomes wrong the moment 0.7.0 publishes, since `verifyChain` leaves the `.` barrel. Because the
site redeploys on any push to `main` while the registry publishes only on release, **both
orderings have a broken window** — there is no atomic option. The flip must be per symbol, not per
block: `canonicalize`, `scrubDeep`, `scrubForEgress`, `looksLikeSecret`, and `assertNotReadOnly`
stay on `.`; only the hashing, constant-time-compare, SSRF, and migration-assembly functions move.

**D4 — ADR-0395 decision 2 is partially delivered.** The ADR retires the `components/poke/` mirrors
for `trust-page`, `access-review`, `risk-register`, and `artifact-render`. #368 delivered
`trust-page` and `artifact-render` — `trust-page-poke.tsx` now drives the real packages. The
`access-review`, `risk-register`, and `frameworks-pack` mirrors remain, and those packages are
still declared-but-unimported in `apps/site`. Two of the three are priced SKUs. Not a defect in
what shipped; an unfinished decision.

**D5 — refund ordering hole, disclosed in-code.** A refund that overtakes its own
`transaction.completed` finds no grant row to write to; the later grant then stamps a full
`charged_amount` with no refund against it, and Paddle will not redeliver the acked adjustment. The
handler detects the zero-row case and says so rather than discarding the signal. The sibling claw
and line revoke have the identical hole by construction, so this is the handler's standing ordering
posture, not a new one — and it errs toward the buyer.

**D6 — the "live-hybrid retrieval golden leg" does not discriminate. It passes with an invalid API
key.** Checklist box 6 asserts that `services/docs`' 13 golden retrieval tests prove live hybrid
(vector + FTS) retrieval against real embeddings. Reproduced three ways:

| Run | Key   | Cache       | Result                                                                                                                                  |
| --- | ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | real  | warm        | 13 pass, 108.6s — **4 of 13 queries logged `query-embed deadline hit — serving this query on the FTS floor`**                           |
| 2   | bogus | warm        | 13 pass, 0.44s — confounded, the embed cache served everything                                                                          |
| 3   | bogus | **cleared** | **13 pass, 2.24s** — no valid credential, no cache, every embed fails, every query degrades to the FTS floor, every golden still passes |

Run 3 is the decisive one. `retrieval-golden-hybrid.live.test.ts:31-32` gates on
`HAVE_KEY = KEY.length > 0` — presence, never validity — so an invalid key does not skip the suite,
it runs it against a store that has silently degraded. The goldens are satisfiable on the FTS floor
alone, so the leg proves FTS works and says nothing about the vector leg it is named for. Note run 1:
even _with_ real keys, 4 of 13 queries served on the FTS floor and still passed.

This is not a product defect — `index-store.ts` degrading to FTS on a slow or failed embed is
correct, deliberate behavior. It is a **gate** defect, and the same class as the three blind `sot`
gates this release repairs: green over a claim the check cannot see. It does not block the tag —
the service behaves correctly — but box 6 should be understood as "FTS retrieval goldens pass", not
as live-hybrid assurance, until the suite fails closed on an unusable credential and asserts that
the vector leg actually contributed.

## 6. Standing weakness this audit re-confirms

`tooling/scripts/` has **no `package.json`**, so turbo never typechecks it and its `*.test.ts`
files run in **no CI job at all** — `ci.yml`'s explicit `bun test` invocations do not name them.
The three `sot` gates repaired in #367 are the mechanism that guards source-of-truth doc accuracy,
and they are themselves unguarded. Their own tests passed locally in the lane that wrote them; that
is the only thing standing between a future edit and a silently blind gate. This is not new to this
release and is not a blocker for it, but it is the highest-leverage unpaid debt in the release path.

## 7. Not covered

- The independent adversarial verification pass (see §Lane).
- Live-transport behavior: no live leg was exercised by this audit. The checklist's live-hybrid
  retrieval gate (`--local`) is a separate box.
- `apps/site` visual/UI regression — no browser lane ran.
