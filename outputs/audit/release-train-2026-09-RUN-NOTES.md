# S8 release train run notes — 2026-09-10

## R370 CR-07 — reviewed-parent attestation lifecycle (2026-09-16)

S8_REPAIRS_2 locks option A. ADR-0425 records schema v2 reviewed_sha = final
candidate single parent; only the exact tag audit and checklist paths can change in
its successor. The allowlist is one constant, compared against a NUL-delimited Git
name census with renames disabled and filename whitespace preserved. Committed blobs
are read directly; merge successors and non-regular attestation files fail closed.
Final CI still uses the final tag SHA. No real release tag, audit or publication is made.

Verification: **Bun 1.4.2 — 32 pass / 0 fail / 70 assertions**, exit 0, both initial
and restored suite. Scratch Git repositories build A (reviewed product), write audit
naming A and commit B; B passes. Product/neighboring policy paths and a wrong real
reviewed commit fail. Dirty worktree evidence cannot replace B. Named script lint passes.

Three mutation arms (Bun 1.4.2) each exit 1: path allowlist removed **0 pass / 1 fail /
1 assertion**; reviewed-SHA comparison removed **0/1/1**; self-referential tag SHA
restored **0/1/2**. Every arm restores scripts/release-readiness.ts byte-identically,
SHA-256 `3bd8305c9284d7fc68d2211d55166da8f880bb4f3bb110bbf545b7329f9f9d04`.
Machine evidence: estate handoff S8-R370-CR07-mutation-{paths,binding,lifecycle}.result.json;
full green logs S8-R370-CR07-tests.log and S8-R370-CR07-restored.log.

CR-08 and WR-01 remain to execute, then targeted coverage, one bounded full gate and
both sequential reviews. The prior review hold is superseded only for this ruled repair
cycle; there is no passing independent review yet. No push or PR.

## R359 HOLD — renewed code review BLOCKED (2026-09-16)

The bounded full gate passed, then governed code review completed on candidate
`c6156d8ce916ced54fba3309b6999c9a7a73167a`, thread
`01a0a84b-a63d-7431-a961-aa2bf55bcf66`. Process exit 0 means report delivery;
the substantive verdict is **FAIL / BLOCKED**, reviewed 03:48:24Z, 46 files,
two blockers and one warning. No conforming-command denial was observed.

Finding titles, verbatim:

- **CR-07: The exact-SHA audit contract is self-referential and cannot produce a green release**
- **CR-08: Checkout silently falls back from the selected organization to the personal account**
- **WR-01: Denied or abandoned approvals permanently exhaust the default approval store**

Full report: [s8-r359-REVIEW.md](s8-r359-REVIEW.md). Original CR-01, CR-02, CR-04
and CR-05 are closed at the inspected seams; CR-03 and CR-06 are not fully closed.
The review does not re-audit the entire original 430-path release. Its explicit
coverage limits remain. No parent repair or new design lock followed the findings.

Raw streamed log: estate handoff/S8-R359-code-review.log, **1,214,002 bytes**,
SHA-256 `b2806e43ffe643e9746e556c5d51d98dadc1e21d368f649c7619ee860e6dab95`;
in-repo copy: [s8-r359-code-review.log](s8-r359-code-review.log).
Exact unformatted report is preserved in handoff/S8-R359-REVIEW-VERBATIM.md,
**15,455 bytes**, SHA-256
`1cde9680c30caa9b4dad8c41b43fcb66e3543ca54b1e2467e75c82796972f062`.

**Security NOT DISPATCHED** under the R359 blocker stop: no second admission check,
no auditor process, no security verdict. [Security disposition](s8-r359-SECURITY.md).
The local gate's green result is not an independent security pass. The code review's
proposed reviewed-SHA/attestation-successor design, commerce resolver split and
approval rejection/expiry policy require operator disposition; no fork is chosen here.

**S8_RELEASE_HELD.** New packet, with the full findings verbatim:
`/home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-R359-REVIEW-BLOCKERS.md`.
No security dispatch, further candidate gate, push or release PR. No merge, version
dispatch, tag, publish, deployment, live probe or branch deletion. SOT not rerun
after this stop; last accepted branch/freshness disposition remains historical.
Only owned temporary-pack cleanup, receipt formatting/verification and normal
evidence commit follow. This is a review hold, not recurrence of the process-kill hold.

## R359 gate retry — full local check GREEN (2026-09-16)

`S8_GATE_RETRY` at 03:30:26Z dispositions the previous process kills as box memory
pressure, not a test verdict, and authorizes ai-kit alone followed by one full check
with bounded Turbo concurrency. Candidate: `c6156d8c`, product tree unchanged since
the six repair commits. The prior hold below is superseded by this ruling.

Read both package scripts before execution. Ai-kit command was its configured
`bun test --timeout 60000 ./src`, run inside packages/ai-kit. **Bun 1.4.2 — 170 pass /
0 fail / 602 assertions**, exit 0. Log: [ai-kit retry](s8-r359-ai-kit-retry.log).

The root check script is a shell chain, so the equivalent invocation added
`--concurrency=2` directly to Turbo and retained all four tail gates:

```sh
turbo run build lint typecheck test --no-daemon --concurrency=2 && oxlint deploy && tsc -p deploy/tsconfig.json && bun test deploy/*.test.ts && bun run gate
```

The repository node_modules/.bin was prepended to PATH, as for a package script.
**Exit 0; 199/199 Turbo tasks successful, 191 cached, 1m11.451s.** No killed task
needed an individual rerun. All captured Bun banners are **1.4.2 (744846f84)**.
Completed-suite output totals, **including cached task replay**, are **7,019 pass /
0 fail / 28,115 assertions**; these are not a claim that all tests freshly executed.
Deploy tests contributed **Bun 1.4.2 — 64 pass / 0 fail / 329 assertions** across
13 files. Standards gate: 67 checked, 5 scaffold-skipped, all conforming.
Log: [bounded full check](s8-r359-full-check-bounded.log). Raw handoff SHA-256:
`1ae1b5770e6259b3a5624b16b6bb4989b37871683bd5886a856c990e671ec3aa`.
The in-repo copy normalizes CRLF to LF before staging; raw handoff remains intact.
Normalized in-repo log: 1,221,023 bytes, SHA-256
`4550115da292095dc52bda6f01b73734892414f361dc953dc5fb6bd50f3b0cbe`.

Fresh audited headroom: **37% used**, reading 03:37Z. Renewed governed code review
was admitted, thread `01a0a84b-a63d-7431-a961-aa2bf55bcf66`, streamed by the parent
directly to handoff/S8-R359-code-review.log. Expected best-effort telemetry HTTP 500
is non-blocking under the ruling. This records admission only, not a review verdict.
Security follows only after the code-review verdict permits it. The six repaired
blockers remain subject to independent reassessment. No release PR or push yet.

## R359 HOLD — full check exits 137 outside repair scope (2026-09-16)

All six ordered repair commits are now complete:

| Repair | Commit                                     |
| ------ | ------------------------------------------ |
| CR-06  | `a415ee2143c4bd278dc5c3ef2211d068ac9127e8` |
| CR-05  | `c233a95177770a5578729a35091f1c69ac93bb73` |
| CR-02  | `46169496795f3234042345457a88450b646cbd83` |
| CR-01  | `e08b4b36c3d0d02d4f8a73b8ef99f7792e130cb1` |
| CR-03  | `f28817fea878f6e9f678a6ea4f5bee0cc3702ef1` |
| CR-04  | `7ee9b86d544808a38707992759806028ae4465cd` |

Combined post-repair targeted suite: **Bun 1.4.2 — 125 pass / 0 fail / 457 assertions**
across 13 files. Exit 99 is the explicitly accepted pre-existing auth-account outcome;
no assertion failure was suppressed. Log: [s8-r359-targeted.log](s8-r359-targeted.log).
The baseline JSON is now also in-repo for the eventual PR disclosure:
[s8-r359-baseline-exit99.json](s8-r359-baseline-exit99.json).

The single authorized full `bun run check` was run against `7ee9b86d`. **Bun 1.4.2 —
full gate exit 137**, Turbo **193 successful / 199 total tasks**, **24 cached**,
**1m5.433s**. Its named failed task is **`@caisson/ai-kit#test`**. Site build also reports
exit 130 during the failed run; it is not independently diagnosed. This is distinct
from the accepted exit 99 and outside the six repair paths, so R359's stop applies.
No retry, exit-code override, dependency change or resource workaround was attempted.
No OOM cause is asserted without evidence.

Captured completed-suite subtotals only: **Bun 1.4.2 — 5,379 pass / 0 fail /
18,241 assertions**. These omit unfinished suites and do not make the full gate green.
Every captured Bun test banner is 1.4.2 (744846f84). Full log:
[s8-r359-full-check.log](s8-r359-full-check.log), SHA-256
`5c9c524dacffbdf1a24b3c5632073622842b368208dddaa541102a8f962b0f0a`.
That hash binds the raw handoff log (1,096,319 bytes). Git normalized six CRLF line
endings on add; the committed log is 1,096,313 bytes, SHA-256
`68a6c5e1017c6e100af045ddf97f86f82ab01a933f7006e6d633d3de4661daac`.
Both copies retain the same test/gate output; the normalization is explicitly receipted.

Verbatim gate tail:

```text
@caisson/site:build: error: script "build" exited with code 130
@caisson/ai-kit#test:  ERROR  command (/home/gw/lab/worktrees/caisson/release-train-2026-09/packages/ai-kit) /home/gw/.bun/bin/bun run test exited (137)

 Tasks:    193 successful, 199 total
Cached:    24 cached, 199 total
  Time:    1m5.433s
Failed:    @caisson/ai-kit#test

 ERROR  run failed: command  exited (137)
error: script "check" exited with code 137
```

Installed `@changesets/cli` full-backlog status was independently refreshed with no
`--since` filter: 37 changesets, still 60 effective bumps (57 patch / 3 minor). No versions
were consumed. Machine output: estate handoff `S8-R359-changesets.json`.

Fresh review packs were prepared but neither renewed reviewer was dispatched; no fresh
headroom admission was attempted after the failed gate. Packs are preserved in estate
handoff `S8-R359-review-packs/` while held. They are not review evidence. The earlier
six-blocker review remains historical; this repair has no independent passing verdict.

**S8_RELEASE_HELD.** Packet: estate handoff `OPERATOR-ACT-S8-R359-FULL-GATE-HOLD.md`.
Remaining: operator disposition of the full-gate failure, sequential renewed code/security
reviews, release packet steps 4–6 and green PR. No PR, push, merge, version dispatch, tag,
publish, live probe, deployment or branch deletion. SOT was not run beyond the stop.

## R359 CR-04 — staging negative boundaries (2026-09-16)

Sixth ordered repair. Staging now resolves the raw fleet URL map through the shared
schema-validated tool-exec gcloud argv gate, pins returned resource names, and validates
the complete map before any HTTP probe. The workflow passes that exact output to smoke.
Each target must pass authenticated public health, credential-free public Access denial,
and credential-free raw run.app denial. Demos is explicitly IAM-only. Denial responses
establish refusal at the tested surface, not attribution to a particular middleware/rule.
No live gcloud call, HTTP probe or deployment was executed during this repair.

Initial/restored suite: **Bun 1.4.2 — 20 pass / 0 fail / 196 assertions**. Targeted lint
and deploy typecheck pass. The typecheck initially caught a test-only literal-union
expectation mismatch; widening the actual-side array through Object.keys fixed it without
changing the contract assertion. No outside-causal-path failure occurred.

Predicted guard removals, each followed by SHA-256 identical source restoration:

- Access denial assertion removed: **Bun 1.4.2 — 0 pass / 1 fail / 1 assertion**.
- Raw origin/IAM denial assertion removed: **Bun 1.4.2 — 0 pass / 1 fail / 1 assertion**.
- Pre-egress raw URL validation removed: **Bun 1.4.2 — 0 pass / 1 fail / 2 assertions**.

Fixed/restored smoke.ts SHA-256:
`23ee716d31f41f0c8c65a73261d60e3e67b7d9473707d802a2013fdd4c2dcaa3`.
Machine receipts: estate handoff `S8-R359-CR04-{access,origin,url}.result.json`.
Restored suite: **Bun 1.4.2 — 20 pass / 0 fail / 196 assertions**, exit 0.
R344 OS-only image classification remains unchanged.

## R359 CR-03 — continuation ruling and cart repair (2026-09-16)

The 03:12:07Z `S8_CR03_CONTINUE` ruling accepts the baseline exit 99 as pre-existing
and outside CR-03's causal path; it is no longer a stop for this repair. The PGlite
in-memory double is the likely teardown path; no further diagnosis or test alteration.
If the full runner reports it red, the PR must disclose it under “pre-existing, reproduced
on the pre-repair tree” and cite `S8-R359-CR03-baseline-exit99.json`.

CR-03 always resolves the real Better Auth session for ownership, then independently
rechecks tenant-scoped active exact-SKU grants before server-side Paddle transaction
creation. Client account/price/quantity overrides are rejected. Already-owned lines are
removed; all-owned carts create no transaction. ADR-0424 records the money-path lock,
configuration requirements and limited preflight guarantee; its index/CLAUDE/board ceiling
updates are in this commit. No Paddle or other live probe was sent.

Targeted restored run: **Bun 1.4.2 — 24 pass / 0 fail / 75 assertions**, exit 99 explicitly
disposed above. Site typecheck and targeted lint pass. The four required regressions cover
valid durable session without a hint, independently evicted hint, an owned checkout line,
and forged hint without a session. Real in-memory Better Auth resolves the cookie cases;
entitlement/provider seams and production binding contracts cover the remaining path.

Predicted guard mutations all failed their named test, then restored the exact source bytes:

- Hint-absence short-circuit restored: **Bun 1.4.2 — 0 pass / 1 fail / 1 assertion**.
- Owned-line filtering removed: **Bun 1.4.2 — 0 pass / 1 fail / 4 assertions**.
- Empty-cart guard removed: **Bun 1.4.2 — 0 pass / 1 fail / 1 assertion**.
- Session guard removed: **Bun 1.4.2 — 0 pass / 1 fail / 1 assertion**.
- Strict request boundary removed: **Bun 1.4.2 — 0 pass / 1 fail / 1 assertion**.
- Catalog guard removed: **Bun 1.4.2 — 0 pass / 1 fail / 4 assertions**.
- Same-origin guard removed: **Bun 1.4.2 — 0 pass / 1 fail / 0 assertions** (the test's
  must-not-read session sentinel threw, proving forbidden work was reached).

Fixed/restored cart-routes.ts SHA-256:
`abdeb8074682c0c70829c324a15c8973f2c72b22e7be516f22db0b1190c26a1c`.
Machine receipts: estate handoff `S8-R359-CR03-{hint,owned,empty,session,strict,catalog,origin}.result.json`.
Restored **Bun 1.4.2 — 24 pass / 0 fail / 75 assertions**, accepted pre-existing exit 99.

## R359 HOLD — baseline test process exits 99 during CR-03 (2026-09-16)

Repair execution stopped at the ruled red-gate-outside-causal-path boundary. Four ordered
repair commits are complete: CR-06 `a415ee21`, CR-05 `c233a951`, CR-02 `46169496`,
CR-01 `e08b4b36`. CR-03 is an uncommitted work-in-progress; CR-04 has not started. No
full `bun run check`, new review/security dispatch, push, PR, merge, tag, version dispatch,
publish, deployment or branch deletion occurred in this repair continuation.

