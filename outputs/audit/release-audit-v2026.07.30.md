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

- `apps/site` visual/UI regression — no browser lane ran.
- Runtime behavior of the deployed fleet beyond the endpoint probes and the live retrieval leg.

## 8. The independent SHIP-audit lanes

Both lanes ran against `v2026.07.27.1..b5cd9d61` without sight of §2–§6, so their agreement is
evidence and their disagreement is signal. **They found three blockers the main-thread pass
missed — one of which would have broken production for every buyer.** That is the case for the
lane, stated plainly.

### BT-2 — the train deploys the bearer _issuer_ without the _verifier_ (CONFIRMED, was going to ship)

`release-train.yml` leg 4 dispatches `deploy-railway.yml`, which deploys **one service**:
`--service caisson-site`, hardcoded, no service input. The F3 change (#370) ships the issuer
(`apps/site/lib/tenant-evidence.ts`, now minting `<unix-sec>.<hmac>`) and the verifier
(`apps/admin/.../internal-proof-auth.ts`, which accepts both forms) in the **same commit** — and
the file's own comment names the required order: _the verifier deploys before the issuer._

Verified independently: `git merge-base --is-ancestor 07391314 f9c04f33` → **NO**. Live admin is
running the pre-F3 verifier, whose regex is `^Bearer ([0-9a-f]{64})$` and cannot match a
timestamped credential. So an unmodified ride publishes a site that mints bearers the live admin
rejects → **hard 401 on the buyer evidence dashboard and the audit-proof route, for every buyer,
until someone manually deploys admin.** `docs/ops/launch-runbook.md` states the ordering principle
but lumps "deploy site and admin" into one unordered step, so the manual path is unguarded too.

This is a standing gap, not a one-release accident: _no_ admin/license/docs/support-bot change has
ever ridden the train. Disposition is the operator's — see the release checklist.

### BT-1 — `bun run sot` was RED on `main`, and it is a blocking readiness check (CONFIRMED, FIXED)

`dba957bb` moved `docs/ops/db-restore.md`, a declared `grounds:` path of
`docs/ops/incident-response.md`, without restamping the dependent. Reproduced. `release-readiness.ts`
runs `bun run sot` as check 4 and `propagate` declares `needs: readiness`, so **publishing the
Release would have stopped the train at leg 0** — no publish, no mirror, no deploy. Fixed in the
version PR. This is the freshness gate's new `grounds:` cascade doing exactly its job, one release
after being taught to see.

### BT-3 — the kernel doc flip (CONFIRMED, FIXED)

Independently reached the same conclusion as D3, and **corrected its error identity**: the failure
is `SyntaxError: does not provide an export named 'verifyChain'`, not the
`ERR_PACKAGE_PATH_NOT_EXPORTED` the in-code comments predicted — that is the inverse error. Fixed
in the version PR, per symbol.

### Where the lanes were wrong, and where this audit was

- **The security lane's D1 timing claim is wrong.** It held that the F3 legacy-bearer branch is
  already removable because "the fleet deploy after this change" is in-range at `d7f7d834`.
  Verified false: `d7f7d834` is commit 11 of 17 and #370 is commit 14 — the deploy **precedes** the
  change, and `git show d7f7d834:apps/admin/src/lib/internal-proof-auth.ts` contains no
  `TIMESTAMP_WINDOW_SEC`. The deploy that carries the verifier is _this train's leg 4_. Acting on
  that finding would have removed the compatibility branch mid-rollout and caused the very outage
  BT-2 describes. The finding itself (unbounded legacy credential) is real; only its timing was not.
- **This audit's §2 "whole-repo gates: sot green" was stale.** It was true on the branch where it
  was run and false on `main` by the time the wave landed. The code lane caught it. A gate result is
  only as good as the tree it was run against.
- **Neither lane, nor this audit, found the sibling-churn (§4).** Tooling did.

### Additional disclosures from the lanes (verified, none blocking)

- **`browser-safety.test.ts` misses three taint forms.** Empirically mutation-tested by the code
  lane: it catches `node:`-prefixed static imports, but a bare `from "crypto"`, a dynamic
  `await import("node:crypto")`, and a node-only third-party dep (`pg`) all pass. Bundlers polyfill
  the first two identically. The repo is clean today (zero bare node-builtin specifiers) and no
  eslint rule backstops it.
- **`changeset-gate-preflight` reports GREEN unconditionally on `main`.** The widened gate is
  honest in its text but hardcodes `status: "green"` on `main`, so `[GREEN]` there is a label with
  no assertion behind it. It was already blind there, so nothing regressed — but two of the three
  repaired gates genuinely assert and this one still does not.
- **Scalar / whole-transaction partial refunds never record `refunded_amount`.** `recordLineRefund`
  is called only in the per-line branch; a provider partial arriving with `items: []` leaves the
  upgrade-credit floor at the pre-refund price. Latent — `paidByItemForAccount` has no caller.
- **`readAdjustmentItems` can poison-pill a delivery.** Throwing on a duplicate `item_id` returns
  non-2xx, so the provider redelivers the same malformed adjustment indefinitely. Deliberate, but
  there is no dead-letter path if the "shape the provider never produces" assumption is ever wrong.
- **Two gate-shape notes:** `gatherDiskTotals` license buckets can disagree with the total if a
  manifest carries a third licence value (balanced today, 63 = 17 + 46), and `readIndexMembers`
  returns an empty member set rather than a shape error on an empty `versions` array.

## 9. Addendum — one commit landed after this audit was written

This audit was written against the cumulative diff through `ee467149` (the merged version PR).
One commit landed after it and rides the same tag, so it is reviewed here rather than left
outside the artifact.

### `80748af3` — deploy verdict moves off the CLI exit code (CONFIRMED, FIXED)

**What it fixes.** `railway up --ci` exits non-zero when its build-log stream drops. On
2026-07-30 that happened on five consecutive `deploy-railway` runs — `Failed to stream build
logs: Failed to retrieve build log`, ~64s in — while Railway's own deployment ledger recorded
those same deployments as `SUCCESS`. The deployment id printed by the "failed" admin step,
`e6893546-c5aa-4278-8b1e-2e0e1c116727`, is `SUCCESS` in the ledger.

**Why it was blocking for this release.** Not cosmetic, and not merely noisy. BT-2 (§8) had
just made `deploy-railway.yml` ship the internal-proof **verifier** before its **issuer**, so a
flake on the first service skips the second — which is exactly what run `30562233469` did. Leg 4
of the train would have failed the same way, _after_ legs 1–3 published irreversibly. The
half-deploy was the damage; the false RED was the cause.

**How it is fixed.** `railway-deploy.ts` records the newest deployment id before uploading, then
polls `railway deployment list --json` for a terminal state and succeeds only on `SUCCESS`. The
CLI's exit is logged but is no longer the verdict.

**Why not `--detach`.** It also dodges the log stream, and it is strictly worse: it reports green
the moment an upload is _accepted_. That is a false green — the failure mode the workflow's
arm-guard exists to prevent, and the one previously recorded against this very workflow. Polling
for a terminal state is the only shape that is neither a false red nor a false green.

**Adversarial checks against "this is now a rubber stamp":**

- A genuinely `FAILED`/`CRASHED`/`REMOVED`/`SKIPPED` deployment still throws. Tested.
- An upload that never creates a deployment (the `railway up` 500-on-upload seen the same day)
  fails fast after a short grace, rather than passing because nothing contradicted it. Tested,
  both for "ledger head never moves" and "service has no deployments at all".
- An **unrecognized** status stays `pending` and is re-polled — never guessed as success. A future
  Railway status string cannot silently become a pass.
- The correlation is by id against a pre-upload snapshot, so a pre-existing `SUCCESS` at the head
  of the ledger cannot be mistaken for this run's deployment.
- The CLI JSON envelope is parsed **non-strict** on purpose: `meta` is a large vendor-owned object
  on Railway's release cadence. Same rule this repo applies to provider webhook envelopes — and
  the inverse mistake (`.strict()` on a vendor envelope) is a recorded past incident here.

39 unit tests pass, and `latestDeployment` was smoke-tested against the real CLI across
`caisson-admin`, `caisson-site`, and `caisson-license`.

### Fleet state this audit leaves behind

`apps/admin` is deployed at `ee467149`; `apps/site` is at `dba957bb`. That split is **safe and
verified**, not merely assumed: the deployed verifier's bearer regex makes the timestamp prefix
optional, the skew check is gated on `timestamp !== undefined`, and the HMAC preimage branches on
the same condition — so the new verifier accepts both the legacy bare-hex bearer the current site
issues and the new timestamped form. New-verifier/old-issuer is the benign direction. It also
means the tracked removal of the legacy branch must wait until site reaches `ee467149` or later.

Site being one commit behind is additionally **required** until leg 1 publishes: `ee467149`'s
`build-vs-buy` and `eu-ai-act` snippets point at `@caisson/kernel/node`, which does not exist at
the currently-served kernel 0.6.0. The train's leg order (publish, then deploy) is what makes the
flip correct, and the guard comment `#368` left in the page said so before this audit did.

### Correction to §5, D-series

An earlier reading of the deploy failures concluded the Railway deploy path was down and the
fleet had stopped receiving deploys. That was **wrong**, and is corrected here: the deploys
landed every time. The live-site probe that appeared to confirm an outage was not decisive — the
changelog entry it looked for was introduced by `ee467149` itself, whose site step was skipped
rather than attempted. Railway's deployment ledger is the authority for this question; the
GitHub Actions conclusion is not, and that is precisely what `80748af3` fixes.
