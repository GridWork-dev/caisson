# Open PR adversarial grill — 2026-07-25

## Verdict

**BLOCK. Five findings survived refutation: three P1 and two P2.**

Candidate accounting:

| Scope                | Candidates | Refuted | Confirmed |
| -------------------- | ---------: | ------: | --------: |
| PR #332              |          4 |       4 |         0 |
| PR #333              |          6 |       5 |         1 |
| PR #334              |         13 |      12 |         1 |
| PR #335              |         20 |      17 |         3 |
| Cross-PR integration |          1 |       1 |         0 |
| **Total**            |     **44** |  **39** |     **5** |

Each hypothesis was counted once after deduplication. Per the grill rule, the 39 refuted
hypotheses are not reported as findings.

## Coverage and attribution

All refs were fetched locally and every changed file was read from the corresponding local ref.
No capped `gh pr diff` output was used.

| Scope                                                             | Compared as           | Files | Diff stat                          |
| ----------------------------------------------------------------- | --------------------- | ----: | ---------------------------------- |
| PR #332 (`fbfcad737f404060ea56af172541480ded2d4e55`)              | `origin/main...pr332` |   138 | 6,351 insertions, 2,204 deletions  |
| PR #333 (`ee536b054a43e4b076be78dbb19d91e5700b048c`)              | `origin/main...pr333` |   138 | 6,765 insertions, 2,187 deletions  |
| PR #334 (`5a91dc3df8da350118e8b900cf527cc2af7a5122`)              | `origin/main...pr334` |   160 | 7,850 insertions, 2,378 deletions  |
| PR #335 full context (`39b437887052469e262ae421920d90e98a4842d6`) | `origin/main...pr335` |   254 | 15,731 insertions, 2,751 deletions |
| PR #335 lane-A attribution                                        | `pr334...pr335`       |   134 | 9,988 insertions, 568 deletions    |

`origin/main` was `fe2dfacaa2693578f49baf431f6d0865486174a6`. The local `pr334` and
`pr335` refs currently diverge by 14/18 commits and share merge base
`7dbe7cd0863757bbe2e2bd5ef90f323a6a9d5a19`; findings below attribute lane-A work using the
operator-specified `pr334...pr335` comparison.

## Surviving findings

### P1 — #335: the “self-contained” signed evidence pack executes an unsigned verifier

**Location:** `packages/kernel/src/evidence/pack.ts:109`, `packages/kernel/src/evidence/pack.ts:274`,
`packages/kernel/src/evidence/pack.ts:280`

The pack seal covers the ordered receipts and metadata, but not `verify.mjs`, `README.md`, or a
signed manifest of the file set. The top-level `sha256` covers those files, but it is itself
unsigned and travels with them.

**Concrete reproduction:** intercept an otherwise valid exported pack, leave `receipts.json` and
its valid `packSeal` unchanged, replace `verify.mjs` with a program that prints `PASS`, and
recompute or replace the unsigned top-level `sha256`. The bundled README directs the recipient to
run `node verify.mjs receipts.json`; the substituted program reports PASS without checking the
signature. The valid seal cannot detect the substituted verifier because its payload at
`pack.ts:109-137` contains no verifier or file-manifest digest.

**Required fix:** sign a canonical manifest containing every file name and digest, including the
verifier and README, and require that manifest/archive signature to be verified by a trusted
bootstrap before executing the bundled script. That bootstrap must be independently installed,
out-of-band pinned, or use a standard trusted signature-verification tool; an embedded verifier
cannot establish its own integrity.

### P1 — #335: server-side “redacted” exports leak secrets under unrecognized key names

**Location:** `packages/kernel/src/redact.ts:14`, `packages/kernel/src/redact.ts:50`,
`apps/admin/src/lib/audit-proof.ts:213`

Redaction is a denylist of exact separator-normalized key names plus a small set of recognizable
string shapes. Common secret-bearing keys such as `credential`, `credentials`, `auth`,
`clientAssertion`, and `setCookie` are not covered. An opaque secret value that does not resemble
an AWS/GitHub/OpenAI/JWT token also passes the string scrub.

**Concrete reproduction:** store an audit payload
`{"credentials":{"value":"hunter2"}}`, then request the admin proof or evidence-pack export.
`collectRedactedPaths` finds no redactable path, `redacted` remains false, and `redactValue`
returns the payload unchanged. The plaintext `hunter2` is present in the returned receipt and
`receipts.json`; this is server-side disclosure, not merely a client-side hiding failure.