Initial CR-03 targeted command (under the normal snip wrapper):
`bun test apps/site/app/api/cart/owned/route.test.ts apps/site/lib/cart-routes.test.ts apps/site/lib/paddle-cart-transaction.test.ts apps/site/lib/paddle-checkout.test.ts apps/site/lib/auth-account.test.ts`
reported **Bun 1.4.2 — 24 pass / 0 fail / 75 assertions**, but process exit **99**.
This is not green. Site typecheck exited 0. The new real-Better-Auth cookie regressions
alone exited 0: **Bun 1.4.2 — 4 pass / 0 fail / 11 assertions**.

Isolation: `bun test apps/site/lib/auth-account.test.ts` reproduced process exit **99**
with **Bun 1.4.2 — 4 pass / 0 fail / 9 assertions**. One controlled baseline comparison
then temporarily restored `apps/site/lib/owned-cart-items.ts` from pre-CR-03 `e08b4b36`,
ran that same unchanged test, and again measured exit **99**, **Bun 1.4.2 — 4 pass / 0 fail /
9 assertions**. This proves the nonzero outcome survives removal of the CR-03 ownership
implementation; no assertion failed, and no BLOCKED line was emitted. The underlying cause
is not established. Installed PGlite contains a process.exitCode assignment, which is a
lead only, not attribution. No exit-code reset or test-success override was applied.

The in-progress ownership source was restored byte-identically; fixed and restored SHA-256:
`0e7bc139a7c51ca39478dee71d51ae9e3514228cc9bb0746f3e6f4f176e271ea`.
Exact baseline command, exit, output and hashes: estate handoff
`S8-R359-CR03-baseline-exit99.json`.

Unfinished CR-03 introduces session-backed owned reads, server-created filtered cart
transactions and real-cookie/provider-seam regressions. ADR-0424 and its ceiling updates
are drafted but not committed; CR-03 guard mutations and final validation remain undone.
Work is preserved in the worktree plus handoff `S8-R359-CR03-in-progress.patch`,
`S8-R359-CR03-untracked.json` and the matching `S8-R359-CR03-untracked/` tree. Those are
recovery artifacts, not a completed repair or review verdict. Resume requires an operator
ruling for the baseline exit-99 gate before continuing the ordered repair cycle.

## R359 CR-01 — private digest-bound tool approvals (2026-09-16)

Fourth repair in the ordered R359 cycle. ADR-0423 records the operator lock; the index,
CLAUDE ceiling and live board agree. Execution consumes a server-private snapshot once,
checks the public and recomputed canonical digest, revalidates saved original input under
the current schema, rejects changed validated argv and derives env solely from current
CommandSpec. The pure browser preview has no execution authority. Application approval
actor authentication remains the integrating server's responsibility. Default pending
records are bounded to 1,000 and do not survive restart; durable adapters owe atomic consume.

Verification: Bun 1.4.2 — 37 pass / 0 fail / 90 assertions across tool-exec, browser graph,
demos preview and agent-dev wiring. Package build and targeted lint pass. A syntax error
introduced in the causal site-copy edit was corrected before the restored green run.

Predicted and measured guard removals (each named test RED, each restored byte-identically):

- Digest binding: Bun 1.4.2 — 0 pass / 1 fail / 1 assertion.
- Strict envelope/environment rejection: Bun 1.4.2 — 0 pass / 1 fail / 2 assertions.
- Current policy fingerprint: Bun 1.4.2 — 0 pass / 1 fail / 1 assertion.
- Current schema validation: Bun 1.4.2 — 0 pass / 1 fail / 2 assertions.
- Revalidated argv digest: Bun 1.4.2 — 0 pass / 1 fail / 1 assertion.
- Atomic consumption: Bun 1.4.2 — 0 pass / 1 fail / 1 assertion.

Fixed/restored SHA-256: tool-exec.ts
`34809fcde263c2227c3ee611a6b61bb510c3803e423328d95cb8e0fb39547667`;
approval.ts `5f1dfc347761ba28dca334e558d3fb9edb533c447cd446f4d3958372f0a6d1f2`.
Machine receipts: estate handoff `S8-R359-CR01-{digest,env,policy,schema,argv,once}.result.json`.
Restored suite: Bun 1.4.2 — 37 pass / 0 fail / 90 assertions. No review verdict is claimed.

## R359 — CR-02 resolved embedding egress

CR-05 committed as **c233a951**, clean readback, lane 46 ahead. CR-02 calls the canonical resolved URL guard immediately before every embedding request and keeps redirect:error. The construction-time literal guard remains. The test injects DNS answers into the resolver, uses the real kernel guard and proves the transport is untouched for a public-looking hostname resolving into private space. A second request with a changed DNS answer is rejected. The canonical kernel's documented resolve/fetch TOCTOU residual is unchanged; this repair does not claim connect-time IP pinning. A local-store patch changeset records the package repair.

Initial targeted tests on **Bun 1.4.2: 19 pass / 0 fail / 35 assertions**. Prediction before mutation: remove the per-request resolved check, leaving the former literal-only behavior; the named private-resolution regression must fail (**Bun 1.4.2 expected: 0 pass / 1 fail / 1 assertion**). Restore by hash, retest, lint and build the affected package before commit. No live DNS or HTTP probe.

Mutation measured on **Bun 1.4.2: 0 pass / 1 fail / 1 assertion**, with the blocked request incorrectly resolving. Fixed/restored source SHA-256 **fa41c8f387795ed4ca442ab4d1fdbfa776635426b2dac533fa40df13e11a15d4** matched. Restored suite on **Bun 1.4.2: 19 pass / 0 fail / 35 assertions**. Targeted lint and local-store build passed on Bun 1.4.2. Raw evidence: handoff/S8-R359-CR02-mutation.result.json.

## R359 — CR-05 aggregate and membership mutation predictions

CR-06 committed normally as **a415ee21**, clean readback, lane 45 ahead. CR-05 adds the always-running runtime-images-gate, depending on selector and complete matrix, failing for failure/cancellation/skip/empty results. Required-check membership and structural/behavioral contracts make this the seventh required check. R344's image classification is untouched.

Initial targeted suite on **Bun 1.4.2: 25 pass / 0 fail / 61 assertions**. Predictions before mutation: removing the matrix-result check makes the named failed-matrix test red; removing required membership makes its named contract test red (**Bun 1.4.2 expected for each: 0 pass / 1 fail / 1 assertion**). Each fixed file will restore byte-identically by SHA-256 and be retested on Bun 1.4.2 before commit. No container builds or live scans run here.

Both mutations measured on **Bun 1.4.2: each 0 pass / 1 fail / 1 assertion**. Aggregate restored hash **f7d2d7514069330a9e98168bd0e2eaeb4d673e287c1e81655f3914397512cc7d**; readiness membership restored hash **10cc88cacaee8465c1c528ba9eb67868142b9c8e9bcf9b89406a1d7f013a719a**. Named aggregate after restore on **Bun 1.4.2: 1 pass / 0 fail / 1 assertion**; final full readiness suite on **Bun 1.4.2: 25 pass / 0 fail / 61 assertions**. Raw evidence: handoff/S8-R359-CR05-aggregate.result.json and S8-R359-CR05-membership.result.json. Old six-check statements in historical receipts remain historical; current required set is seven.

## R359 — CR-06 repair and mutation prediction

R359 locks the six repairs and their order; accepted SPEC/PLAN updated in the first repair commit. CR-06's existence-only R4 decision is replaced by strict file-backed frontmatter validation, exact previous-release/tag/SHA binding, clean/zero-critical status, reviewed scope and both reviewer identities/timestamps. Graph coverage excludes scripts/; named source reads supplied the implementation evidence.

Initial targeted gate on **Bun 1.4.2: 21 pass / 0 fail / 26 assertions**. Before mutation: reverting auditArtifactIsValid to the original existence-only decision must make the named existing-empty-audit regression fail (**Bun 1.4.2 expected: 0 pass / 1 fail**); restoring the fixed bytes by SHA-256 must return the full suite green. No live release gate, forge or external probe is invoked.

Mutation measured on **Bun 1.4.2: 0 pass / 1 fail / 1 assertion**, failure was `Expected: false; Received: true` for the existing-empty-audit regression. Fixed/restored scripts/release-readiness.ts SHA-256: **27a5e18e1fb15276d8ce0bf78815ac8cdc066b13b9c7e71393e9197d448429bb**, equal before/after. Restored suite on **Bun 1.4.2: 21 pass / 0 fail / 26 assertions**. Targeted oxlint and whitespace check passed. Evidence: handoff/S8-R359-CR06-mutation.result.json. The final fixture typing adjustment does not change the mutated production bytes.

## R354/R356 retry 3 outcome — substantive review FAIL, six blockers

Fresh audited limits: **7d 23.0% used, resets 3d; reading 2026-09-16T02:04Z**. Code-review thread **01a0a7f5-e432-7dc3-8421-31c31a36f252** ran to completion without interruption. Parent-shell redirection preserved stdout/stderr directly in handoff/S8-R356-CODE-REVIEW.log; no Node REPL capture occurred. The expected best-effort telemetry 500 was ignored. Dispatch **exit 0** records successful report delivery, not a review pass.

Returned verdict, verbatim: **FAIL — six blocking correctness, security, money-path, and release-integrity defects remain.** The reviewer declares 69 reviewed files within the 89-commit / 430-path cumulative range v2026.08.18..895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c. These are source-review findings, not independently reproduced live exploits. No exhaustive review or clean R4 claim is made.

Reported blockers: CR-01 externally parked tool-approval arguments/environment are not integrity-bound; CR-02 cloud-embedding DNS destinations are not resolved before credential-bearing requests; CR-03 missing optional session hint can allow duplicate purchases; CR-04 staging bypass suite omits the negative origin/Access legs; CR-05 readiness does not require the enforcing runtime-image matrix; CR-06 R4 accepts audit-file existence without validating verdict or SHA. Full returned report: **s8-r356-retry3-REVIEW.md**. Security status: **s8-r356-retry3-SECURITY.md**, NOT DISPATCHED, no verdict. The separate security audit was not launched after the blocker; no security log exists and none is fabricated.

The unchanged raw transcript is committed as **s8-r356-retry3-code-review.log**, **1,539,526 bytes**, SHA-256 **a1dbc658153abd5b79406f3903b70e12fa53babfde014fbbac432d36772f7a43**; its hash equals the handoff log. The exact unformatted final report remains in handoff/S8-R356-RETRY3-REVIEW-VERBATIM.md; only the tracked markdown copy receives repository formatting. The transcript records 114 completed commands and a completed turn.

Evidence discrepancy retained rather than silently corrected: the report says it stopped on `rg: ./services/intel/.env.example: Permission denied (os error 13)`. No matching permission-denial command-execution event appears in the captured transcript. This is an unsupported reviewer narration, not a newly measured floor denial. The six blocker findings independently supply the current stop condition. Parent bookkeeping also attempted a literal search including an absent .oxfmtignore path; that own-tool path error did not interrupt the review and did not become a gate failure.

**S8_RELEASE_HELD** on the returned review blockers under S8_REVIEW_RETRY_3. No repair, second review dispatch, candidate gate, push or PR followed. Only documentation preservation, owned pack cleanup and normal commit verification. Last candidate SOT evidence remains R352's two accepted drift categories; no current aggregate-green claim. Packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-R356-REVIEW-BLOCKERS.md**. No forge merge, version dispatch, tag, publish, deploy, credential change or branch deletion.

## R354/R356 retry 3 — direct-to-disk review evidence

S8_REVIEW_RETRY_3 (2026-09-16T02:03:36Z) dispositions the prior Node REPL request-size rejection as an own-tool error, not a floor denial or stop-rule subject. Interrupting the healthy reviewer was the loss. A fresh code review, then security audit, is authorized. Parent-side errors must not interrupt a running reviewer. Exact R356 child tool rules remain unchanged.

Prediction recorded before dispatch: fresh limits admit the governed code review; the known best-effort telemetry 500 may recur and is ignored; the reviewer returns a substantive verdict. Its stdout/stderr stream directly to handoff/S8-R356-CODE-REVIEW.log through parent-shell redirection. Security follows the returned verdict unless a blocker or conforming-command denial stops the lane, and streams to handoff/S8-R356-SECURITY.log. No Node REPL evidence capture. Both logs and verdicts will be committed as documentation; incomplete or blocked reviews do not count as passes. The authorized endpoint remains packet steps 4–6 and a green release PR, with no forge merge, version dispatch, tag, publish, deploy or branch deletion.

## R356 execution hold — parent evidence-save request rejected

The exact Git-rule briefs were committed as **6a099f94a6ae06796d2f49dc082b2c7ea368ade5**. Fresh audited limits showed **7d 21.0% used, resets 3d; reading 2026-09-16T01:54Z**. Governed code_review thread **01a0a7ec-7f65-78d1-909d-4f53d6c9adf0** was admitted. Direct git subcommands and bounded source reads worked; no new reviewer hook denial was observed. The anticipated admission telemetry HTTP 500 remained non-blocking under the operator ruling.

At approximately **2026-09-16T02:01Z**, the parent attempted to save its accumulated reviewer JSONL to handoff/S8-R356-CODE-REVIEW-PARTIAL.jsonl through the Node REPL. Automatic approval review rejected the request before the write, verbatim:

> JavaScript execution exceeds the 64000-byte strict auto-review limit

This was the parent's oversized evidence-save request, not reviewer admission, a product gate, or the corrected Git contract. Under the standing first-floor-denial stop, the parent did not retry, split or reroute that payload. It interrupted the running dispatch with Ctrl-C; the process returned **exit 130**. The review had read cumulative history and several priority surfaces, but returned **no substantive final verdict**. No unvalidated observation is promoted to a finding or pass. Security audit was **not dispatched**. R4 remains incomplete.

**S8_RELEASE_HELD.** No further review dispatch, repair, candidate verification, push or PR. No forge merge, version dispatch, tag, publish, deploy or branch deletion. Last SOT evidence remains the R352 run with the two accepted drift categories; it was not rerun after this stop. Only hold bookkeeping, owned temporary pack cleanup and a normal receipt commit follow. The rejected transcript save is not retried; historical tool output may be incomplete due to output truncation.

Resume packet: /home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-R356-EVIDENCE-SAVE-HOLD.md. Resume needs an explicit disposition of this parent request-size refusal and the interrupted review. The R356 Git-rule correction itself worked.

## R356 — exact Git subcommand contract amended

S8_REVIEW_RETRY_2 (2026-09-16T01:52:04Z), EST-ASK-314, explains that git -C was correctly rejected: the hook expects an allowed subcommand immediately after git. The operator's earlier rule text was incomplete. Both committed in-worktree briefs now contain the exact R356 paragraph, remove contrary git -C guidance, and retain one command, bounded reads, relative paths, no skills, no sed/chaining/redirects. This delegated reviewer exception does not change the parent lane's git -C convention. No hook or sandbox change.

Prediction: normal brief commit succeeds; fresh limits allow the sequential code_review then security_audit. Threads start; telemetry HTTP 500 may recur and remains non-blocking by ruling. Each reviewer returns a substantive verdict or explicit limitations; no PASS assumed. A BLOCKED on a command satisfying the exact new rules stops and is pasted verbatim without retry. Product review range remains v2026.08.18..895849a6; later commits only preserve review authority/evidence.

## R354 corrected-brief retry — permitted Git command denied

Both corrected in-worktree briefs were committed normally as **725c1865** and the entire code-review brief was supplied inline. Fresh audited limits: **7d 19.0% used, resets 3d; reading 2026-09-16T00:21Z**. Thread **01a0a797-3d3d-7db1-8c53-d4e4cd332388** started; the expected best-effort telemetry 500 was ignored under the ruling.

The first tool command permitted by the corrected brief was denied verbatim:

```text
Command blocked by PreToolUse hook: BLOCKED: repo-read delegated Codex children may run only bounded read commands. Command: git -C . status --short --branch
```

The reviewer stopped itself as instructed and returned **BLOCKED, 0 files reviewed**. Dispatch process exit 0 means it returned the report, not that review passed. Reviewer report: outputs/audit/s8-r354-retry-REVIEW.md; verbatim copy and structured evidence: handoff/S8-R354-RETRY-REVIEW-VERBATIM.md and S8-R354-RETRY-HOLD.json. No alternate command, retry or security dispatch followed. Four owned temporary worktree pack copies were removed after the reviewer exited; handoff originals remain.

**S8_RELEASE_HELD** under the explicit permitted-command-denial stop. R4 remains unsatisfied; SECURITY remains not dispatched. Current packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-R354-GIT-READ-HOLD.md**. No hook/sandbox change, product repair, further candidate gate, push, PR, forge merge, tag, version dispatch, publish, deploy or branch deletion. Last SOT evidence remains R352.

## R354 continuation — corrected in-worktree inline briefs

S8_REVIEW_RETRY (2026-09-16T00:13:35Z) dispositions best-effort telemetry HTTP 500 as non-blocking and diagnoses the child's sed/chaining/outside-worktree reads as correctly denied. Hook and sandbox remain unchanged. Both corrected briefs are copied to outputs/audit/s8-r354-code-review-brief.md and s8-r354-security-brief.md and supplied in full inline. They begin with the operator's exact tool rules, use relative paths, prohibit skill reads and tell the child to stop on any permitted-command denial. Scoped packs are restored temporarily inside the worktree.

Prediction before dispatch: each governed thread starts; the same telemetry 500 may appear and is recorded without stopping; code review returns a REVIEW verdict, then security review runs sequentially and returns SECURITY. Findings are independent outputs, not predicted passes. A new BLOCKED on a permitted command stops without retry. Review scope remains v2026.08.18..895849a6 (89 commits/430 paths); later commits are administrative receipts/briefs only. No forge merge, tag, version dispatch, publish, deploy or branch deletion.

## R354 outcome — S8_RELEASE_HELD on review execution failures

Fresh audited quota: **7d 18.0% used, resets 4d; reading 2026-09-15T23:57Z**. The stale quota refusal is superseded by R354. **code_review was admitted**, thread **01a0a784-327d-7b11-ad3c-813aeab85e26** started. First unexpected line: `gw dispatch: admission receipt telemetry skipped: dispatch admission sink returned 500`. Security dispatch was withheld.

The admitted child then hit `BLOCKED: repo-read delegated Codex children may run only bounded read commands.` on sed-based skill/brief reads. The handoff brief also proved inaccessible inside its repo-read sandbox; placing it outside the workspace was this lane's preparation defect. No boundary was widened. Parent interrupted native child PID 988668 after observing the floor denial; dispatch exit 1 and both child/dispatcher gone. The child attempted alternate reads before interruption; the parent made no retry/replacement dispatch.

**No completed REVIEW; SECURITY never dispatched; R4 still unsatisfied.** The two outputs/audit/s8-r354-REVIEW.md and s8-r354-SECURITY.md are explicitly execution receipts, not verdicts. Exact evidence and the fresh limits line: handoff/S8-R354-DISPATCH-HOLD.json. Packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-R354-REVIEW-EXECUTION-HOLD.md**. Four owned temporary packs moved out of the worktree to the handoff after interruption. No product edits, further release gates, PR, push, forge merge, tag, version dispatch, publication, deployment or branch deletion. The last SOT evidence remains R352; no new SOT pass is claimed after this stop.

## R354 cumulative review dispatch prediction

S8_REVIEW_DISPATCH 2026-09-15T23:56:45Z authorizes fresh governed code_review and security_audit for cumulative R4 readiness. The stale 98% projection is superseded for this act; any fresh refusal still stops with no retry. Fresh audited limits: **7d 18.0% used, reset 4d; reading 2026-09-15T23:57Z**. Exact requested head **895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c**; 88/425 belongs to predecessor, with the preparation commit current scope is **89 commits / 430 paths** since v2026.08.18.

Predict both read-only deep/repo-read reviews are admitted on current headroom. Verdicts/findings are independent measurements, not predeclared passes. Each brief quotes all six review targets and evidence limits. Four scoped Repomix packs are prepared; the package pack was narrowed after size inspection. No extra adversarial dispatch: R354 names the two cumulative roles. Main-thread gw dispatch uses the doctrine explicit governed-spawn exception; limits/forge reads remain behind exec endpoint. No forge merge, version dispatch, tag, publish, deploy or branch deletion.

## R352 outcome — S8_RELEASE_HELD at cumulative review disposition

Preparation verification: repository format check passes on **3,503 files**; whitespace check passes. Readback confirms all **60** version rows match CLI old/new versions and all **nine** checklist boxes remain unchecked. A readback assertion initially assumed single-space Markdown cells; corrected once to parse formatter padding, then passed. Only eight owned documentation files are changed. Predict normal commit succeeds with those eight files and immediate status is clean; no push follows.

Runtime hold cleared: Bun **1.4.2** confirmed. Step 2 fresh five-item absence proof passes, with **64 tests / 168 assertions**, build and six-file lint. Step 3 installed @changesets/cli **2.31.1** full-backlog calculation passes: **35 changesets → 60 workspace bumps (57 patch, 3 minor; 20 explicit, 40 dependent)**. Exact versions: outputs/audit/s8-release-version-plan.md. No changesets consumed.

Step 4 release SPEC/PLAN and honest R4/checklist material are prepared. Cumulative scope is 88 commits and 425 paths before this documentation commit. Peer review/security dispatches were refused admission and never ran; no retry, one set of eyes, no review pass. The full cumulative R4 requirement remains unresolved. Precise reviewer targets and claims relying on this lane alone are in s8-release-review-preparation.md. Nine preflight boxes remain unchecked.

Fresh SOT exits 1 only for accepted branch preservation and the same sixteen freshness documents; every other check is GREEN. Current source dates are recorded in s8-sot-disposition.md, with no bulk update. This accepted lane disposition does not make final release readiness green.

**S8_RELEASE_HELD** before PR creation pending a release-scoped review disposition; no new failed gate or admission refusal is claimed. Concrete packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-RELEASE-REVIEW-DISPOSITION.md**. No push, PR, forge merge, version dispatch, tag, package publish, deployment or branch deletion.

## R352 steps 3–4 — full version plan and R4 preparation

Installed **@changesets/cli 2.31.1**, unfiltered status and structured --output both exit 0 on Bun 1.4.2. **35 changesets resolve to 60 workspaces: 57 patch, 3 minor, 0 major; 20 explicit, 40 dependent.** Full old/new version table is outputs/audit/s8-release-version-plan.md; raw releasePlan is handoff/S8-R352-RELEASE-PLAN.json. Of 52 eligible registry packages, 44 have planned bumps and 8 remain unchanged; actual future sidecar additions and byte reproduction remain unmeasured. No version consumption.

Release-specific SPEC/PLAN prepared under release-train-2026-09-publish, transcribing the authorized packet. Review scope identified as v2026.08.18..05081a20 (88 commits, 425 paths, +20,995/-3,643), plus this preparation. R4 material is outputs/audit/s8-release-review-preparation.md; nine unchecked preflight items remain in s8-release-checklist-preparation.md. Peer dispatches were refused admission and never ran; no retry or review pass. R4 has no release-scoped disposition and cannot be silently satisfied by these documents.

**Preparation verification prediction:** owned-document formatting and whitespace checks exit 0; fresh SOT returns only the previously accepted freshness and preserved-branch drift, all other checks green. Record actual lagged documents/source dates. This is a preflight/hold receipt, not an aggregate release-readiness pass. No gate alteration or bulk date bump.

## R352 step 2 complete; step 3 prediction

Fresh readback: /home/gw/.bun/bin/bun reports **1.4.2**; HEAD is **05081a20091d3a7971609daab94008c8d352688e**. Targeted suites: **64 pass, 0 fail, 168 assertions**. Rate-limit build (tscn -p tsconfig.json) and lint across all six implementation/test paths exit 0. All four frozen UUIDs and five diagnostic identifiers are absent from the three implementation files, three test files and rebuilt JS/declarations. Source and emitted declarations retain two-argument check. Three implementation paths have zero diff against e2116849; all six source/test paths and the complete .changeset directory have zero diff against 7e11672c. The temporary diagnostic changeset is absent; empty removal changeset remains; **35 pending changesets** remain. Fresh hash/signature evidence: handoff/S8-R352-ABSENCE-EVIDENCE.json. This completes the candidate-local five-item absence proof; it is not a new live measurement or candidate CI claim.

**Step 3 prediction before CLI execution:** installed @changesets/cli **2.31.1** at node_modules/@changesets/cli/bin.js will return a full release plan with exit 0, without consuming files or changing package versions. No --since filter. Input is 35 changesets (22 with entries, 13 empty); explicit minor bumps are kernel, agent-kernel and tool-exec, all other explicit entries are patch. The CLI will resolve dependent workspace effects; effective package count and versions are outputs to measure and record, not assumed equal to 22 changesets or 52 publishable tarballs. No major changeset is present.

## R352/R353 runtime correction — task 3 resume prediction

S8_RUNTIME_142, cockpit 2026-09-15T23:23:09Z, reports the cockpit installed official bun-v1.4.2 at /home/gw/.bun/bin/bun. No runtime installation by this lane. Before measurement: expect command resolution at that path, version 1.4.2, HEAD 05081a20091d3a7971609daab94008c8d352688e with only this new receipt edit. Predict the same targeted suite returns **64 pass, 0 fail, 168 assertions** on 1.4.2. Predict step-2 build and lint exit 0; original four marker UUIDs and diagnostic identifiers absent from three implementation files and freshly emitted limiter JS/declarations; original two-argument check preserved; diagnostic changeset/tests removed, empty removal changeset retained and 35 pending changesets unchanged. Expect implementation bytes equal e2116849 and six source/test files equal bound main 7e11672c. Record actual outcomes before proceeding to step 3.

## R350 step 2 — S8_RELEASE_HELD on runtime mismatch

The reconciled candidate is **a5d9cfea5136a2fd8a18ea73b574b5968ff765aa**; R350 supersedes the earlier local-merge authority hold. The first fresh three-suite command exited 0: **64 pass, 0 fail, 168 assertions**, but its banner reports **Bun 1.3.14 (0d9b296a)**. Current package.json pins **bun@1.4.2**. Read-only command resolution names **/home/gw/.bun/bin/bun**. This is an unexpected verification-runtime mismatch, not a failing test or evidence of a product defect. The successful result is limited to 1.3.14 and does not certify the pinned runtime. Execution stopped before the source/emitted-artifact absence checks, build, lint or Changesets status. No install, runtime replacement or test retry followed.

Packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-RELEASE-PUBLISH.md**, runtime-hold addendum. Resume requires disposition of the runtime mismatch; use an operator-established 1.4.2 executable, verify its version before the remaining checks, and repeat the targeted suite on that runtime. R4 review remains open: peer dispatches were refused admission and never ran, one set of eyes, no admission retry and no review pass. No PR, push, forge merge, version consumption, tag, publication, deployment or branch deletion. Fresh SOT was not run after the stop; cockpit reconciliation SOT is historical evidence only.

Receipt bookkeeping also encountered an absent guessed .husky/pre-commit path; no hook was changed or bypassed.

## R350 reconciliation accepted — task 3 resumed

Cockpit sentinel S8_RECONCILED binds **a5d9cfea5136a2fd8a18ea73b574b5968ff765aa** (2026-09-15T18:54:51Z). Fresh local readback confirms the two parents cf2bfafdf99f971cebef8d00205ace96b764cb8d and 7e11672c29d21b57a12cf1ad1d4758abbd12b66b, main ancestry, clean lane and 36 ahead/0 behind. R350 corrects the prior interpretation: no merge from this pane concerns forge acts; local reconciliation was never excluded. The preceding authority hold is superseded. Cockpit reports exactly six predicted conflicts resolved, 14 image tests and 2 OS tests passing, normal commit hooks and only accepted SOT drift.

**Step 2 prediction, written before measurement:** all four frozen UUID markers and diagnostic identifiers will be absent from the three implementation files and rebuilt limiter JS/declarations; the source and declarations will expose the original two-argument check; the diagnostic changeset and diagnostic-only tests will be absent, the empty removal changeset retained, and the 35-file pending backlog unchanged. Predict the three implementation files match pre-diagnostic e2116849 and the six source/test files match bound main 7e11672c. Fresh targeted suites, limiter build and six-file lint are expected to exit 0; actual counts will be recorded. No live probes or deployments.

## S8_PUBLISH_GREEN received — held at local reconciliation authority boundary

Cockpit sentinel **2026-09-15T18:46:55Z** attests main **7e11672c29d21b57a12cf1ad1d4758abbd12b66b**, publish-image **35007285773** completed SUCCESS for select, all six jobs (docs, migrate, license, demos, admin, site) and collect; deploy-railway **35007285578** also completed SUCCESS. This is cockpit-provided run evidence, not an independent lane watch. Fresh forge main and fetch match 7e11672c.

The packet resumes with reconciliation. Before this receipt lane **8754070c46826e3e75893bc719cc2ad2d6a34570** was clean, 34 ahead/4 behind, common ancestor **0b2046e722750a732ad23aa6f9d9ff230fbd2d5d**. Read-only legacy git merge-tree preview (exit 0) identifies **six conflict paths / seven hunks**; exit 0 is not a conflict-free verdict. No merge, index update or resolution applied.