**Required fix:** make exported audit payloads fail closed through event-specific allowlisted
schemas (and reject secret-bearing audit writes at their source). As defense in depth, broaden
semantic key detection to credential/auth/cookie variants and add negative tests for opaque values
under `credential(s)`, `auth`, `clientAssertion`, and `setCookie`.

### P1 — #333: production Paddle mapping validates markers, not the money or cadence behind them

**Location:** `tools/paddle-catalog-recreate.ts:226`, `tools/paddle-catalog-recreate.ts:313`,
`tools/paddle-catalog-recreate.ts:364`

`PaddleObject` models only IDs, custom markers, and nested prices. `buildCatalogMapping` checks
that each planned marker exists exactly once, but ignores the active price's actual
`unit_price.amount`, currency, billing cycle, and the product attributes that distinguish a
one-time license from a subscription.

**Concrete reproduction:** return a complete active Paddle snapshot with the expected
`caisson_id`/`caisson_key` markers, but make the `compliance` price `100` JPY (or USD cents) with
the wrong billing cycle. The loop at lines 364-383 accepts it and emits
`prices.compliance = <wrong-price-id>`. The production export therefore wires checkout to the
wrong charge instead of failing. The same marker-only logic also treats the price as already
present during recreation, so rerunning onboarding does not repair it.

**Required fix:** parse and compare every active marked product/price against the plan before
emitting a mapping: exact integer amount string, expected currency, one-time versus recurring
billing cycle/frequency, active status, owning product, and locked product/tax attributes. Add
wrong-amount, wrong-currency, wrong-cadence, duplicate-active-price, and misplaced-price tests.

### P2 — #334: upgrade credit drops the recorded currency and hardcodes a two-decimal USD conversion

**Location:** `packages/pricebook/src/upgrades.ts:198`, `packages/pricebook/src/upgrades.ts:222`,
`packages/pricebook/src/upgrades.ts:281`, `apps/site/lib/upgrade-quote.ts:24`

The grant correctly persists `charged_amount` together with `charged_currency`, but the exported
quote API accepts only `paidMinorUnits`. It divides every value by 100 and compares the result
directly with integer USD retail. That is invalid for a non-USD transaction and for currencies
whose minor-unit exponent is not two.

**Concrete reproduction:** a Paddle event records `charged_amount = 29900` and
`charged_currency = "jpy"` for a single `field-crypto` grant. Calling
`resolveUpgradeCredit("field-crypto", "compliance", 29900)` returns a **$299** credit. The value was
¥29,900, not 29,900 US cents; the function has converted it into a different currency merely by
dividing by 100. `bundleUpgradeQuote` exposes the same currencyless map.

**Required fix:** carry `{ amountMinorUnits, currency }` through the read and quote APIs. Compare
only like currencies under an integer, versioned conversion policy. If the checkout currency is
USD and no locked conversion exists, reject or omit non-USD paid floors and fall back to retail;
never infer USD or a two-decimal exponent from the integer alone.

### P2 — #335: the Inngest adapter silently violates the queue’s `singletonKey` contract

**Location:** `packages/jobs/src/queue.ts:27`, `packages/jobs/src/inngest.ts:64`,
`packages/jobs/src/inngest.ts:83`

The queue contract promises that a second enqueue with the same `singletonKey` while a job is
queued or active is a no-op. The Inngest adapter accepts the option and then deliberately discards
it. Existing callers use this contract for retention, audit checkpointing, access-review closure,
and parked-agent resume work.

**Concrete reproduction:** call `queue.enqueue(task, payload, { singletonKey: "acct-1" })` twice
before the first run completes. The adapter makes two `client.send` calls with no singleton field
or function-level singleton expression, so Inngest can queue and execute both jobs. For callers
that rely on the port contract, both side effects run instead of the second enqueue being a no-op.

**Required fix:** map the option to Inngest v4 native singleton handling using a reserved,
validated event-data field and a function singleton expression, with tests that prove overlap
suppression. If the adapter cannot implement the contract safely, throw whenever `singletonKey`
is supplied rather than silently weakening it.

## Cross-PR merge compatibility

No incompatible same-file edits survived. A three-way `git merge-tree` simulation from the shared
base produced zero conflict markers for all six PR pairs.

The only exclusive-tail overlaps were:

- #332/#334: `.changeset/site-test-generates-docs-source.md`, `apps/site/package.json`
- #333/#334: `docs/ops/launch-runbook.md`, `docs/state/production-readiness.md`
- #334/#335: `docs/build-state.md`, `services/license/src/admin-mutations.integration.test.ts`

#332/#334's two overlapping blobs are byte-identical. The documentation/test overlaps merge without
conflict markers. The other three PR pairs have no exclusive-tail file overlap.