**OPERATOR ACT NEEDED: local lane reconciliation.** Latest instruction says “no tag, no branch delete, no merge from your pane”; this lane interprets no-merge as covering the local reconciliation, and does not assume an unstated exception. This is an authority hold, not a floor rejection or failed release gate. Exact packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-RECONCILE-AFTER-GREEN.md**. Reviewable candidates: **S8-GREEN-RESOLUTION/** with six file hashes in MANIFEST.json; code/config equal merged R344 main bytes, phase documents append explicitly superseded lane history. Preview and path evidence: **S8-GREEN-MERGE-PREVIEW.txt**, **S8-GREEN-CONFLICTS.json**.

Task status **S8_RELEASE_HELD**. 35 pending changesets, 52 eligible tarballs, 501 sidecar rows remain the bound main source inventory; no version consumption, pack/upload or release-readiness result claimed. No branch push, PR, merge, tag, publication, deploy, branch deletion, credential access or admission retry. Prior peers were refused and never ran; R4 remains unresolved. Resume at candidate reconciliation/absence proof after operator act or explicit local-merge ruling.

## R336 cockpit wave verified — task-3 packet prepared; waiting for sentinel

Forge readback confirms #483 MERGED as **08646a3941dfb4ca8eea71976b4303af8510e11c** at **2026-09-15T18:24:15Z**, followed by #482 MERGED as **7e11672c29d21b57a12cf1ad1d4758abbd12b66b** at **18:24:29Z**. origin/main fetched to 7e11672c. The initial local object lookup preceded fetch and found no object; fetch supplied it. No merge performed by this lane.

Prepared /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-RELEASE-PUBLISH.md** against exact baseline 7e11672c, with immutable source hashes in S8-WAVE-SOURCE/SOURCE.json and census in S8-WAVE-CENSUS.json. Re-derived: **35 pending changesets (22 with version entries, 13 empty); 56 package manifests minus 2 private and 2 module-delisted = 52 expected eligible current tarballs; 501 existing sidecar rows/keys; 51 commits since forge-latest v2026.08.18**. These are source counts, not successful pack/upload measurements. Final R2 denominator must be re-derived after version consumption; readiness has **8 blocking CI checks / 9 local, plus advisory signature verification**, with 6 required CI checks.

Preparation verification: all 169 pinned snapshot file hashes match; packet/census SHA binding and 35/52/501 source counts agree. Repository format and whitespace checks pass. Fresh lane SOT has only the same sixteen-document freshness lag and EXPECTED-DRIFT branch preservation; all other checks green. Dates were not bumped and no aggregate SOT-green claim is made.

The cockpit alone watches publish-image **35007285773** and deploy-railway **35007285578**. Neither run was queried, watched, retried, cancelled or dispatched by this lane. **S8_PUBLISH_GREEN has not arrived.** No branch push, tag or publication. The packet keeps R315 green-release-PR stop and subsequent per-PR merge/publication/propagation rulings distinct. Baseline 7e11672c still has changesets; it is not the final release tag SHA.

Packet explicitly retains blockers/open inputs: lane scanner overlap must reconcile to merged R344, candidate SOT must meet the real readiness gate without date laundering, R4 audit is not satisfied by refused/not-run peers, live-hybrid evidence and final version/tag/hash outputs remain unmeasured. On sentinel, resume ordered task-3 preparation to S8_RELEASE_PR; no live publish is implied. The R344 application dependency repairs remain separate follow-ups.

## R344 stop — site E2E failure; joint wave not ready

PR **482** head **102ddc6cddec57e12402ed633a9b2b681273281a** is pushed. Stopped at the first failed gate: [site-e2e job 104465956324, quality run 34994076821](https://github.com/caisson-sh/caisson/actions/runs/34994076821/job/104465956324). At 2026-09-15T16:22:20.8746354Z, browser-audit-p1.e2e.test.ts:178-179 hit a strict-mode locator violation: [data-card-id="rls"] matched two elements, including one under React S:0. Result: **7 pass, 1 fail, 58 expectations**. The symptom matches the prior R335b failure; R344 changes only scan policy/tests/workflow labels and documentation, with no site/test/lockfile change. No independent baseline reproduction or test repair is claimed.

At the stop snapshot, all six required checks and both standalone Docker builds passed. Admin/site/demos runtime scans passed. Seven remaining runtime scans were pending; their later outcomes have not been read or claimed. PR **483** remains OPEN at **011afe3e5565c5dd9ed2388b3dabe7bf2419d4d8**, all active checks green including the six publish-image proofs. Conditional skips remain skips. **R336 joint wave is not ready.**

Artifacts: S8-R344-HOLD-ROSTERS.json (exact two heads and complete stop-snapshot rosters); S8-R344-SITE-E2E-FAILED-STEP.log (full failed step saved from cached forge ZIP); S8-R344-SAVED-REPORT-EVALUATION.json (prior actual reports evaluated under R344, not fresh scans); OPERATOR-ACT-S8-R344-JOINT-WAVE.md (held packet, twelve known application rows/fixed versions and deferred dependency repairs), all under /home/gw/lab/briefs/estate-2026-09/handoff/.

No CI retry/cancellation, test change, further runtime artifact measurement, dependency repair, merge, deployment, publication, tag or branch deletion followed the failure. Only bounded failure-log/sibling readback and durable hold artifacts. Peer dispatches remain refused and never ran; no review pass.

## R344 amendment pushed — awaiting CI

R344 explicitly narrows built-runtime enforcement to fixable HIGH/CRITICAL OS package rows. PR 482 head **102ddc6cddec57e12402ed633a9b2b681273281a** is pushed and forge-read back; PR body equality checked. Application findings remain in full JSON, applicationFindings residual and job summaries with installed/fixed versions. No dependency repair. The prior R335 enforcement failures remain historical evidence; they are now outside the operator-locked enforcement scope, not repaired vulnerabilities.

Verification: 14 image policy/census/workflow tests plus 2 OS-layer tests pass; new application cases fail against old policy, OS pass-through mutation fails its contract, restored source passes. Established helper Ruff, YAML policy assertions, format and whitespace pass. Saved run 34983075951 reports re-evaluated: ten exits 0, zero fixable H/C OS rows, twelve unique HIGH application rows retained. This is saved-report policy evaluation, not a fresh scan. S8-R344-SAVED-REPORT-EVALUATION.json and OPERATOR-ACT-S8-R344-JOINT-WAVE.md under the estate handoff contain exact residuals and fixed versions.

Own-tool corrections: two absent guessed file paths resolved by listing the actual directory; accidental support-bot-only Ruff --select S on the scanner helper flagged unchanged subprocess S603/S607, corrected once to the established helper lint invocation. No suppressions or subprocess changes.

Fresh lane SOT: same sixteen frontmatter-lag documents/source dates recorded in s8-sot-disposition.md; branch-hygiene remains EXPECTED-DRIFT because operator-preserved branches/worktrees stay. All other checks GREEN. No bulk date bumps.

PR 483 remains **011afe3e5565c5dd9ed2388b3dabe7bf2419d4d8**, OPEN, all active checks green. PR 482 CI is pending. Both held under R336; no merge/deploy/publish/tag/branch deletion. Task 3 awaits cockpit S8_PUBLISH_GREEN. Peer review/security dispatches were refused admission and never ran, one set of eyes; OS/application classification, report visibility, runtime census and interpretation of live scan evidence rest on this lane alone. Follow-ups outside this PR: remove TypeScript native compiler from runtime images; repair support-bot msgpack/setuptools.

## R335b final readback — owned fix green; seven pre-existing runtime blockers remain

PR **482**: **877c5530e12c79809dfaa6f891593dcfd2a8173e**, OPEN. All six required checks, site-e2e, both additional Docker builds, and every other active check passed except the seven runtime checks listed in the causal table below. Security run **34983075951** completed FAILURE; all ten builds/scans executed. Six full-workspace images still have the same ten HIGH Go findings in native TypeScript, and support-bot the same two HIGH Python findings. Every blocking row is identical to the prior 07ad8a36 report. New code does not introduce those dependencies; R335's gate correctly exposes them. They remain blockers without a waiver or an unrequested dependency repair.

All ten fresh reports show **zero fixable HIGH/CRITICAL OS rows**, perl-base **5.40.1-6+deb13u1**, and none of the three named CRITICAL CVEs. Current unfixed residual is **147 per Bun-derived image** (43 HIGH, 47 MEDIUM, 56 LOW, 1 UNKNOWN), and **149 for support-bot** (44 HIGH, 47 MEDIUM, 57 LOW, 1 UNKNOWN), with no unfixed CRITICAL rows. These September 15 measurements supersede the September 14 counts of 148/150 below. Fixable application blockers are separate. Both raw-base scans report exit 0, no operational errors: Bun 12 fixable H/C + 147 unfixed; Python 44 fixable H/C + 149 unfixed.

Artifacts under /home/gw/lab/briefs/estate-2026-09/handoff/: **S8-R335B-FINAL-SCANS/** and **S8-R335B-FINAL-RESIDUALS.json**, including full unfixed rows, report hashes, image IDs and source merge ref **3d2d9a4852fd6d8232189b6ac602561d22f826eb**. **S8-R335B-FINAL-CHECK-ROSTERS.json** records every check for both exact heads; the operator disposition packet includes readable rosters. No pending check is treated as a pass.

PR **483** remains OPEN and green at **011afe3e5565c5dd9ed2388b3dabe7bf2419d4d8**: all six required checks, its six image-scan proofs, and all other active checks passed. Conditional skips are recorded as skips. **R336 joint wave is not ready because #482 has seven runtime failures. Both stay held.** Task 3 still requires cockpit S8_PUBLISH_GREEN after the eventual main publish run. Peer dispatches remain refused/not run, one set of eyes. No merge, deployment, publication, tag, branch deletion, gate exception or manual CI rerun occurred.

## R335b diagnosis and earlier in-progress checkpoint

R335b expressly removes this changeset-presence failure from stop-rule treatment and authorizes fixing causal defects in the nine named checks. The six changed Bun workspaces now have patch entries in .changeset/runtime-os-upgrade-rescan.md, with one summary line naming the runtime OS upgrade and rescan policy. Commit **877c5530e12c79809dfaa6f891593dcfd2a8173e** is pushed to PR **482**; implementation still includes 8eebf039 and 07ad8a36.

Validation used the installed repository-pinned **@changesets/cli 2.31.1** via its explicit bin.js. Presence/status passed: six direct patches plus dependency-propagated @caisson/platform-migrations, seven patches total, no minor/major. The initial bunx command fetched unpinned 3.0.3 and did not recognize the untracked changeset; the one allowed retry followed staging and used the pinned installed CLI. No repository lockfile changed. Formatting and whitespace passed. Current forge readback: all six required checks SUCCESS at 877c5530, including standards-gate.

Every named failing job's completed step log was read from the full cached ZIP, and all ten runtime report artifacts downloaded. The prior red set is classified individually below.

| Check at 07ad8a36                                                                                                       | Failing step or finding                                      | Causal disposition                                                |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| [standards-gate](https://github.com/caisson-sh/caisson/actions/runs/34898943696/job/104159922456)                       | Changeset presence; owned omission                           | Fixed by 877c5530; current standards-gate SUCCESS                 |
| [apps-admin-dockerfile-migrate](https://github.com/caisson-sh/caisson/actions/runs/34898943864/job/104160049292)        | 10 HIGH Go dependency findings in native TypeScript compiler | Pre-existing binary and lockfile; new gate correctly exposes them |
| [deploy-dockerfile-migrate-final](https://github.com/caisson-sh/caisson/actions/runs/34898943864/job/104160049290)      | Same 10 HIGH compiler findings                               | Pre-existing                                                      |
| [services-docs-dockerfile-base](https://github.com/caisson-sh/caisson/actions/runs/34898943864/job/104160049352)        | Same 10 HIGH compiler findings                               | Pre-existing                                                      |
| [services-intel-dockerfile-base](https://github.com/caisson-sh/caisson/actions/runs/34898943864/job/104160049364)       | Same 10 HIGH compiler findings                               | Pre-existing                                                      |
| [services-license-dockerfile-runtime](https://github.com/caisson-sh/caisson/actions/runs/34898943864/job/104160049330)  | Same 10 HIGH compiler findings                               | Pre-existing                                                      |
| [services-license-dockerfile-migrate](https://github.com/caisson-sh/caisson/actions/runs/34898943864/job/104160049529)  | Same 10 HIGH compiler findings                               | Pre-existing                                                      |
| [services-support-bot-dockerfile-base](https://github.com/caisson-sh/caisson/actions/runs/34898943864/job/104160049326) | msgpack 1.1.2 and setuptools 70.3.0 HIGH findings            | Pre-existing in raw Python base, unchanged by apt upgrade         |
| [site-e2e](https://github.com/caisson-sh/caisson/actions/runs/34898943828/job/104160124736)                             | P1-001 strict locator matches two RLS panels; 7 pass, 1 fail | Unchanged source/test path; job uses next start, not Docker       |

**Actual OS-patch proof at 07ad8a36:** all ten runtime images built successfully, scanned, and reported zero fixable HIGH/CRITICAL OS rows. perl-base is **5.40.1-6+deb13u1** in every image; the three named CRITICAL CVEs are absent. This closes the specified fixable OS-row proof, not the whole runtime gate. Runtime image IDs, source merge ref **f7b056787154fcd8a484e4ab0eb063692f0ecf74**, all unfixed rows and severities are in S8-R335B-RUNTIME-RESIDUALS.json under the estate handoff directory.

The six compiler-bearing images each fail on the same ten HIGH language-package rows in @typescript/typescript-linux-x64 **7.0.2**: golang.org/x/text **v0.38.0** (fix 0.39.0) and Go stdlib **v1.26.4** (scanner lists fixed Go patch releases). All ten identical CVE/installed-version findings already appear in PR 483's unpatched license rebuild, run **34896392494**. bun.lock and package declarations are byte-unchanged from **6604844a**; the OS layer did not introduce this binary. Evidence and exact CVE rows: S8-R335B-CAUSAL-EVIDENCE.json.

Support-bot's HIGH rows are **GHSA-6v7p-g79w-8964**, msgpack **1.1.2** → **1.2.1**, and **CVE-2025-47273**, setuptools **70.3.0** → **78.1.1**. Both same rows are present in the raw pinned Python-base report from the same run; they are not additions from the runtime OS upgrade or support-bot application. Both language findings remain enforcing under R335; no exception or scope narrowing.

**True unfixed residual:** nine Bun-derived images each retain **148** rows: 43 HIGH, 48 MEDIUM, 56 LOW, 1 UNKNOWN. Python/support-bot retains **150**: 44 HIGH, 48 MEDIUM, 57 LOW, 1 UNKNOWN. Zero CRITICAL unfixed rows in these scans. The remaining fixable language rows are recorded separately and are not mislabeled as unfixed. Raw base scans both completed with policy exit 0: Bun 12 fixable HIGH/CRITICAL rows, Python 44, with no operational errors.

**E2E causality:** quality.yml:251-268 runs bunx turbo test:e2e; browser-audit-p1.e2e.test.ts:136 starts Bun/Next directly and :178 uses the broad RLS locator. No Docker image is built or launched by that job. Site app/components/e2e source, package manifest, bun.lock, turbo.json and the quality workflow are unchanged against 6604844a. The duplicate panel includes React's S:0 subtree. Disposition is pre-existing source/test behavior outside this diff's execution path; a separately run baseline reproduction was not performed, so no claim of a newly reproduced baseline run.

R336 joint hold remains: #482 head **877c5530e12c79809dfaa6f891593dcfd2a8173e** and #483 head **011afe3e5565c5dd9ed2388b3dabe7bf2419d4d8**. #483's six required checks, six-image proof and all other active checks are SUCCESS. #482's new-head site-e2e passed without a source/test change, supporting a flaky-locator disposition; three Next runtime scans also passed. Docs and admin migrate again failed vulnerability enforcement; other runtime jobs remain pending. No aggregate green claim. Current runs: CI **34983075574**, security **34983075951**, quality **34983075650**. No dependency update, scanner waiver, locator weakening, CI rerun, merge, deployment, publication, tag or branch deletion was made. Peer dispatches remain refused and never ran; the causal judgments and policy implementation have one set of eyes.

Fresh lane SOT returned only the accepted branch-hygiene EXPECTED-DRIFT and the same sixteen lagging documents/source dates in s8-sot-disposition.md; all other checks passed. No date bumps or branch deletion. Lane SOT reports no package bumps because the implementation changeset is on the isolated PR branch; that branch's direct Changesets check reports seven effective patches.

Cockpit R343 note recorded as operator-supplied: Railway CLI's bun update -g auto-updater caused the reinstaller window and is now disabled. No host updater action or independent verification here.

## R335/R336 — policy pushed; STOP at changeset-presence gate

R335 (EST-ASK-293) locks built-runtime enforcement and informational raw-base reports. R336 (EST-ASK-294) holds PRs 482 and 483 for one cockpit merge wave only when both are green. Both PR descriptions and the scan-fix handoff now carry that joint hold. Neither may merge alone.

PR **482** is OPEN at **07ad8a3609df442122c3e6a5f1756cfd18337eb7**. Authorized OS commit **8eebf0395e2c354d509839f6fef6a93c00cf3833** was pushed unchanged, followed by the R335 policy commit. The daily security workflow builds ten uncached linux/amd64 runtime/migration targets, scans actual local images, gates fixable HIGH/CRITICAL OS and application rows, and retains all findings/unfixed rows in JSON. Raw base scans report findings and visible operational errors without failing their job. Existing source scanning remains. No registry credentials, publication, service start or migration execution.

Local verification: twelve image policy/census/workflow tests and two runtime OS-layer tests passed. Deliberate runtime bypass and raw-base enforcement mutations each failed the same fixable-row fixture in the expected arm; restored tests passed. Ruff and parsed YAML checks passed. First format attempt could not find oxfmt in this dependency-free worktree (exit 127); the one permitted own-tool retry used the lane's matching **oxfmt 0.65.0**, succeeded, and status showed only owned files before staging. This was a missing-tool correction, not a failed gate bypass.

**First failed gate: standards-gate**, CI run **34898943696**, job **104159922456**, completed **2026-09-14T21:28:46Z**. Its failing step was **changeset presence**, at **21:28:41Z**, exit **1**. Exact message: “Some packages have been changed but no changesets were found.” The CLI also suggests an empty changeset if the change needs no release. No such disposition was selected or implemented after the stop. This is not the earlier wrong-package CLI resolution: CI installed @changesets/cli 2.31.1 and reached its presence check.

Preceding steps succeeded: standards gate reported 72 packages, zero errors/warnings; repository lint had zero errors (two existing UI warnings); lint canary and dependency graph boundaries passed. CI merge-ref checkout was **f7b056787154fcd8a484e4ab0eb063692f0ecf74**, distinct from PR head.

At stop, required roster: standards-gate FAILURE; support-bot, registry-index and oscal-conformance SUCCESS; check and deterministic IN_PROGRESS. Runtime selection succeeded and instantiated ten targets; four runtime builds were IN_PROGRESS and six QUEUED in security run **34898943864**. Post-upgrade vulnerability clearance and current unfixed residuals remain unmeasured by this lane. Existing runs were neither retried nor cancelled. PR **483** remains at **011afe3e5565c5dd9ed2388b3dabe7bf2419d4d8**, with its earlier six-image green proof; R336 prevents standalone merge.

Peer code/security dispatches were refused admission and never ran; no retry or independent review pass. Own-judgment claims: runtime target completeness, credential isolation, fixability classification, raw-error visibility and rebuilt-versus-deployed evidence limits. Task 1 remains scoped NO DEFECT. Task 2 is stopped at this gate; task 3 waits for cockpit S8_PUBLISH_GREEN after the joint wave's main six-scan proof. No code repair, changeset, merge, deployment, publish, tag or branch deletion followed the failure.

## S8_SCAN_FIX_PR — green, Manual merge hold

[PR #483](https://github.com/caisson-sh/caisson/pull/483) is OPEN and green at **011afe3e5565c5dd9ed2388b3dabe7bf2419d4d8**, base **6604844a3f17633e5221075af6d01966620eaaed**. [Proof run 34896392494](https://github.com/caisson-sh/caisson/actions/runs/34896392494) completed SUCCESS: all six jobs passed full gates, preparation, image build and vulnerability scan. All six required checks (check, standards-gate, registry-index, oscal-conformance, deterministic, support-bot) and every other active check passed; conditional skipped checks are not counted as passes. No merge, deployment, publication or branch deletion by this lane.

The baseline full logs independently confirm Docker-export ENOSPC for license/docs/migrate, distinct from PR 482's CVE verdict. All six proof runners reported ubicloud-standard-2 and a **76,887,154,688-byte** root filesystem. Preparation reclaimed **21,646,319,616–21,646,331,904 bytes** per job, exceeding the recorded at-least-10-GiB prediction. Image-size prediction also held: the previously failing three are about 2.08 GB each, versus 0.23–0.41 GB for the three Next standalone images. These are Docker Size measurements from branch rebuilds using unchanged baseline Dockerfiles, not recovered historical registry sizes.

| Service | Image bytes | Freed before build, bytes | Free after scan, bytes | Scan    |
| ------- | ----------: | ------------------------: | ---------------------: | ------- |
| admin   |   295282657 |               21646323712 |            25780109312 | SUCCESS |
| demos   |   228274424 |               21646323712 |            26470543360 | SUCCESS |
| docs    |  2079241994 |               21646331904 |            23932719104 | SUCCESS |
| license |  2076994749 |               21646319616 |            23938031616 | SUCCESS |
| migrate |  2076994749 |               21646323712 |            23937896448 | SUCCESS |
| site    |   414970842 |               21646327808 |            24905379840 | SUCCESS |

Readback: complete cached GitHub job-log ZIP plus six downloaded scan-proof artifacts, summarized in /home/gw/lab/briefs/estate-2026-09/handoff/S8-R333-SCAN-PROOF-SUMMARY.json. Preparation's remote image-source setting is visible in subsequent job environments; the branch scan deliberately overrides it to Docker, retaining the previously failing export. The proof covers scan headroom and execution, not production registry authentication, signing or publication. A main publish-image run still must pass all six scan steps before task 3 resumes.

Trivy reports remain nonempty: 176 SARIF rows per Next image and 194 per full-workspace image, with the publisher's exit-code 0 policy. Successful scan execution is not a CVE-clean verdict. R333 OS patch/re-scan evidence remains separate.

Peer code/security dispatches were refused admission and never ran. One set of eyes; no independent review pass. The first reviewer targets remain cleanup target safety, proof representativeness versus private-registry publication, and production remote-source propagation. Measured headroom supports this runner image and build set; future runner/image growth is not proven.

R333 runtime patch is committed locally as **8eebf0395e2c354d509839f6fef6a93c00cf3833**, unpushed: eight Dockerfiles/nine runtime or migration upgrade layers, base pins retained, eight Python tests passing with an observed failing deletion mutation. Post-upgrade live CVE proof has not run. The explicit schedule-policy question remains unanswered; no implicit lock or ignore-unfixed-only workaround. PR 482's remote head remains its original failed scan.

SOT disposition remains branch-hygiene EXPECTED-DRIFT (operator preserves branches) and the same sixteen frontmatter-lag documents/source dates recorded in s8-sot-disposition.md; no bulk date bump. Other SOT checks passed. Task 1 remains scoped NO DEFECT with diagnostic removal recorded; release/consumer publication remains incomplete.

## S8_PUBLISH_RED and R333 — historical preparation checkpoint

S8_SCAN_FIX_PR [483](https://github.com/caisson-sh/caisson/pull/483) is OPEN at **011afe3e5565c5dd9ed2388b3dabe7bf2419d4d8**, base **6604844a3f17633e5221075af6d01966620eaaed**, seven files. Existing publish-gates worktree now uses fresh fix/publish-scan-disk-2026-09; old branch remains preserved. The shared publisher is byte-identical. Local eight-test/twelve-assertion suite, deliberate remote-source mutation, changed-file lint, shell syntax, YAML and formatting passed. Six-image proof run **34896392494** is running, with actual image/disk/scan readbacks still pending. The branch proof uses Docker export as a deliberate greater-disk-demand arm; production selects remote. No private-registry/auth/signing proof is inferred from it.

R333 OS edits are locally committed on ci/scheduled-rescan-2026-09 as **8eebf0395e2c354d509839f6fef6a93c00cf3833**, not pushed. Eight Dockerfiles, nine upgrade layers cover runtime/migration lineages without moving base digests. Eight Python tests pass; deletion of admin's migrate upgrade caused the predicted failure then restored pass. Live post-upgrade CVE proof is not yet run. The pending operator clarification concerns scheduled patched-base scan enforcement versus raw-base reporting: raw pinned bases retain fixed CVEs even after runtime patching. No default/elapsed-time decision was taken and no ignore-unfixed-only change was made.

S8_PUBLISH_RED received for run 34888116937 at 6604844a3f17633e5221075af6d01966620eaaed. Forge confirms all six gates succeeded; site/admin/demos publish succeeded, license/docs/migrate failed at vulnerability scan, collect skipped. Full job logs independently confirm the same Trivy FATAL Docker export ENOSPC on all three failed jobs. This is transport/resource failure with exit-code policy 0, distinct from PR 482's base CVEs. Runner label ubicloud-standard-2, documented 75 GB disk; observed free-space warnings: license 0 MB, docs 2 MB, migrate 0 MB. Image sizes and fresh runner capacity remain to be measured in the branch proof.

The operator assigns the scan-runner repair here and authorizes R333 runtime OS upgrades while retaining digest pins. Separate PRs keep their proof scopes distinct. Publish workflow is shared-template-owned (ADR-0419); use the existing repo-owned prepare-build hook for runner preparation rather than modifying that template. Task 3 now explicitly requires a main run passing all six scan steps. Peer dispatch refusal/no-retry remains in force. A schedule-policy clarification is pending; no ignore-unfixed-only workaround is taken.

Cockpit reports deploy-railway run 34888117007 succeeded for admin/demos/site/docs/support-bot; license at 6604844a is its R330 act. One helper row was appended with that SHA, deployedAt 2026-09-14T20:49:01.369Z, deployedBy Liam (GridWork). This is helper receipt time, not a serving-revision or deployment-status measurement by this lane. No license action here.

Current location: `outputs/audit/release-train-2026-09-RUN-NOTES.md`, relocated from the repository root by the operator's SOT ruling. Earlier root-path diagnostics below describe historical runs.

## Compact continuation checkpoint — operator SOT ruling

### R332 — PR 482 stopped on real base-image findings

**STOP — first failed CI gate, no retry.** [PR #482](https://github.com/caisson-sh/caisson/pull/482) remains OPEN at **1f7cf0347b51ffd430ff53f1529445f03a0b060f**, base **6604844a3f17633e5221075af6d01966620eaaed**. In [run 34890012728](https://github.com/caisson-sh/caisson/actions/runs/34890012728), deterministic job **104130029716** passed offline tests, pinned scanner installation and the existing source scan, then failed the new anonymous base-image step at **2026-09-14T19:59:07Z**, exit **1**. Artifact upload succeeded. CI checked out the normal PR merge ref **82b294cd1473acf2693eb84e5de1a149fe3e9766**, recorded in its census; it is distinct from the PR head.

The real scan downloaded its vulnerability DB and examined **oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61**, linux/amd64, Debian 13.6, 80 OS packages. SARIF reports **55 package/CVE result rows: 3 CRITICAL, 52 HIGH, 20 unique CVEs across 19 packages**. These are scanner findings, not independently triaged exploitability claims. Twelve rows list a fixed version. Critical rows: **CVE-2026-13221, CVE-2026-42496, CVE-2026-8376**, all perl-base **5.40.1-6**, scanner-listed fix **5.40.1-6+deb13u1**. Python was not scanned because the driver stopped on the first failing image. No two-image clean result exists.

Evidence: [artifact 10366491930](https://github.com/caisson-sh/caisson/actions/runs/34890012728/artifacts/10366491930), seven files; downloaded under /home/gw/lab/briefs/estate-2026-09/handoff/S8-R332-SCAN-FAILURE/. base-1.sarif SHA-256 **c7161cc313233470db27554e0d6a6b79bf160714ff6f3ed983b034a74fb94fc6**. Summary with all 55 rows: S8-R332-SCAN-FAILURE-SUMMARY.json in the handoff directory. The first log command could not serve logs while semgrep-pro was still running; one corrected read used the completed-job log API, not a CI retry. Source scan and the other five required checks were SUCCESS; deterministic was FAILURE, semgrep-pro was still in progress at stop. No aggregate green claim.

The predicted real scan pass was refuted. Task 2 remains incomplete at a red PR; no code repair, digest change, scanner relaxation, CI rerun, merge, deployment, publication or branch deletion followed. Task 3 still waits for the cockpit's S8_PUBLISH_GREEN and remains held. Resume requires a ruling on these base-image findings; all scope limits and the peer-review refusal remain as recorded below.

### R332 — scheduled rescan PR 482 opened (historical checkpoint)

R332 (EST-ASK-290) locks main source plus exact Dockerfile-declared base digests. Census at **6604844a3f17633e5221075af6d01966620eaaed**: eight Dockerfiles, fourteen FROM lines, eleven external references, two unique images (Bun 1.4.2 and Python 3.14). Full census and path/line map are in S8-R332-RESCAN-CENSUS.json under the estate handoff directory.

Implemented on the lane as **011f77dc52926c3e6a4dba56eb794a50529ed1f2**. Task 3 remains blocked on S8_PUBLISH_GREEN, so R332's separate-PR path applies: fresh ci/scheduled-rescan-2026-09 off 6604844a carries only that six-file rescan change, cherry-picked as **1f7cf0347b51ffd430ff53f1529445f03a0b060f**. **S8_RESCAN_PR [482](https://github.com/caisson-sh/caisson/pull/482)** is forge-verified OPEN, non-draft, exact head/base and six paths confirmed. Lane branch remains local. Initial CI was queued/in progress; no green claim yet.

Daily cron is 37 6 * * * (06:37 UTC), added only to security-scan. Existing source scan is preserved; base scans derive the exact current pins, run anonymously against linux/amd64 with fresh Trivy config/cache, preserve failures and upload census/SARIF. **Published private images are not rescanned by this schedule**; app build layers, downstream images and other platforms are also outside scope. No registry credentials, publisher change or deployment.

Six offline tests, Ruff, YAML structure, formatting and whitespace passed. Both deliberate mutations failed as predicted, then restored tests passed. Independent croniter 6.0.0 enumerated 800 daily ticks through 2028-11-22 including leap day. First eligible trigger is the first 06:37 UTC after merge; September 15 only if merged beforehand, with GitHub delay/drop semantics. A scheduled execution has not yet occurred. See [verification](s8-scheduled-rescan-verification.md).

Peer code/security dispatches were refused admission and never ran; no retry or independent review pass. Own-judgment claims: FROM completeness/unsupported syntax, anonymous Trivy boundary, job reachability/failure handling and scope/platform limits. SOT returned only established dispositions: branch-hygiene EXPECTED-DRIFT because branches must stay, and the same sixteen lagging documents/source dates in s8-sot-disposition.md. No date bumps. Task 1 remains scoped NO DEFECT with diagnostic cleanup recorded. Task 3 and consumer package updates remain held.

### R325 — license cleanup recorded; executed publish signal pending (historical)

S8_LICENSE_CLEAN received from the cockpit on 2026-09-14: Railway deployment **5994b95f-699a-4726-9e1e-d0d06cfd3e4b**, status **SUCCESS**, created at **2026-09-14T19:39:04.980Z**, source **0b2046e722750a732ad23aa6f9d9ff230fbd2d5d** (diagnostic removal). The cockpit read license.caisson.sh/health at **19:41:29Z**: HTTP **200**, x-caisson-revision **0b2046e7…**. This closes the license runtime cleanup on operator-supplied evidence; this lane did not deploy or independently probe license.

The helper appended one row to docs/deploy/receipts/caisson-license.json: the same full source SHA, deployedAt **2026-09-14T19:39:03.033Z**, deployedBy **Liam (GridWork)**. That timestamp is the helper receipt time, distinct from Railway creation and the later health read. Existing receipt rows remain intact; this row is committed with these audit updates.

Fresh audited forge readback confirms [PR #480](https://github.com/caisson-sh/caisson/pull/480) MERGED at **2026-09-14T19:14:58Z** as **a0b548456a58d4562f6999b1aa95fe3ccd402f33**. Its [main-push publish-image run 34885734523](https://github.com/caisson-sh/caisson/actions/runs/34885734523) completed SUCCESS, with select SUCCESS but publish and collect **SKIPPED** by the path gate. The cockpit reports completion at 19:16:51Z. Branch red/green evidence remains valid; this main run does not prove an executed publish.

Forge also confirms [PR #481](https://github.com/caisson-sh/caisson/pull/481) MERGED at **2026-09-14T19:38:18Z** as **6604844a3f17633e5221075af6d01966620eaaed**. The cockpit identifies its fleet Bun 1.4.2 Dockerfile change as the first ensuing run with publish jobs executing and is watching it. **Task 3 waits for S8_PUBLISH_GREEN or S8_PUBLISH_RED with its run ID.** No success is inferred and this lane has not polled or dispatched that run.

Task 2 remains active, with the scanner target decision pending: schedule source plus digest-pinned base-image scans, or prepare rescanning of published private images. The earlier three-pin Dockerfile census predates #481 and must be refreshed before implementation. No scanner scope has been silently locked. Task 1 remains NO DEFECT in the measured scope, with source/artifact removal proven and license runtime cleanup now recorded. Peer code/security dispatches were refused admission and never ran; the existing single-author judgment limitations remain unchanged. No lane push, merge, deployment, publish, tag or branch deletion is authorized by this handoff.

Verification for this receipt: whole-tree formatting passed (3,483 files), whitespace check passed, and porcelain listed exactly the helper JSON and these two audit documents. SOT returned only the two previously dispositioned classes: branch-hygiene EXPECTED-DRIFT because the operator requires preservation, and the same 16 frontmatter-lag documents/source dates recorded in s8-sot-disposition.md. No dates were bumped and no aggregate SOT-green claim is made.

### R324 — pipeline repair PR 480 green, held for cockpit (historical)

**S8_PUBLISH_PR [480](https://github.com/caisson-sh/caisson/pull/480)**, OPEN and ready, head **`18b00f54e15875f96448a320ccfde38eb1a49c8a`**, base removal `0b2046e722750a732ad23aa6f9d9ff230fbd2d5d`, forge merge state CLEAN. All six required checks plus publisher-equivalent gates and every other active check are SUCCESS; draft/path skips remain explicitly SKIPPED. Six-file pipeline scope only, no lane receipt history pushed.

The unchanged-script baseline `bf3af057e2d22e90b59f8dd4aead8aeca542adb1`, run 34879216994 / job 104093991797, produced actual gates **cancelled** (18:11:18–18:14:34Z). Thirty-seven memory samples: 8,131,576 KiB total, available minimum 51,404 KiB, full pressure avg10 reached 50.86 before exit 137. Fixed head run 34879963930 / job 104096517729 produced actual gates **success** (18:19:22–18:25:43Z). Seventy-six samples: 8,131,584 KiB total, available minimum 674,556 KiB, maximum full pressure avg10 21.22. Same ubicloud-standard-2 runner class, cold checkout and gate command; no publisher credentials or external publication.

Fix exports TURBO_CONCURRENCY=50%, matching required CI, preserving all ten gate commands. Successful cold run: 120/120 Turbo tasks, 67 test summaries totalling 7,268 reported tests (includes separately executed registry/deploy suites, not unique tests). Local command-contract mutation failed without export and passed with it; all five original/new gate tests passed, eight assertions, lint/shell/format green. The evidence supports intra-job memory pressure, not six suites sharing one VM; exact kernel shutdown mechanism remains unexposed.

Sep 10 first red differs: six gates succeeded; admin/demos/site failed later in Docker builds, with admin/demos Bun segmentation faults at Next Running TypeScript. Main contains demos/site build-stage repair #478; admin build stage remains Bun 1.3.14. This PR proves the gates fix; first complete green publish-image run on main remains the release precondition. No merge, publish, tag or consumer rollout here. Peer dispatches were refused admission and never ran; one set of eyes, no implicit review pass. Attribution to pressure, CPU-relative cap suitability, gate/environment preservation, and the separate Docker residual are the claims resting on my judgment alone.

R325 license cleanup still awaits S8_LICENSE_CLEAN from cockpit; no action here. Rescan scope question is pending: current security-scan only examines source/lockfiles, not images. Read-only census found eight production Dockerfiles and three unique digest pins; no schedule edit made and no scheduled publish added. Operator packet: `/home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-R324-PUBLISH-GATES.md`.

### R324 reconciliation readback and pipeline baseline

Reconciliation committed normally as **`bb99e27ee809f9b764cac6ef1632a4de9de8e196`**, parents `35f565d6bcc12f50f55b03e9ad37e19d681bd5b4` and removal `0b2046e722750a732ad23aa6f9d9ff230fbd2d5d`; ancestry check exited 0, worktree clean. This is the candidate binding for [the removal verification](s8-removal-verification.md).

Fresh `fix/publish-gates-2026-09` worktree off removal main now has draft PR [480](https://github.com/caisson-sh/caisson/pull/480), baseline `bf3af057e2d22e90b59f8dd4aead8aeca542adb1`. Three paths only: PR-only workflow, SPEC and PLAN. Source gate unchanged. Prediction: original gates step fails/cancels; bounded concurrency will be tested only after that result. Run `34879216994` is the branch reproduction, with memory counters and no publish/auth/deploy steps.

### R324/R325 — resume and reconcile diagnostic removal

R324 authorizes diagnosis/fix of pre-existing publish-image failures in a separate `publish-gates-2026-09` worktree and instructs completing this existing merge. R325 leaves license cleanup with the cockpit; await S8_LICENSE_CLEAN, no deployment here. The prior merge-check stop is disposed by that ruling, not converted to a pass.

Completed the five-item source/artifact/removal/gate/difference record in [s8-removal-verification.md](s8-removal-verification.md): no marker/deadline/logger or observer callback in source/emitted limiter JS/declarations; all affected source/tests and changesets exactly match removal main; three implementation files equal e2116849; 64 tests / 168 assertions and changed-file lint pass, six required removal-SHA CI checks pass. Known image-publish failures are assigned to the separate repair; full eventual lane CI remains outstanding. Merge commit will preserve all 22 existing local commits, later main changes and audit documents.

### R315 removal merge verified — image-publish checks stop continuation

Forge verified #479 merged as **`0b2046e722750a732ad23aa6f9d9ff230fbd2d5d`**, 2026-09-14T17:50:51Z. Fetched that main and merged it into the lane with `--no-commit --no-ff`, without conflicts. Removed only the seven original diagnostic paths from the lane against verified main; preserved all 22 existing lane commits and audit history (the earlier 18-doc count is historical). Source/tests and all changesets match main; the three implementation paths on main equal e2116849. Three suites passed **64 tests, 0 failures, 168 assertions**; limiter build passed.

The actual removal-SHA check readback has all six required checks successful, but **publish (caisson-site), publish (caisson-migrate), publish (caisson-license), publish (caisson-admin) completed with failure**. Docs/demos publish, semgrep-pro and deploy were still in progress. These additional failures were not predicted; stopped under the standing rule. No cause or Railway failure is inferred from image-publish checks. No retry or dispatch.

The lane is deliberately left in its existing uncommitted merge at HEAD 35f565d6; these receipt edits are uncommitted too, because a commit during the merge would include the incomplete reconciliation. Emitted JS/declaration inspection and the complete five-item absence proof remain unfinished. No scanner edit, lane push, release PR, cut, tag or consumer rollout. Packet: `/home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-R315-MERGE-CHECK-STOP.md`; prospective record: `S8-R315-POST-MERGE-PREDICTION.md` in that directory.

Runtime cleanup remains open: the operator reports main-push redeploys admin/demos/site/docs/support-bot, but deploy was still in progress at readback; license remains at diagnostic deployment `c8e48687-3966-4b62-a4f7-6eda00628ab4`, pending a separately ruled helper deploy. No runtime cleanup or independent review pass is claimed.

### R315 removal PR opened — staged changeset disposition completed

The operator clarified that an own sequencing slip is an own-tool exception: fix the order and rerun once without another hold packet. Staged the already-authorized `.changeset/s8-remove-direct-key-observation.md`, then `bunx @changesets/cli status --since=origin/main` exited 0 with no patch/minor/major releases. Fresh staged whitespace and whole-tree formatting checks passed (3,475 files). The unchanged reverted TypeScript retains the earlier 64 passing tests / 168 assertions and successful six-file lint evidence.

Removal committed normally as **`f92f2142cc5f47d3983ae55042fe0833101f9f34`**, pushed only `chore/s8-remove-direct-key-observation`, and opened **PR [479](https://github.com/caisson-sh/caisson/pull/479)**. Audited forge readback: OPEN, base `a386502af2f037d59078d5382ae617fc027f1a1a`, exact head above, exactly eight paths (seven-file inverse plus the new empty removal changeset), no merge or auto-merge. Required checks were queued at initial readback; no CI green claim. The PR body contains probe/removal evidence and states that independent code/security reviewers did not run. The lane branch remains local; no push of lane history.

R315 directs reporting S8_REMOVAL_PR and idling after opening. The cockpit merges on green. Await S8_REMOVAL_MERGED before the five source/emitted-artifact/removal/candidate checks and subsequent release work. No post-merge absence proof, removal deployment, release cut, tag, merge or consumer rollout is claimed or performed by this lane.

### R315 empty-changeset authorization — repeat status failure before staging

The operator authorized `.changeset/s8-remove-direct-key-observation.md` with empty frontmatter and a one-line body naming reverted SHA `7e54ddc5b05a4ee922468790efec2654666840da`. Created that exact file in the removal worktree; the seven-file inverse remains staged, while the new changeset is untracked. The authorized scope is now those seven reverted paths plus this eighth bookkeeping file, with no package bumps.

The lane then ran `bunx @changesets/cli status --since=origin/main` **before staging the new file**, a sequencing mistake. It again exited 1 with "Some packages have been changed but no changesets were found" and the empty-changeset instruction. Predicted pass/no releases was not observed. The file has not been staged, and no retry, removal commit, push or PR followed this measured gate failure. The remaining corrective step is to stage the already-authorized file before a ruled status rerun; no new content or scope decision is proposed. Packet: `OPERATOR-ACT-S8-R315-UNSTAGED-CHANGESET-STOP.md`. The existing 64-test/lint/format results remain unchanged; task 1's accepted no-defect outcome is unaffected.

### R315 clarification — removal checks pass until Changesets status

The operator clarified that an ENOENT on an assumed exploratory path is an own-tool error, not a subject of the measured-result stop rule. Resumed the existing staged inverse; skipped the unnecessary hook read. Staged scope remained seven files, 5 insertions / 229 deletions, whitespace clean. Frozen dependency install passed (Bun 1.3.14; 3,303 packages). The three removal suites passed **64 tests, 0 failures, 168 assertions**; six-file oxlint passed; whole-tree format check passed (3,474 files). No mutation beyond the authorized revert or lockfile change was introduced.

`bunx @changesets/cli status --since=origin/main` then exited **1**: "Some packages have been changed but no changesets were found. Run `changeset add` to resolve this error." It also says: "If this change doesn't need a release, run `changeset add --empty`." The predicted no-bump success was not observed. The exact revert deletes `.changeset/s8-direct-key-observation.md`, and introduces no new changeset. This is a measured repository gate failure, so the clarified stop rule applies. No empty changeset was added, no status retry occurred, and no removal commit, push or PR was created.

The seven-file inverse remains staged in `/home/gw/lab/worktrees/caisson/s8-remove-direct-key-observation-2026-09` on `chore/s8-remove-direct-key-observation`, base a386502a. Proposed disposition is a new empty removal-specific changeset, keeping the old diagnostic entry deleted and scheduling no package bump; that would expand the seven-file scope and is held for the operator's ruling. Packet: `OPERATOR-ACT-S8-R315-CHANGESET-STOP.md`. Preserve the green checks and this failed gate; do not claim S8_REMOVAL_PR or release readiness. No merge, deploy, release, tag or branch deletion.

### R315 — exact removal staged; exploratory hook-path read stopped preparation

R315 (EST-ASK-274) accepts task 1's closure at `522ee919` and authorizes the removal PR before later release work. Fetch origin main and the `7e54ddc5` ancestry check passed. Created `/home/gw/lab/worktrees/caisson/s8-remove-direct-key-observation-2026-09`, branch `chore/s8-remove-direct-key-observation`, from origin/main `a386502af2f037d59078d5382ae617fc027f1a1a`. Exact `git revert --no-commit 7e54ddc5b05a4ee922468790efec2654666840da` exited 0. Staged diff is exactly the seven packet paths, 5 insertions / 229 deletions; staged whitespace check exited 0. No conflict or product gate failure occurred.

The next exploratory file-tool invocation read package.json successfully, then attempted the assumed path `.husky/pre-commit` without first discovering the repository's hook location. It returned `ENOENT: no such file or directory, open '/home/gw/lab/worktrees/caisson/s8-remove-direct-key-observation-2026-09/.husky/pre-commit'` with isError true. The later `.husky/pre-push` read in that invocation was not reached. This is this lane's mistaken lookup, not evidence of a missing required hook or repository defect.

Stopped on that unexpected result. R312/R315's retry-once exception explicitly names own-tool patch, JSON and message-file failures; this file-read error is outside those named exceptions. No hook-location workaround, dependency install, suite, lint/format gate on the removal candidate, review admission/dispatch, removal commit, push or PR followed. The seven-file inverse remains staged in the fresh removal worktree. Only this hold record is persisted on the lane, without pushing it. Packet: `OPERATOR-ACT-S8-R315-HOOK-LOOKUP-STOP.md`. A further ruling must release this hold before removal preparation resumes; do not claim S8_REMOVAL_PR. No merge, deploy, release, tag or branch deletion.

### R314 — remaining license arms matched; eight observations complete

R314 (EST-ASK-273) supplied second license deployment `c8e48687-3966-4b62-a4f7-6eda00628ab4`, SUCCESS, created `2026-09-14T14:48:25.714Z`, same source `a386502af2f037d59078d5382ae617fc027f1a1a`, cockpit-authorized helper `--force`. Health at 14:50:53Z returned 200 and exact revision. The three remaining arms ran in the ruled order B-normal 14:51:01Z, A-forged 14:51:10Z, B-forged 14:51:17Z, all 401/unauthorized at the exact revision. Only X-Real-IP/XFF were supplied on forged arms. One bounded log read returned each exact marker once, with B key `issue|45.17.0.122` for both B arms and A key `issue|2600:1702:7e60:3c0::31` for A-forged. No further unexpected result or unruled retry occurred.

The companion receipt now consolidates eight application-reaching observations across license L1 `4841e05e-cd49-4ed9-94b2-1ab19f2172b1`, site S1 `ea5b5b31-2e5d-4cc6-9de1-d7e67c0caef0`, and license L2 above, all bound to a386502a. Verdict: **NO DEFECT in the measured client-IP keying scope**; the original three-header Cloudflare refusal remains a separate ninth probe attempt. Instance IDs are still unexposed in CLI logs; source/marker/time correlation is measured and deployment IDs are cockpit-supplied. This is no claim of a same-instance comparison across license deployments or independent peer review. Review dispatches never ran.

Preserve the appended forced license receipt row at 14:48:24.633Z (Liam (GridWork)); first-license and site rows are already committed in `1aff2b9e` and `5f0b4ec9`. The final receipt supersedes historical partial verdicts, closes task 1's observation as a scoped no-defect outcome, and holds removal/release/fold/rescan work for their rulings. Diagnostic removal remains mandatory before a cut. No deployment by this lane, push, merge, tag, removal PR or release cut. Report S8_PROBES_DONE plus verdict and idle.

### R313 site-live handoff — all four corrected site arms matched

S8_SITE_LIVE supplied deployment `ea5b5b31-2e5d-4cc6-9de1-d7e67c0caef0`, SUCCESS, created `2026-09-14T14:41:44.663Z`, source `a386502af2f037d59078d5382ae617fc027f1a1a`. Site health returned 200/exact revision at 14:45:08Z. Four arms ran in table order at 14:45:16Z, 14:45:24Z, 14:45:33Z and 14:45:42Z, all application 403/challenge_failed at that revision. Forged arms sent only X-Real-IP and XFF. One bounded log read returned each marker once: A normal/forged IP `2600:1702:7e60:3c0::31`; B normal/forged `45.17.0.122`. All match the prospective predictions. Last log row is less than four minutes after deployment creation. No retry or window extension.

Full timestamps, response IDs and direct values are in the companion receipt. CLI logs still expose no instance/deployment IDs: deployment ID is handoff-supplied and source/request correlation is measured through response revisions, markers and times; instance-level joining remains unavailable. Preserve the helper's appended `docs/deploy/receipts/caisson-site.json` row (14:41:43.532Z, Liam (GridWork)). Site arms are complete within this stated evidence limit; remaining license arms remain held and task 1 is not closed. Report S8_SITE_ARMS_DONE plus the scoped outcome, then idle. No further license act, deployment, removal PR, release, push, merge or tag.

### R313 — edge refusal disposition; site requests prepared

R313 (EST-ASK-272) identifies the prior 403/code 1000 as Cloudflare's refusal of client-supplied CF-Connecting-IP, before the application; A-forged's marker is unconsumed per the operator. Recorded as a separate edge finding in the companion receipt. Future forged arms send only X-Real-IP `203.0.113.91` and XFF `198.51.100.92, 198.51.100.93`; historical evidence retains the originally sent three headers. License window closed at 14:36:13Z and all remaining license arms are held pending a further second-deployment ruling. No license act is taken now.

Prepared the four site commands under `S8-R313-SITE-REQUESTS.md`, body `S8-R313-SITE-BODY.json`, in the estate handoff directory. Updated the deployment packet and recorded prospective predictions before the requests. Await S8_SITE_LIVE for `a386502af2f037d59078d5382ae617fc027f1a1a`; then health 200/exact revision, A-normal, A-forged, B-normal, B-forged, one bounded site log read and correlation. Predict application 403/challenge_failed for all, exact IP A `2600:1702:7e60:3c0::31` and B `45.17.0.122` unchanged by the two forged headers. No site request, deployment, retry, marker consumption, push or release has run during preparation.

### R312 license-live handoff — stop at A-forged response

Cockpit supplied license deployment `4841e05e-cd49-4ed9-94b2-1ab19f2172b1`, SUCCESS, created `2026-09-14T14:26:13.370Z`, at ref `a386502af2f037d59078d5382ae617fc027f1a1a`; instance ID to be taken from logs. Health at 14:29:21Z returned 200 and exact revision. A-normal at 14:29:29Z returned predicted 401; the direct diagnostic log records `issue|2600:1702:7e60:3c0::31` for marker `92c71b83-737c-493b-b87d-e3c470e0075a`. A-forged at 14:29:38Z returned **403, error code: 1000**, instead of predicted 401; CF ray `a3b015c098a40779-ATL`, no application revision/request IDs. The request sequence stopped immediately before both B arms. No site arms ran.

One bounded license log read after the stop preserved evidence of the already-sent A-normal request; it contains no A-forged marker and exposes no instance/deployment IDs. Deployment identity is handoff-supplied and corroborated by the response revision, but instance correlation is unresolved. Full partial record is in `release-train-2026-09-receipt.md`, companion to the prediction; `OPERATOR-ACT-S8-R312-LICENSE-FORGED-STOP.md` requests disposition. Preserve the cockpit helper's appended license receipt row (`a386502a`, deployedAt 14:26:12.234Z, Liam (GridWork)) in the same local stop record. No retry, header variant, re-arming, window extension, deployment, push, merge, release, tag or removal PR follows. Do not claim S8_PROBES_DONE or a complete license pass; task 1 remains inconclusive.

### R312 — packet corrected; cockpit deployments precede fresh probe windows

Preflight completed in the ruled order on 2026-09-14. Correction commit `3c1cc163` followed stop-note commit `93ee79f1`, both local. Fetch origin main and both `merge-base --is-ancestor` commands exited 0. License deployment list: `ea0bb9c8-aa36-425e-804a-cf08d9dd4928`, SUCCESS, created `2026-08-28T22:43:59.244Z`, image `sha256:4218ad077fc7d5b50d247e0825bf81d61d9933c84b53171ddb32f57f24c5075b`. Site deployment list: `8ba661b7-e208-4c68-b8e5-029a34e5795b`, SUCCESS, created `2026-09-12T05:19:58.913Z`, image `sha256:5a320b44cfef759a4f88133354251e91351c7bff6e7fff1128a591b68f1ae191`. These list responses do not expose a serving revision or instance ID; no such value was inferred from them. The site's a386502a revision remains the supplied cockpit readback until post-redeployment health verification.

Ordered ingress rechecks: A IPv6 returned HTTP 200 at response Date `2026-09-14T14:24:21Z`, trace IP `2600:1702:7e60:3c0::31`, CF ray `a3b00e064a5a5193-ATL`; B IPv4 returned HTTP 200 at `2026-09-14T14:24:28Z`, trace IP `45.17.0.122`, CF ray `a3b00e2f8f2a1399-ATL`. Both match the recorded exact predictions. Expected license keys remain `issue|2600:1702:7e60:3c0::31` and `issue|45.17.0.122`; expected Ask AI IPs are those same addresses, unchanged by forged headers. No application request, marker consumption or deployment occurred. Report S8_PREFLIGHT_OK and idle for S8_LICENSE_LIVE. The removal-packet SHA-256 remains `73bab6e8673fcb2ab5f508e74e2bad4c8c6f62dd00498d363e719d98560884c7`.

R312 (EST-ASK-271, 2026-09-14) resumes from the R307 tooling stop. The outstanding R307 note was committed first as `93ee79f1`. This ruling permits one redo with a different file tool for an own-tool patch/JSON/message-file failure, stopping if the same edit fails twice; measured-result, gate and floor-denial stop rules are unchanged.

Corrected `OPERATOR-ACT-S8-DIAG-DEPLOY.md`: both services deploy and must serve **`a386502af2f037d59078d5382ae617fc027f1a1a`**. Both this SHA and diagnostic introduction `7e54ddc5b05a4ee922468790efec2654666840da` must be ancestors of origin/main. The removal packet and its exact `7e54ddc5` revert target remain unchanged. Admin is already live and is not redeployed. R312 supersedes R307's site-already-live/no-redeploy instruction: the cockpit now redeploys both license and site, one at a time; this lane performs no deployment.

Cockpit-supplied 2026-09-14T14:18Z baseline: main unchanged since #478; site serves a386502a by revision header; license health 200 without revision header; main's tracked receipt rows end at 886e1e7c for both services. These remain supplied facts until measured. After the local packet-correction commit, run fetch, both ancestry checks, license/site deployment lists, A IPv6/B IPv4 ingress in order. Predict successful checks/readbacks, site SUCCESS at a386502a, license SUCCESS on its pre-diagnostic deployment, and ingress A `2600:1702:7e60:3c0::31`, B `45.17.0.122`. On pass report S8_PREFLIGHT_OK and idle. License/site arms await their respective S8_LICENSE_LIVE/S8_SITE_LIVE handoffs, then health/revision, four ordered requests and one bounded log read per service. Windows remain ten minutes from the relevant app creation/module load, not from the handoff. No release, removal PR, push, merge or tag.

### R307 — packet-edit tool failure; execution stopped before preflight

Read R307 (EST-ASK-264) from `/tmp/claude-1000/-home-gw-lab/7a239725-df91-4d47-8175-9a0b72e21ad9/scratchpad/rt-resume-r307.txt`. It supplies the 2026-09-12T05:24:20Z readback: #478 merged as `a386502af2f037d59078d5382ae617fc027f1a1a`; admin/demos/site SUCCESS in main-push run 34675184008, site step ending 05:21:50Z, license skipped; site health 200 at that revision and license health 200 with no revision header. These facts remain operator-supplied, not independently verified in this attempt.

R307 requires the deployment packet and these notes to bind the serving revision to `a386502af2f037d59078d5382ae617fc027f1a1a`, preserving `7e54ddc5b05a4ee922468790efec2654666840da` as diagnostic ancestor and exact removal target. Admin is already live; site must not be redeployed. It authorizes ordered preflight and then site arms, with license probes held for cockpit S8_LICENSE_LIVE. The conservative site window is 05:21:50Z–05:31:50Z.

Before any mutation, the packet-edit orchestration failed: the file tool returned a displayed object containing an in-memory patch; the outer functions call attempted `JSON.parse` on that display and raised `SyntaxError: Expected property name or '}' in JSON at position 4 (line 2 column 3)`. The dependent `apply_patch` calls were never reached. Neither operator packet was changed. This is a tool-protocol error in this lane, not a product finding or probe refutation.

The first unexpected result triggers the standing stop rule. No retry, correction execution, fetch, ancestry check, Railway readback, ingress recheck, application probe, marker consumption, deployment, push or removal followed. Only this stop record and `OPERATOR-ACT-S8-R307-TOOL-STOP.md` are being persisted. Do not emit S8_SITE_ARMS_DONE or ask the cockpit to deploy license: the site arms did not run. A further ruling must dispose of this stop and the remaining/expired site window before resumption; do not silently restart or extend the window.

### R298 — operator-reported deployment hold and future packet corrections

For the record only: the following deployment state is supplied by the operator, not independently re-probed in this turn. R292 authorized deployment, but its preflight stopped: the main-push `deploy-railway` run at `7e54ddc5` had already deployed `caisson-admin` (Railway `631bed9f`) automatically, then failed building demos at Next's "Running TypeScript" step. Site was skipped and license was untouched. After the operator merged #477 (`127db655`), the fleet workflow redeployed admin at `127db655` (`b4cccb72`); demos failed again (`0b6161c2`). The operator reports that this demos failure predates the diagnostic and has occurred on every main push since `2026-09-10T02:53Z`.

R298 orders the separate S15 lane (`S15-demos-build.md`) to fix demos first, followed by the fleet path deploying demos and site, then license through the S8 helper, then probes. S8 remains idle; this record does not dispatch any step. Preserve the per-service ten-minute observation constraint when preparing the eventual authorized sequence; no window extension or marker re-arming is implied by this order.

Two corrections must be incorporated when the operator next requests packet preparation:

1. Bind the deployment to the full main-tip SHA at that time, with `7e54ddc5b05a4ee922468790efec2654666840da` proven as an ancestor and the diagnostic proven unchanged. Do not deploy the old squash merely because the current packet names it. The diagnostic squash remains the identity of the change to remove; a future removal candidate must accommodate the later main tree.
2. State admin's diagnostic-bearing deployment as a pre-existing fact in the receipts, not as a pending S8 deployment. Its latest operator-reported revision is `127db655` (`b4cccb72`). Site currently serves `69b3ba35` and would receive #475, #476, #477 and the demos fix. License remains untouched by the reported fleet runs.

Both operator packets remain unchanged as instructed: `OPERATOR-ACT-S8-DIAG-DEPLOY.md` and `OPERATOR-ACT-S8-DIAG-REMOVE.md`. Their earlier deployment target/order must be reconciled with R298 before future use; they are not current execution authority. No forge/runtime lookup, packet rewrite, deployment, probe, revert, branch deletion or lane push was performed. Record this note and idle.

### R288/R290 — merge verified; deployment and removal packets prepared

Audited forge readback confirms PR #476 is MERGED into `main` at `2026-09-11T02:21:38Z`, squash **`7e54ddc5b05a4ee922468790efec2654666840da`**. The commit API confirms one parent, `e2116849082f57c1d5fdaf6b309086813f48e4f4`, and exactly the seven diagnostic files. The old PR head `aa71ff4e911250a5e9804e5b2c541a15d90a3c4c` is not a deployment or revert target.

Prepared `/home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-DIAG-DEPLOY.md` and `/home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-DIAG-REMOVE.md`, both bound to that full squash SHA. Deployment scope is license then site, probing each within its own ten-minute instance window, with the four exact markers, A ingress `2600:1702:7e60:3c0::31` and B ingress `45.17.0.122`, corresponding expected keys/IPs, verification and stop conditions. The deployment packet discloses license's existing migration pre-deploy command and the main-push site's possible automatic rollout; neither runtime state was inferred or measured in this packet-preparation turn.

The removal packet names `git revert --no-commit 7e54ddc5b05a4ee922468790efec2654666840da` in a future fresh removal worktree, its seven-file scope and the release precondition that the observer is absent from the actual cut source and built artifact. A future removal merge/deployment SHA must be recorded when it exists. Review dispatches still never ran; preparation adds no review pass. No deployment, application probe, revert, removal branch, PR, release, tag or branch deletion was dispatched. R288/R290 authorize these packets only; stop here and idle.

### R277 — fresh diagnostic PR preparation

Operator locked the frozen observation patch and permitted a fresh diagnostic-only PR. Created `feature/s8-direct-key-observation` off the live-advertised/local `origin/main` at `e2116849`, in the sibling S8 diagnostic worktree. Re-applied the checksum-verified frozen patch and copied only three tests plus the empty changeset from `38631ed4`; lane SPEC/PLAN/receipts remain here. The seven-file fresh branch passed 67 tests / 194 assertions, lint, formatting, Changesets status and normal hooks. GitHub PR #476 read back OPEN, non-draft, head `aa71ff4e911250a5e9804e5b2c541a15d90a3c4c`, expected base and exact seven-file scope. Required CI was queued, not yet green. Lane branch was not pushed.

Current quota preflight is 93%; the existing 180,000-token deep-route calculation would project 102% above the 95% ceiling. Conditional peer dispatches were therefore not attempted; previous refusals remain the evidence, and no peer-review pass exists. The single-author limitations remain explicit.

Client B trace observed `45.17.0.122` at `2026-09-11T01:56:49.956764+00:00`; the exact expected key `issue|45.17.0.122` and Ask AI IP were written to the prediction artifact before any application request. This is an IPv4 connection from the same host as A, not a separate device. No application probe, merge, deployment, publication, tag or branch deletion occurred.

Final readback at `2026-09-11T02:10:18Z`: PR #476 remains OPEN at the same exact head; all six required checks SUCCESS. Ancillary checks are SUCCESS or explicitly SKIPPED, none pending or failed. Required run IDs and every check disposition are in the receipt. Hold at this green PR under R277; no merge/deployment authority follows. Peer reviews never ran, and task 1 production keying remains inconclusive. Receipt-only persistence is the final lane action; the lane is not pushed.

### R272 — own-analysis task 1 outcome

The operator accepted diagnostic `38631ed4`, its local checks, and refusal receipt `a6639f78`. R272 directs proceeding without the peer dispatches: no admission retry, ceiling override or quota wait. It separately prohibits PR, deployment, publish, tag and live bucket-key measurement without a further ruling.

The authorized source/local assessment is complete; the production-keying outcome is **INCONCLUSIVE**. No defect is demonstrated and correct live per-client isolation is not established. The current receipt states explicitly that both peer dispatches were refused and never ran: one set of eyes, not two, with no implicit review pass. It names the own-judgement claims: actual-key observation fidelity; behavior preservation beyond tested cases; marker/expiry/logging limits; real-edge header trust and distinct clients; and the sufficiency of eventual evidence and diagnostic removal. No new test or live result is claimed by this assessment.

No product source changed under R272. The diagnostic remains committed and must be removed before release. Later release/fold/rescan work remains open. The previous quota hold below is historical; R272 permits this bounded assessment but grants none of the expressly withheld external actions.

### Current hold: review admission refused

The formatter unblock completed normally. Receipt commit `24229e8c` passed hooks. Diagnostic commit `38631ed48a035b717ee163e8564e057478f5e2d0` then passed hooks after 67 tests / 194 assertions, changed-file lint, whole-tree format and 46 successful build/typecheck tasks. Corrected Changesets status passed with an explicit empty no-release changeset. Full local evidence: `s8-diagnostic-verification.md`.

The code and security reviews were dispatched concurrently through the governed `gw dispatch` adapter, with `--codex-only`, a shared read-only brief, current source bundles and the exact diagnostic head. Both returned exit 2 before starting a reviewer. The admission gate reported: quota gauge 89%, estimated 180,000 tokens over a 2,000,000-token basis, zero existing reservations, projected 98.0% versus ceiling 95%. Both also reported `admission receipt telemetry skipped: dispatch admission sink returned 404`.

The earlier read-only `gw codex limits` preflight had reported 88%; that gauge was not an admission guarantee. No force override, retry, alternate-provider dispatch, policy/configuration edit, PR, deployment or live application probe followed the refusal. The S8 stop rule applies; task 1 remains open. Last product commit is `38631ed4`; source prediction remains `issue|2600:1702:7e60:3c0::31` for client A, unmeasured in the application.

Review logs: `/tmp/s8-code-review.log` and `/tmp/s8-security-review.log`. The scoped operator packet is `S8-REVIEW-ADMISSION-HOLD-20260910.md` in the estate handoff directory. These notes supersede the historical formatter stops below.

### Formatter unblock — operator-authorized continuation

The operator diagnosed the pre-commit gate as a whole-tree formatter check: uncommitted diagnostic edits can block a receipt-only commit. The eight reported unformatted files all belonged to this task. The operator authorized `bun run format`, required an ownership readback before staging, and retained normal hooks.

`bun run format` passed (exit 0; 3,476 files visited). Subsequent `git status --porcelain=v1 --untracked-files=all` listed only this task's six diagnostic source/test files, three audit documents, and SPEC/PLAN. No unrelated path or dependency manifest/lockfile changed. This supersedes the formatter hold below. Commit the formatted receipts normally, then resume diagnostic verification; no hook bypass or live-key claim.

### Latest stop: formatter tool invocation

The SOT dispositions were committed as `3e549193`; immediate readback was clean, four commits ahead of origin/main. All three R212 branches remain. `bun install --frozen-lockfile` then passed under Bun 1.3.14, installing 3,303 packages without a manifest or lockfile delta.

Task 1 resumed as authorized. Temporary diagnostic source and focused tests were prepared in the shared limiter, license application/integration suite, and Ask AI handler/suite. Draft SPEC/PLAN files were added under `outputs/{specs,plans}/release-train-2026-09/`. These edits remain uncommitted and unverified. They preserve header precedence and are not a bug fix or a live measurement.

Before tests, an in-memory formatting attempt used the installed Oxfmt API through the file-tool JavaScript runtime so edits could still be applied via `apply_patch`. The returned content was not the expected JSON; its displayed prefix was `process is...`. The orchestration parser failed with `SyntaxError: Unexpected token 'p', "process is"... is not valid JSON`. The full underlying formatter diagnostic was not retained in the tool output, so no more specific root cause is asserted. The dependent formatting patch was never applied.

This was an **unexpected tool result**, not a failing product test. Under the operator's unchanged rule, execution stopped without retry, formatter workaround, integration test, review, PR, deployment or live probe. Only stop receipts were updated afterward. Direct-key prediction remains recorded; task 1 remains open, with neither a defect nor no-defect verdict.

Receipt persistence attempt: staged whitespace verification passed, but `git commit -F /tmp/s8-formatter-stop-commit-message.txt` exited 1 with `pre-commit: oxfmt check failed (run: bun run format)`. The commit was not created. No bypass, formatting retry or further gate run followed. The latest successful commit remains `3e549193`; these stop updates and the diagnostic preparation remain uncommitted. This additional failed gate is recorded without attributing it to a particular file, since the hook output did not name one.

Completed disposition evidence: [SOT disposition and freshness report](s8-sot-disposition.md). Corrected CLI returned exit 0, v3.0.2, no branch packages to bump; no repository lockfile delta. The 16 stale documents are reported with their newer source dates, all 2026-09-09. No date stamps changed.

- Preserve `docs/sweep-2026-09-01`, `fix/session-hint-httponly`, and `probe/fumadocs-16.15`. Their branch-hygiene finding is **EXPECTED-DRIFT**, because the operator's preservation instruction overrides that advisory gate. It is not a stop condition.
- Root run notes were relocated here; active references must use this path.
- Use `bunx @changesets/cli status --since=origin/main` for the corrected changeset preflight. The root manifest declares `@changesets/cli`; it has no dedicated Changesets status script. The historical bare-package invocation was wrong.
- Report frontmatter lag with document/source dates; do not change dates to silence it. The operator has directed continuation after that report.
- Prior durable receipts: `714c813a`, `8950afe3`, `33bc343d`; product source is still the #475 source at `e2116849`.
- Task 1 is open. The proxy-source-IP hypothesis was refuted; that was not direct application evidence. Source key construction and the predicted client-A key are in `outputs/audit/s8-direct-key-prediction.md`.
- A tested temporary diagnostic patch exists in the handoff directory. It has not been applied to product source or deployed. Direct measurement remains required before a defect/no-defect verdict.
- Continue in the original task order. No merges, tag pushes, or package publish without per-PR approval; deployments remain operator acts. No branch deletion. Preserve the stop rule for new failures or unpredicted results.

Authority: `/home/gw/lab/briefs/estate-2026-09/S8-caisson-release.md`.

## Entry evidence

- Worktree: `/home/gw/lab/worktrees/caisson/release-train-2026-09`.
- Branch: `chore/release-train-2026-09`; initially clean.
- HEAD and live `origin` main advertisement: `e2116849082f57c1d5fdaf6b309086813f48e4f4`.
- `S11-LANDINGS.md` records all eight estate PRs landed, including Caisson #475 at that SHA.
- `S11-R220-COMPLETION-READBACK.json` records exit 0, `T39_FLOOR=PASS`, `T39_COMPLETION=R220`, measured at `2026-09-10T17:55:58.990894+00:00`.
- The two named IP helpers still prefer `x-real-ip`. This is source evidence only; it does not establish live bucket collapse.
- Read the release-train workflow and security-scan workflow. No pipeline command was dispatched; downstream scripts and the complete gate enumeration remain unread/unresolved.

## Stop: unexpected discovery-command result

The following read-only lookup returned exit 2:

```sh
snip proxy bash -c 'rg -n "clientIp\(|x-real-ip|cf-connecting-ip|request.headers|rate.limit" services/license/src/server.ts services/docs/src/server.ts apps/site/app/api/health apps/site/app/healthz deploy --glob "*.ts" --glob "*.md"'
```

Observed diagnostic:

```text
rg: apps/site/app/api/health: No such file or directory (os error 2)
```

The directory was assumed, not established from the tree. The brief's standing instruction is: “Stop and report on the first floor denial, the first failed gate, or any result you did not predict.” Execution stopped on this unexpected result. This was a local discovery failure, not a failed production probe, GitHub denial, or release gate.

No retry, product edit, test, commit, PR, merge, tag, publication, deploy, or branch deletion followed. Only these hold notes and the audit receipt were written.

## Outstanding work

1. Resume task 1 by establishing actual source paths, then measure the live limiter key through the real edge. Neither collapse nor correct per-client isolation has been demonstrated.
2. Assess all three R212 folds before the release cut and record per-path fold/drop verdicts and evidence. No fold verdict was made and no branch was deleted. Resolve the brief's explicit per-item deletion instruction against its standing “no branch deletes” instruction before any deletion.
3. Complete the end-to-end pipeline reading, derive current gate and tarball counts, and record predictions before execution. The train includes Worker/Railway deploy dispatches, which the brief reserves to operator packets even after package-publication approval.
4. Prepare the required changes and green PR; obtain the brief's per-PR approval before merge, tag push, or package publish.
5. Execute the remaining ordered tasks only within that authority, including scheduled scanner work and final publication/consumer evidence.

## Author correction and authorized resume

The brief author accepted the missing path as a brief defect and authorized resumption against `apps/site/lib/ask-ai/handler.ts`, with four named sibling surfaces. The author expressly retained the stop rule and **no branch deletes**; that resolves the deletion conflict above in favor of preserving all branches.

Before resuming, the two original hold artifacts were committed unchanged as `714c813a` (`docs(state): preserve S8 release-train hold evidence`). Staged whitespace verification passed; the commit contained exactly two files, 63 insertions. Immediate status readback was clean and one commit ahead of origin/main.

### Corrected source census

| Surface                                       | Observed behavior                                                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/rate-limit/src/token-bucket.ts`     | `clientIp` selects trimmed `x-real-ip`, otherwise the shared `unknown` key.                                                                           |
| `apps/site/lib/ask-ai/handler.ts`             | `clientIp` selects trimmed `x-real-ip`, then XFF's first comma-separated hop, then empty string; passed to Turnstile.                                 |
| `apps/site/lib/tenant-evidence-rate-limit.ts` | Charges the tenant-proof bucket with the supplied account ID and also charges a global ceiling.                                                       |
| `apps/site/lib/ask-ai/escalate-throttle.ts`   | Deduplicates by normalized-question SHA-256 and applies a global per-minute cap.                                                                      |
| `apps/site/lib/demos-proxy.ts`                | Denies XFF and other forwarding headers, strips every `cf-*` header, and copies other allowed incoming headers; `x-real-ip` is not a denylist member. |
| `apps/site/app/api/waitlist/route.ts`         | Sends the first XFF hop as Turnstile `remoteip` when present.                                                                                         |

These are distinct identity/forwarding contracts; they were inspected without changes.

### Bounded real-edge probe

Installed Railway CLI: `5.49.1`; its `logs --help` supports HTTP logs filtered by request ID. Read-only status identified the configured project as `caisson-prod`, with the six Caisson services and Postgres. Credential/binding checks printed SET/UNSET only; no credential-store file was read.

Before execution, predicted Cloudflare trace HTTP 200, one unsigned license `/issue` request HTTP 401, and exactly one correlated Railway HTTP log row. The final prediction also stated that the brief's hypothesis would put a different, Worker-egress IP in that row.

| Observation                | Measured result                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trace                      | `GET https://caisson.sh/cdn-cgi/trace`, HTTP 200 at `2026-09-10T19:41:54.801212+00:00`                                                                                                                                                            |
| Public ingress IP          | `2600:1702:7e60:3c0::31`; Cloudflare colo ATL, warp off                                                                                                                                                                                           |
| Limiter-bearing probe      | One unsigned `POST https://license.caisson.sh/issue`, body `{}`, HTTP 401 with `{"error":"unauthorized"}` at `2026-09-10T19:41:58.639313+00:00`                                                                                                   |
| Probe User-Agent           | `s8-client-ip-4a8bd9c5-1ae4-4326-974c-c937cf6ef57d`                                                                                                                                                                                               |
| Railway request ID         | `cpbMpVZTQF-EqIubLPU1MQ`                                                                                                                                                                                                                          |
| Worker response request ID | `5316a55a-afa1-4159-88d3-3035c7883a6d`                                                                                                                                                                                                            |
| HTTP log lookup            | `railway logs --http --json --project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENVIRONMENT_ID" --service caisson-license --request-id cpbMpVZTQF-EqIubLPU1MQ --since 10m --lines 1`, invoked with argument arrays under `snip proxy bash -c` |
| Correlation                | Exactly one row; same request ID, probe User-Agent, `/issue`, POST, host `license.caisson.sh`, HTTP 401                                                                                                                                           |
| Log timestamp              | `2026-09-10T19:41:58.596768453Z`                                                                                                                                                                                                                  |
| Railway `srcIp`            | `2600:1702:7e60:3c0::31` — **equal to public ingress IP**, not a different Worker-egress IP                                                                                                                                                       |
| Deployment                 | `ea0bb9c8-aa36-425e-804a-cf08d9dd4928`, instance `aaa19987-22f2-49b6-a8d5-25bf08507169`, region `us-west2`                                                                                                                                        |

### New stop: source-IP prediction contradicted

All three probe commands returned exit 0 and the predicted HTTP statuses/count. The final source-IP prediction was contradicted: Railway recorded the original ingress IP. Under the unchanged stop rule, execution stopped immediately after this readback.

This is evidence against the hypothesized substitution for this request. It is **not** a measurement of the application's `x-real-ip`, `cf-connecting-ip`, or resolved limiter key: the HTTP log schema exposes proxy `srcIp`, not those application values. Neither bucket collapse nor correct isolation across distinct clients is established. Do not change the helpers or mark task 1 complete on this evidence alone.

No limiter fix, mutation test, release step, schedule edit, branch fold/deletion, publish, or deploy followed. Only the run notes and receipt were updated for the new hold; no post-stop commit or `sot` run was performed.

## Direct-key ruling — preparation completed, live observation pending

The operator accepted the source-IP refutation and instructed direct application-key measurement, with a prediction written first and no-defect accepted when demonstrated. The outstanding receipt updates were committed as `8950afe3` (`docs(state): record S8 live proxy IP refutation`); immediate readback was clean, two commits ahead of origin/main.

Fresh source tracing identifies the actual map key as `${bucket}|${ip}` in `TokenBucketLimiter.check` / `#charge`. The license call supplies bucket `issue` and the shared `clientIp(req)`. Ask AI passes its selected `ip` to Turnstile; the four named siblings have the distinct contracts already listed above. The reviewed request-span wrapper records method, route and status, not this private map key.

Prediction recorded before any direct application measurement: `outputs/audit/s8-direct-key-prediction.md`. For the previously measured client A, predict `issue|2600:1702:7e60:3c0::31` and Ask AI IP `2600:1702:7e60:3c0::31`; forged IP headers should not alter either. Client B must have its own ingress value measured and exact key predicted before its application probe.

A temporary diagnostic patch is proposed under the handoff directory as `S8-DIRECT-KEY-PROBE.patch`, SHA-256 `b96599aaf464f43b1fa177410a579d0569c3496661f5cf3b9c814130d97d0766`. It observes the exact key variable used by the real charge and the actual Ask AI IP argument. Four one-use markers and a ten-minute per-process window constrain output. Header precedence and limiter decisions remain unchanged. It adds a temporary optional observer callback to the shared method; that design remains proposed, not operator-locked or applied to product source.

Local proposal checks: patch applicability exit 0; Bun 1.3.14 verification **3 pass, 0 fail, 19 expectations**, covering decision parity, a throwing observation sink, and TypeScript parsing. These do not substitute for integration tests, code/security review, CI or a live measurement.

Decision packet: `/home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-DIRECT-KEY-OBSERVATION.md`. The packet distinguishes approval of the diagnostic approach from the later per-PR merge and operator deployment acts. No diagnostic PR, merge, runtime instrumentation or deployment has occurred. Task 1 remains open; neither a defect nor no-defect verdict is claimed.

## R352 step 3 structured readback prediction

The unfiltered installed CLI status exited 0 with patch/minor releases and no majors. Its installed status implementation supports --output and serializes the same releasePlan without version consumption. Predict a second read-only status with --output yields the same package set and exact oldVersion/newVersion fields; this is structured evidence collection, not a retry of a failed gate.
