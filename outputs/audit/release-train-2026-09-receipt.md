# S8 release train receipt — R356 retry 3 review blockers

## R371 CR-08 executed; WR-01 next

CR-07 committed a81c537a. Commerce now fails closed on membership resolution errors,
with dashboard fallback preserved (ADR-0426). Bun 1.4.2 production-binding fixture:
8 pass / 0 fail / 23 assertions; restored affected suite 25 pass / 0 fail / 78 assertions
with the accepted pre-existing exit 99. Three mutation arms restored byte-identically;
site typecheck/lint pass. WR-01 and the full gate plus both reviews remain open.

## R370/R371 repair cycle authorized

S8_REPAIRS_2 supersedes the hold below for three ordered repairs and re-review.
CR-07 is implemented under ADR-0425 with real Git lifecycle proof and three mutation
arms; Bun 1.4.2 restored tests: 32 pass / 0 fail / 70 assertions. CR-08 and WR-01
remain, followed by the bounded full gate and code/security reviews. No PR, push or
release-readiness pass is claimed. Exact evidence is in RUN-NOTES.

## Current hold — R359 renewed review BLOCKED

The authorized gate retry is green. Renewed code review of
`c6156d8ce916ced54fba3309b6999c9a7a73167a` returned **FAIL / BLOCKED** at
2026-09-16T03:48:24Z: 46 reviewed files, two blockers and one warning.

- **CR-07: The exact-SHA audit contract is self-referential and cannot produce a green release**
- **CR-08: Checkout silently falls back from the selected organization to the personal account**
- **WR-01: Denied or abandoned approvals permanently exhaust the default approval store**

Titles are verbatim. Complete findings and remedy choices:
[s8-r359-REVIEW.md](s8-r359-REVIEW.md). Original CR-01/02/04/05 are closed within
reviewed scope; CR-03/06 remain unresolved. Full cumulative coverage is not claimed.
Raw report/log hashes and exact gate results are in RUN-NOTES.

Security **NOT DISPATCHED**, no security verdict and no implicit pass. R359 stops
before further candidate gates or PR. No repair or architecture fork was selected.
**S8_RELEASE_HELD**; packet:
`/home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-R359-REVIEW-BLOCKERS.md`.
No push, release PR, merge, version dispatch, tag, publish, deployment, live probe
or branch deletion. Await operator disposition of the verbatim findings.

## Current disposition — R359 bounded full gate GREEN; reviews pending

`S8_GATE_RETRY` (2026-09-16T03:30:26Z) supersedes the exit-137 hold below. Ai-kit
alone passed: **Bun 1.4.2 — 170 pass / 0 fail / 602 assertions**, exit 0. The full
root-check equivalent with Turbo `--concurrency=2` then completed **exit 0, 199/199
tasks, 191 cached**. All tail gates ran: deploy lint/typecheck, deploy tests
(**Bun 1.4.2 — 64 pass / 0 fail / 329 assertions**), and standards (67 checked,
5 scaffold-skipped). Captured complete-suite totals including cache replays:
**Bun 1.4.2 — 7,019 pass / 0 fail / 28,115 assertions**. No task needed a further
kill recovery. Exact command and evidence links are in RUN-NOTES.

Fresh headroom 37% used; renewed code review admitted and running. No fresh passing
review or security verdict is claimed. No release PR, push, merge, version dispatch,
tag, publish, live probe, deployment or branch deletion. Next: the two sequential
review verdicts, then packet steps 4–6 only if both permit proceeding.

## Current hold — R359 full gate exit 137 (2026-09-16)

The exit-99 hold below was explicitly dispositioned by `S8_CR03_CONTINUE` at 03:12:07Z.
CR-03 committed as `f28817fe`, CR-04 as `7ee9b86d`; all six repairs and both ADRs are
committed. Combined targeted verification: **Bun 1.4.2 — 125 pass / 0 fail / 457 assertions**,
with the accepted pre-existing exit 99.

The full `bun run check` ran once against `7ee9b86d` and failed: **Bun 1.4.2, exit 137**,
**193 / 199 Turbo tasks successful**, failed task **`@caisson/ai-kit#test`**. This failure
is outside repair scope and distinct from the accepted exit 99. R359 requires stopping.
The root cause is unestablished; no retry or override was performed.

Logs and exact counts: [RUN-NOTES](release-train-2026-09-RUN-NOTES.md),
[full gate](s8-r359-full-check.log), [targeted suite](s8-r359-targeted.log),
[accepted pre-repair exit-99 evidence](s8-r359-baseline-exit99.json).
Neither renewed review was dispatched; no passing review or release-readiness claim.
**S8_RELEASE_HELD**, no release PR. No push, merge, tag, version/publish/deploy dispatch,
live probe or branch deletion. Full-gate disposition precedes the remaining reviews and PR.

## Current hold — R359 baseline exit 99 (2026-09-16)

R359 repairs CR-06, CR-05, CR-02 and CR-01 committed in order at `a415ee21`, `c233a951`,
`46169496`, `e08b4b36`. CR-03 remains uncommitted, including draft ADR-0424; CR-04 is
unstarted. The targeted CR-03 command reported **Bun 1.4.2 — 24 pass / 0 fail / 75 assertions**
but exited **99**. The unchanged auth-account test reproduced exit **99** against pre-CR-03
ownership source: **Bun 1.4.2 — 4 pass / 0 fail / 9 assertions**. Source restored by SHA-256.
R359's red-gate-outside-causal-path stop applies. No passing gate claim is made from the
assertion totals. Root cause is unresolved; no bypass was attempted.

Evidence and recovery paths are in RUN-NOTES under “R359 HOLD”; exact machine evidence is
`/home/gw/lab/briefs/estate-2026-09/handoff/S8-R359-CR03-baseline-exit99.json`.
The full check and renewed code/security reviews have not run. There is no release PR.
No merge, tag, publish, deploy, version dispatch or branch deletion was performed.

## Current disposition — S8_RELEASE_HELD on six review blockers

S8_REVIEW_RETRY_3 superseded the parent request-size hold: that rejection was an own-tool error, not a floor denial. Fresh audited limits showed **23.0% used**, reading **2026-09-16T02:04Z**. Governed code-review thread **01a0a7f5-e432-7dc3-8421-31c31a36f252** completed without interruption and streamed directly to disk; the expected telemetry 500 remained non-blocking. Exit 0 means the report was delivered.

Reviewer verdict, verbatim: **FAIL — six blocking correctness, security, money-path, and release-integrity defects remain.** Reported scope: **69 reviewed files**, **89 commits / 430 paths**, v2026.08.18..895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c. CR-01 approval integrity, CR-02 DNS-based embedding egress, CR-03 duplicate-purchase risk from a missing session hint, CR-04 missing staging denial legs, CR-05 runtime-image gate omitted from readiness, CR-06 unvalidated R4 audit-file existence. These are reviewer findings; no live exploit reproduction or parent repair has occurred.

Full report: **s8-r356-retry3-REVIEW.md**. Exact raw log: **s8-r356-retry3-code-review.log**, 1,539,526 bytes, SHA-256 **a1dbc658153abd5b79406f3903b70e12fa53babfde014fbbac432d36772f7a43**. Verbatim unformatted report also preserved under handoff/S8-R356-RETRY3-REVIEW-VERBATIM.md. The report's claimed environment-file permission denial has no matching command event in that captured log and is not treated as a measured floor denial; its six blocker findings supply the stop.

Security **NOT DISPATCHED**, no auditor verdict or security transcript, per **s8-r356-retry3-SECURITY.md**. The latest ruling stops on a review blocker, so no repair, further candidate gate, push or PR followed. R4 remains incomplete. Last candidate SOT evidence is R352, not a new green result. No forge merge, version dispatch, tag, publish, deploy or branch deletion. Current packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-R356-REVIEW-BLOCKERS.md**. Earlier entries below are historical.

## R356 execution hold — parent evidence-save request rejected

The exact Git-rule briefs were committed as **6a099f94a6ae06796d2f49dc082b2c7ea368ade5**. Fresh audited limits showed **7d 21.0% used, resets 3d; reading 2026-09-16T01:54Z**. Governed code_review thread **01a0a7ec-7f65-78d1-909d-4f53d6c9adf0** was admitted. Direct git subcommands and bounded source reads worked; no new reviewer hook denial was observed. The anticipated admission telemetry HTTP 500 remained non-blocking under the operator ruling.

At approximately **2026-09-16T02:01Z**, the parent attempted to save its accumulated reviewer JSONL to handoff/S8-R356-CODE-REVIEW-PARTIAL.jsonl through the Node REPL. Automatic approval review rejected the request before the write, verbatim:

> JavaScript execution exceeds the 64000-byte strict auto-review limit

This was the parent's oversized evidence-save request, not reviewer admission, a product gate, or the corrected Git contract. Under the standing first-floor-denial stop, the parent did not retry, split or reroute that payload. It interrupted the running dispatch with Ctrl-C; the process returned **exit 130**. The review had read cumulative history and several priority surfaces, but returned **no substantive final verdict**. No unvalidated observation is promoted to a finding or pass. Security audit was **not dispatched**. R4 remains incomplete.

**S8_RELEASE_HELD.** No further review dispatch, repair, candidate verification, push or PR. No forge merge, version dispatch, tag, publish, deploy or branch deletion. Last SOT evidence remains the R352 run with the two accepted drift categories; it was not rerun after this stop. Only hold bookkeeping, owned temporary pack cleanup and a normal receipt commit follow. The rejected transcript save is not retried; historical tool output may be incomplete due to output truncation.

Resume packet: /home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-R356-EVIDENCE-SAVE-HOLD.md. Resume needs an explicit disposition of this parent request-size refusal and the interrupted review. The R356 Git-rule correction itself worked.

## R354 corrected-brief retry — permitted Git command denied

Both corrected in-worktree briefs were committed normally as **725c1865** and the entire code-review brief was supplied inline. Fresh audited limits: **7d 19.0% used, resets 3d; reading 2026-09-16T00:21Z**. Thread **01a0a797-3d3d-7db1-8c53-d4e4cd332388** started; the expected best-effort telemetry 500 was ignored under the ruling.

The first tool command permitted by the corrected brief was denied verbatim:

```text
Command blocked by PreToolUse hook: BLOCKED: repo-read delegated Codex children may run only bounded read commands. Command: git -C . status --short --branch
```

The reviewer stopped itself as instructed and returned **BLOCKED, 0 files reviewed**. Dispatch process exit 0 means it returned the report, not that review passed. Reviewer report: outputs/audit/s8-r354-retry-REVIEW.md; verbatim copy and structured evidence: handoff/S8-R354-RETRY-REVIEW-VERBATIM.md and S8-R354-RETRY-HOLD.json. No alternate command, retry or security dispatch followed. Four owned temporary worktree pack copies were removed after the reviewer exited; handoff originals remain.

**S8_RELEASE_HELD** under the explicit permitted-command-denial stop. R4 remains unsatisfied; SECURITY remains not dispatched. Current packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-R354-GIT-READ-HOLD.md**. No hook/sandbox change, product repair, further candidate gate, push, PR, forge merge, tag, version dispatch, publish, deploy or branch deletion. Last SOT evidence remains R352.

## R354 outcome — S8_RELEASE_HELD on review execution failures

Fresh audited quota: **7d 18.0% used, resets 4d; reading 2026-09-15T23:57Z**. The stale quota refusal is superseded by R354. **code_review was admitted**, thread **01a0a784-327d-7b11-ad3c-813aeab85e26** started. First unexpected line: `gw dispatch: admission receipt telemetry skipped: dispatch admission sink returned 500`. Security dispatch was withheld.

The admitted child then hit `BLOCKED: repo-read delegated Codex children may run only bounded read commands.` on sed-based skill/brief reads. The handoff brief also proved inaccessible inside its repo-read sandbox; placing it outside the workspace was this lane's preparation defect. No boundary was widened. Parent interrupted native child PID 988668 after observing the floor denial; dispatch exit 1 and both child/dispatcher gone. The child attempted alternate reads before interruption; the parent made no retry/replacement dispatch.

**No completed REVIEW; SECURITY never dispatched; R4 still unsatisfied.** The two outputs/audit/s8-r354-REVIEW.md and s8-r354-SECURITY.md are explicitly execution receipts, not verdicts. Exact evidence and the fresh limits line: handoff/S8-R354-DISPATCH-HOLD.json. Packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-R354-REVIEW-EXECUTION-HOLD.md**. Four owned temporary packs moved out of the worktree to the handoff after interruption. No product edits, further release gates, PR, push, forge merge, tag, version dispatch, publication, deployment or branch deletion. The last SOT evidence remains R352; no new SOT pass is claimed after this stop.

## R352 outcome — S8_RELEASE_HELD at cumulative review disposition

Preparation verification: repository format check passes on **3,503 files**; whitespace check passes. Readback confirms all **60** version rows match CLI old/new versions and all **nine** checklist boxes remain unchecked. A readback assertion initially assumed single-space Markdown cells; corrected once to parse formatter padding, then passed. Only eight owned documentation files are changed. Predict normal commit succeeds with those eight files and immediate status is clean; no push follows.

Runtime hold cleared: Bun **1.4.2** confirmed. Step 2 fresh five-item absence proof passes, with **64 tests / 168 assertions**, build and six-file lint. Step 3 installed @changesets/cli **2.31.1** full-backlog calculation passes: **35 changesets → 60 workspace bumps (57 patch, 3 minor; 20 explicit, 40 dependent)**. Exact versions: outputs/audit/s8-release-version-plan.md. No changesets consumed.

Step 4 release SPEC/PLAN and honest R4/checklist material are prepared. Cumulative scope is 88 commits and 425 paths before this documentation commit. Peer review/security dispatches were refused admission and never ran; no retry, one set of eyes, no review pass. The full cumulative R4 requirement remains unresolved. Precise reviewer targets and claims relying on this lane alone are in s8-release-review-preparation.md. Nine preflight boxes remain unchecked.

Fresh SOT exits 1 only for accepted branch preservation and the same sixteen freshness documents; every other check is GREEN. Current source dates are recorded in s8-sot-disposition.md, with no bulk update. This accepted lane disposition does not make final release readiness green.

**S8_RELEASE_HELD** before PR creation pending a release-scoped review disposition; no new failed gate or admission refusal is claimed. Concrete packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-RELEASE-REVIEW-DISPOSITION.md**. No push, PR, forge merge, version dispatch, tag, package publish, deployment or branch deletion.

## R350 step 2 — S8_RELEASE_HELD on runtime mismatch

The reconciled candidate is **a5d9cfea5136a2fd8a18ea73b574b5968ff765aa**; R350 supersedes the earlier local-merge authority hold. The first fresh three-suite command exited 0: **64 pass, 0 fail, 168 assertions**, but its banner reports **Bun 1.3.14 (0d9b296a)**. Current package.json pins **bun@1.4.2**. Read-only command resolution names **/home/gw/.bun/bin/bun**. This is an unexpected verification-runtime mismatch, not a failing test or evidence of a product defect. The successful result is limited to 1.3.14 and does not certify the pinned runtime. Execution stopped before the source/emitted-artifact absence checks, build, lint or Changesets status. No install, runtime replacement or test retry followed.

Packet: /home/gw/lab/briefs/estate-2026-09/handoff/**OPERATOR-ACT-S8-RELEASE-PUBLISH.md**, runtime-hold addendum. Resume requires disposition of the runtime mismatch; use an operator-established 1.4.2 executable, verify its version before the remaining checks, and repeat the targeted suite on that runtime. R4 review remains open: peer dispatches were refused admission and never ran, one set of eyes, no admission retry and no review pass. No PR, push, forge merge, version consumption, tag, publication, deployment or branch deletion. Fresh SOT was not run after the stop; cockpit reconciliation SOT is historical evidence only.

Receipt bookkeeping also encountered an absent guessed .husky/pre-commit path; no hook was changed or bypassed.

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

Governing brief: `/home/gw/lab/briefs/estate-2026-09/S8-caisson-release.md`, with the operator's subsequent rulings through R324/R325 and the S8_LICENSE_CLEAN handoff. Historical stops and their dispositions remain in [the run notes](release-train-2026-09-RUN-NOTES.md). This is the companion receipt to [the recorded prediction](s8-direct-key-prediction.md). The R314 verdict below supersedes earlier partial/inconclusive checkpoints, which remain historical evidence.

## R332 failed-gate stop

**STOP — first failed CI gate, no retry.** [PR #482](https://github.com/caisson-sh/caisson/pull/482) remains OPEN at **1f7cf0347b51ffd430ff53f1529445f03a0b060f**, base **6604844a3f17633e5221075af6d01966620eaaed**. In [run 34890012728](https://github.com/caisson-sh/caisson/actions/runs/34890012728), deterministic job **104130029716** passed offline tests, pinned scanner installation and the existing source scan, then failed the new anonymous base-image step at **2026-09-14T19:59:07Z**, exit **1**. Artifact upload succeeded. CI checked out the normal PR merge ref **82b294cd1473acf2693eb84e5de1a149fe3e9766**, recorded in its census; it is distinct from the PR head.

The real scan downloaded its vulnerability DB and examined **oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61**, linux/amd64, Debian 13.6, 80 OS packages. SARIF reports **55 package/CVE result rows: 3 CRITICAL, 52 HIGH, 20 unique CVEs across 19 packages**. These are scanner findings, not independently triaged exploitability claims. Twelve rows list a fixed version. Critical rows: **CVE-2026-13221, CVE-2026-42496, CVE-2026-8376**, all perl-base **5.40.1-6**, scanner-listed fix **5.40.1-6+deb13u1**. Python was not scanned because the driver stopped on the first failing image. No two-image clean result exists.

Evidence: [artifact 10366491930](https://github.com/caisson-sh/caisson/actions/runs/34890012728/artifacts/10366491930), seven files; downloaded under /home/gw/lab/briefs/estate-2026-09/handoff/S8-R332-SCAN-FAILURE/. base-1.sarif SHA-256 **c7161cc313233470db27554e0d6a6b79bf160714ff6f3ed983b034a74fb94fc6**. Summary with all 55 rows: S8-R332-SCAN-FAILURE-SUMMARY.json in the handoff directory. The first log command could not serve logs while semgrep-pro was still running; one corrected read used the completed-job log API, not a CI retry. Source scan and the other five required checks were SUCCESS; deterministic was FAILURE, semgrep-pro was still in progress at stop. No aggregate green claim.

The predicted real scan pass was refuted. Task 2 remains incomplete at a red PR; no code repair, digest change, scanner relaxation, CI rerun, merge, deployment, publication or branch deletion followed. Task 3 still waits for the cockpit's S8_PUBLISH_GREEN and remains held. Resume requires a ruling on these base-image findings; all scope limits and the peer-review refusal remain as recorded below.

## R332 scheduled rescan preparation

R332 (EST-ASK-290) locks main source plus exact Dockerfile-declared base digests. Census at **6604844a3f17633e5221075af6d01966620eaaed**: eight Dockerfiles, fourteen FROM lines, eleven external references, two unique images (Bun 1.4.2 and Python 3.14). Full census and path/line map are in S8-R332-RESCAN-CENSUS.json under the estate handoff directory.

Implemented on the lane as **011f77dc52926c3e6a4dba56eb794a50529ed1f2**. Task 3 remains blocked on S8_PUBLISH_GREEN, so R332's separate-PR path applies: fresh ci/scheduled-rescan-2026-09 off 6604844a carries only that six-file rescan change, cherry-picked as **1f7cf0347b51ffd430ff53f1529445f03a0b060f**. **S8_RESCAN_PR [482](https://github.com/caisson-sh/caisson/pull/482)** is forge-verified OPEN, non-draft, exact head/base and six paths confirmed. Lane branch remains local. Initial CI was queued/in progress; no green claim yet.

Daily cron is 37 6 * * * (06:37 UTC), added only to security-scan. Existing source scan is preserved; base scans derive the exact current pins, run anonymously against linux/amd64 with fresh Trivy config/cache, preserve failures and upload census/SARIF. **Published private images are not rescanned by this schedule**; app build layers, downstream images and other platforms are also outside scope. No registry credentials, publisher change or deployment.

Six offline tests, Ruff, YAML structure, formatting and whitespace passed. Both deliberate mutations failed as predicted, then restored tests passed. Independent croniter 6.0.0 enumerated 800 daily ticks through 2028-11-22 including leap day. First eligible trigger is the first 06:37 UTC after merge; September 15 only if merged beforehand, with GitHub delay/drop semantics. A scheduled execution has not yet occurred. See [verification](s8-scheduled-rescan-verification.md).

Peer code/security dispatches were refused admission and never ran; no retry or independent review pass. Own-judgment claims: FROM completeness/unsupported syntax, anonymous Trivy boundary, job reachability/failure handling and scope/platform limits. SOT returned only established dispositions: branch-hygiene EXPECTED-DRIFT because branches must stay, and the same sixteen lagging documents/source dates in s8-sot-disposition.md. No date bumps. Task 1 remains scoped NO DEFECT with diagnostic cleanup recorded. Task 3 and consumer package updates remain held.

## R325 license cleanup and publishing precondition (historical)

S8_LICENSE_CLEAN received from the cockpit on 2026-09-14: Railway deployment **5994b95f-699a-4726-9e1e-d0d06cfd3e4b**, status **SUCCESS**, created at **2026-09-14T19:39:04.980Z**, source **0b2046e722750a732ad23aa6f9d9ff230fbd2d5d** (diagnostic removal). The cockpit read license.caisson.sh/health at **19:41:29Z**: HTTP **200**, x-caisson-revision **0b2046e7…**. This closes the license runtime cleanup on operator-supplied evidence; this lane did not deploy or independently probe license.

The helper appended one row to docs/deploy/receipts/caisson-license.json: the same full source SHA, deployedAt **2026-09-14T19:39:03.033Z**, deployedBy **Liam (GridWork)**. That timestamp is the helper receipt time, distinct from Railway creation and the later health read. Existing receipt rows remain intact; this row is committed with these audit updates.

Fresh audited forge readback confirms [PR #480](https://github.com/caisson-sh/caisson/pull/480) MERGED at **2026-09-14T19:14:58Z** as **a0b548456a58d4562f6999b1aa95fe3ccd402f33**. Its [main-push publish-image run 34885734523](https://github.com/caisson-sh/caisson/actions/runs/34885734523) completed SUCCESS, with select SUCCESS but publish and collect **SKIPPED** by the path gate. The cockpit reports completion at 19:16:51Z. Branch red/green evidence remains valid; this main run does not prove an executed publish.

Forge also confirms [PR #481](https://github.com/caisson-sh/caisson/pull/481) MERGED at **2026-09-14T19:38:18Z** as **6604844a3f17633e5221075af6d01966620eaaed**. The cockpit identifies its fleet Bun 1.4.2 Dockerfile change as the first ensuing run with publish jobs executing and is watching it. **Task 3 waits for S8_PUBLISH_GREEN or S8_PUBLISH_RED with its run ID.** No success is inferred and this lane has not polled or dispatched that run.

Task 2 remains active, with the scanner target decision pending: schedule source plus digest-pinned base-image scans, or prepare rescanning of published private images. The earlier three-pin Dockerfile census predates #481 and must be refreshed before implementation. No scanner scope has been silently locked. Task 1 remains NO DEFECT in the measured scope, with source/artifact removal proven and license runtime cleanup now recorded. Peer code/security dispatches were refused admission and never ran; the existing single-author judgment limitations remain unchanged. No lane push, merge, deployment, publish, tag or branch deletion is authorized by this handoff.

Verification for this receipt: whole-tree formatting passed (3,483 files), whitespace check passed, and porcelain listed exactly the helper JSON and these two audit documents. SOT returned only the two previously dispositioned classes: branch-hygiene EXPECTED-DRIFT because the operator requires preservation, and the same 16 frontmatter-lag documents/source dates recorded in s8-sot-disposition.md. No dates were bumped and no aggregate SOT-green claim is made.

## R324 pipeline repair outcome (historical)

**S8_PUBLISH_PR [480](https://github.com/caisson-sh/caisson/pull/480)**, OPEN and ready, head **`18b00f54e15875f96448a320ccfde38eb1a49c8a`**, base removal `0b2046e722750a732ad23aa6f9d9ff230fbd2d5d`, forge merge state CLEAN. All six required checks plus publisher-equivalent gates and every other active check are SUCCESS; draft/path skips remain explicitly SKIPPED. Six-file pipeline scope only, no lane receipt history pushed.

The unchanged-script baseline `bf3af057e2d22e90b59f8dd4aead8aeca542adb1`, run 34879216994 / job 104093991797, produced actual gates **cancelled** (18:11:18–18:14:34Z). Thirty-seven memory samples: 8,131,576 KiB total, available minimum 51,404 KiB, full pressure avg10 reached 50.86 before exit 137. Fixed head run 34879963930 / job 104096517729 produced actual gates **success** (18:19:22–18:25:43Z). Seventy-six samples: 8,131,584 KiB total, available minimum 674,556 KiB, maximum full pressure avg10 21.22. Same ubicloud-standard-2 runner class, cold checkout and gate command; no publisher credentials or external publication.

Fix exports TURBO_CONCURRENCY=50%, matching required CI, preserving all ten gate commands. Successful cold run: 120/120 Turbo tasks, 67 test summaries totalling 7,268 reported tests (includes separately executed registry/deploy suites, not unique tests). Local command-contract mutation failed without export and passed with it; all five original/new gate tests passed, eight assertions, lint/shell/format green. The evidence supports intra-job memory pressure, not six suites sharing one VM; exact kernel shutdown mechanism remains unexposed.

Sep 10 first red differs: six gates succeeded; admin/demos/site failed later in Docker builds, with admin/demos Bun segmentation faults at Next Running TypeScript. Main contains demos/site build-stage repair #478; admin build stage remains Bun 1.3.14. This PR proves the gates fix; first complete green publish-image run on main remains the release precondition. No merge, publish, tag or consumer rollout here. Peer dispatches were refused admission and never ran; one set of eyes, no implicit review pass. Attribution to pressure, CPU-relative cap suitability, gate/environment preservation, and the separate Docker residual are the claims resting on my judgment alone.

R325 license cleanup still awaits S8_LICENSE_CLEAN from cockpit; no action here. Rescan scope question is pending: current security-scan only examines source/lockfiles, not images. Read-only census found eight production Dockerfiles and three unique digest pins; no schedule edit made and no scheduled publish added. Operator packet: `/home/gw/lab/briefs/estate-2026-09/handoff/OPERATOR-ACT-S8-R324-PUBLISH-GATES.md`.

## R324/R325 earlier disposition

R324 authorizes completing the existing reconciliation and repairing the pre-existing image-publish gate failures in a separate PR; release publication waits for the first green publish-image run on main. Scanner scheduling proceeds on the lane. The [five-item removal verification](s8-removal-verification.md) records exact source/changeset/test equality to removal main, original contract in emitted JavaScript/declarations, hashes, 64 passing tests / 168 assertions, lint and six required removal-SHA checks. Full future lane CI and final cut binding remain required. No package publish, tag or consumer rollout.

R325 assigns license cleanup to the cockpit after fleet deployment passes; await S8_LICENSE_CLEAN and record its deployment ID. No deploy action here. The historical hold below is disposed, preserving its failed-check evidence.

## R315 post-merge hold (historical; disposed by R324)

Removal PR #479 is forge-verified MERGED as **`0b2046e722750a732ad23aa6f9d9ff230fbd2d5d`** at 2026-09-14T17:50:51Z. All six required checks passed on both the PR and the merge SHA. The merge-SHA readback also returned four failed checks: **publish (caisson-site), publish (caisson-migrate), publish (caisson-license), publish (caisson-admin)**. Stopped immediately; no retry or root-cause claim. Docs/demos image publishing, semgrep-pro and deploy were in progress at that readback. Failed image-publish checks do not establish Railway deployment failure.

The reconciled lane remains an uncommitted merge at HEAD `35f565d6`, preserving all 22 existing local commits. Its six affected TypeScript files and changesets match removal main exactly; removal main's three production paths match pre-diagnostic e2116849. Candidate tests passed 64/64 with 168 assertions; limiter build exited 0. Emitted JavaScript/declaration inspection and the full five-item removal proof remain open. This receipt update is intentionally uncommitted with the pending merge; no release-ready claim or release PR exists. The detailed stop and resume state are in `OPERATOR-ACT-S8-R315-MERGE-CHECK-STOP.md` under the estate handoff directory.

**Open runtime cleanup:** operator handoff says main-push redeploys admin, demos, site, docs and support-bot; completion and serving revisions are unverified here. License remains on diagnostic deployment `c8e48687-3966-4b62-a4f7-6eda00628ab4`, pending separately ruled helper deployment of removal source. No deployment was performed by this lane. Peer review dispatches were refused admission and never ran; no implicit review pass. No scanner change, lane push, release PR, package publish, tag or consumer rollout followed this stop.

## R314 final task 1 observation verdict

Historical R315 pre-merge checkpoint (superseded by the post-merge hold above): PR **[479](https://github.com/caisson-sh/caisson/pull/479)** is OPEN at **`f92f2142cc5f47d3983ae55042fe0833101f9f34`**, based on `a386502af2f037d59078d5382ae617fc027f1a1a`. Its authorized scope is the exact seven-file inverse of diagnostic squash `7e54ddc5b05a4ee922468790efec2654666840da` plus `.changeset/s8-remove-direct-key-observation.md` with empty frontmatter and a one-line body naming that squash. Eight paths total, no package bumps. The old diagnostic changeset remains deleted. Local removal evidence: 64 passing tests / 168 assertions, changed-file lint, whitespace and formatting; Changesets status passes after the new empty file was staged. Normal commit/push; no bypass. Independent reviewers did not run. CI was queued/in progress at initial forge readback, and merge/post-merge source-and-emitted-artifact absence checks remain pending. The cockpit owns the merge on green; this lane reports the PR and idles under R315. The lane branch itself is not pushed.

**NO DEFECT in the measured client-IP keying scope.** At source **`a386502af2f037d59078d5382ae617fc027f1a1a`**, the eight application-reaching arms matched the recorded response and direct application-value predictions. License charged distinct A/B keys and retained each client's key when supplied forged X-Real-IP and XFF; Ask AI selected distinct A/B IPs and retained them under the same two-header test. No header-precedence fix or bug-fix changeset is warranted by these results. This closes task 1's measurement as a scoped no-defect outcome, not a general security certification or release-readiness pass.

The nine probe POST attempts comprise **eight accepted observation arms plus one separately recorded edge-refused three-header attempt**. R313 identified that original 403/code 1000 as Cloudflare rejecting client-supplied CF-Connecting-IP before the app. Its failure was retained, not counted as a successful forged-arm observation. The corrected forged arms use only X-Real-IP `203.0.113.91` and XFF `198.51.100.92, 198.51.100.93`. A is the recorded IPv6 ingress `2600:1702:7e60:3c0::31`; B is IPv4 `45.17.0.122` from the same physical host. The conclusion is limited to these clients, routes, source and supplied headers.

All three deployments were performed by the cockpit and supplied as SUCCESS handoffs; this lane performed no deployment:

| Label | Service         | Full Railway deployment ID             | Created at UTC           | Helper receipt timestamp UTC |
| ----- | --------------- | -------------------------------------- | ------------------------ | ---------------------------- |
| L1    | caisson-license | `4841e05e-cd49-4ed9-94b2-1ab19f2172b1` | 2026-09-14T14:26:13.370Z | 2026-09-14T14:26:12.234Z     |
| S1    | caisson-site    | `ea5b5b31-2e5d-4cc6-9de1-d7e67c0caef0` | 2026-09-14T14:41:44.663Z | 2026-09-14T14:41:43.532Z     |
| L2    | caisson-license | `c8e48687-3966-4b62-a4f7-6eda00628ab4` | 2026-09-14T14:48:25.714Z | 2026-09-14T14:48:24.633Z     |

Every deployment and every measured application response is bound to the same full source SHA above. L2 was the cockpit's R314-authorized same-SHA helper invocation with `--force`; its appended receipt records `forced: true`. This is not a git force operation or an unruled retry by this lane. Helper receipt timestamps precede deployment creation and must not be relabeled app-start or SUCCESS times. The two license receipt rows and the site row are preserved on the lane branch, authored by `Liam (GridWork)`.

### Eight application observations

Each cell's observed value exactly matches its pre-recorded prediction. License responses are HTTP 401/`unauthorized`; site responses are application HTTP 403/`challenge_failed`. Each response carries `x-caisson-revision: a386502af2f037d59078d5382ae617fc027f1a1a`. Table order groups the comparison arms; R314's actual send order on L2 was B-normal, A-forged, B-forged.

| Service / arm    | Deployment | Exact User-Agent marker                | Response Date UTC   | Direct-log timestamp UTC       | Predicted = observed value      |
| ---------------- | ---------- | -------------------------------------- | ------------------- | ------------------------------ | ------------------------------- |
| License A normal | L1         | `92c71b83-737c-493b-b87d-e3c470e0075a` | 2026-09-14 14:29:29 | 2026-09-14T14:29:37.597843253Z | `issue\|2600:1702:7e60:3c0::31` |
| License A forged | L2         | `4747a030-572b-4e80-b82f-693c074525d3` | 2026-09-14 14:51:10 | 2026-09-14T14:51:10.545472008Z | `issue\|2600:1702:7e60:3c0::31` |
| License B normal | L2         | `ececae63-b992-4c4f-96fe-ee080b7de94d` | 2026-09-14 14:51:01 | 2026-09-14T14:51:04.873051777Z | `issue\|45.17.0.122`            |
| License B forged | L2         | `d22df131-3dd4-4fd8-ac7b-c9397bb8f1da` | 2026-09-14 14:51:17 | 2026-09-14T14:51:17.877911804Z | `issue\|45.17.0.122`            |
| Site A normal    | S1         | `92c71b83-737c-493b-b87d-e3c470e0075a` | 2026-09-14 14:45:16 | 2026-09-14T14:45:16.540578783Z | `2600:1702:7e60:3c0::31`        |
| Site A forged    | S1         | `4747a030-572b-4e80-b82f-693c074525d3` | 2026-09-14 14:45:24 | 2026-09-14T14:45:24.629053885Z | `2600:1702:7e60:3c0::31`        |
| Site B normal    | S1         | `ececae63-b992-4c4f-96fe-ee080b7de94d` | 2026-09-14 14:45:33 | 2026-09-14T14:45:33.288666839Z | `45.17.0.122`                   |
| Site B forged    | S1         | `d22df131-3dd4-4fd8-ac7b-c9397bb8f1da` | 2026-09-14 14:45:42 | 2026-09-14T14:45:42.074566937Z | `45.17.0.122`                   |

L2 health at response Date 14:50:53Z was HTTP 200, exact revision, `ok: true`, index digest `8835d704a8c7`, 52 entries. The three L2 commands ran in the ruled order and all exited 0. Their Railway request IDs were B-normal `jxoMGwYkS-2WzZ1B9I3ezw`, A-forged `s5eDAP68Sh-jnggD9fVATg`, B-forged `0ZxCVc66Qw-omOJd9I3ezw`. Application request IDs were respectively `bac42d97-27b0-4bf3-8388-5b14872fd346`, `d8523828-e779-491e-a82a-e5abe1031257`, `5c3fa2b9-33fd-4230-95a8-645814587809`; CF rays `a3b035172a4e3555-ATL`, `a3b0354d08c1b08e-ATL`, `a3b0357c3ee4cf6c-ATL`. The single bounded L2 license log read exited 0 and returned each of these three exact marker/key pairs once. Earlier sections below retain L1/S1 response IDs and health evidence.

### Correlation and verification limits

Source and request correlation is measured through exact response revision, markers, returned direct values and timestamps. Full deployment IDs come from the cockpit handoffs. **Instance IDs remain unavailable in the bounded CLI log rows**, which contain only level/message/timestamp; there is no measured instance-ID join. A-normal and A-forged license observations span L1/L2 at identical source; this is not a claim that both were sent to one process. A-forged and both B arms are associated with L2, and all site arms with S1, under the stated evidence limits.

All observation rows are within four minutes of their deployment creation timestamps (L2 last row 2m52.164s after creation), a conservative bound preceding the runtime app/module initialization. Source guards additionally emit only while their ten-minute deadline is live. No window extension or client-side marker refill was used; the second license deployment itself was explicitly ruled by R314. No concurrency, restart-resilience, multi-replica, broader-network or log-retention claim is added.

Peer code/security dispatches were refused admission and never ran: **one set of eyes, not two**, no peer-review pass. The author's sole-judgement claims remain the diagnostic callback's fidelity to the charged key, behavior preservation beyond covered tests, marker/expiry/logging limits, and the sufficiency of request/source correlation without instance IDs. The actual edge values now have the direct evidence above; this does not retroactively create independent scrutiny of the instrumentation.

### Still held after probes

Temporary instrumentation remains in the deployed/main source and must be removed before any release cut, with the removal receipt bound to the actual candidate and built artifacts. `OPERATOR-ACT-S8-DIAG-REMOVE.md` still targets diagnostic introduction `7e54ddc5b05a4ee922468790efec2654666840da`; a removal PR, merge and cleanup deployment require their own rulings. Later release/fold/rescan tasks are not completed or authorized by R314. No package consumer has moved off its pre-fix published line through this lane. No push, merge, tag, removal PR or release cut follows this receipt. Report S8_PROBES_DONE and idle.

## R313 historical site checkpoint: four response and direct-IP predictions matched

S8_SITE_LIVE supplied site deployment **`ea5b5b31-2e5d-4cc6-9de1-d7e67c0caef0`**, SUCCESS, created `2026-09-14T14:41:44.663Z`, source **`a386502af2f037d59078d5382ae617fc027f1a1a`**, helper completion about 14:44:10Z, cockpit send 14:44:38Z. The helper's appended site receipt is at `2026-09-14T14:41:43.532Z`, deployedBy `Liam (GridWork)`; that receipt timestamp is not process-start or SUCCESS time. Health at response Date 14:45:08Z returned HTTP 200, `ok: true`, and the exact expected revision.

All four requests were unsigned POST `/api/ask`, JSON `{"question":"S8 diagnostic observation"}`, without cookies or a challenge token. A used IPv6, B IPv4. The forged arms sent only X-Real-IP `203.0.113.91` and XFF `198.51.100.92, 198.51.100.93`, with no CF-Connecting-IP as ruled by R313. Every response returned the predicted application HTTP **403**, JSON `{"error":"challenge_failed"}`, and the exact source revision above. All commands exited 0; no retry or additional arm was sent.

| Arm / exact User-Agent marker                     | Response Date UTC   | Direct diagnostic timestamp UTC | Predicted and observed Ask AI IP | Railway request ID       |
| ------------------------------------------------- | ------------------- | ------------------------------- | -------------------------------- | ------------------------ |
| A normal — `92c71b83-737c-493b-b87d-e3c470e0075a` | 2026-09-14 14:45:16 | 2026-09-14T14:45:16.540578783Z  | `2600:1702:7e60:3c0::31`         | `YoQOB1UVQg2jxV6PYqVb7A` |
| A forged — `4747a030-572b-4e80-b82f-693c074525d3` | 2026-09-14 14:45:24 | 2026-09-14T14:45:24.629053885Z  | `2600:1702:7e60:3c0::31`         | `IC4gwYW1TzGQGZdELPU1MQ` |
| B normal — `ececae63-b992-4c4f-96fe-ee080b7de94d` | 2026-09-14 14:45:33 | 2026-09-14T14:45:33.288666839Z  | `45.17.0.122`                    | `r-_9oFQYRaeBNF-OLPU1MQ` |
| B forged — `d22df131-3dd4-4fd8-ac7b-c9397bb8f1da` | 2026-09-14 14:45:42 | 2026-09-14T14:45:42.074566937Z  | `45.17.0.122`                    | `pfGlghRdQlajvTA42h0iww` |

In that same order, application request IDs were `8ef3c35e-13c3-4fc4-8a97-b2fbee256ef7`, `31bdc4b6-adb6-4126-997c-acfce0166a28`, `32602158-b476-43bb-883c-ec139076deee`, `b200cab3-ad23-4cca-9380-27f4a9ec4b01`; CF rays were `a3b02ca54fa25dd0-ATL`, `a3b02cdbe8f8bfa5-ATL`, `a3b02d124c56c84c-ATL`, `a3b02d48bb195394-ATL`.

The single bounded read `railway logs --service caisson-site --json --since 10m --lines 100` exited 0 and returned exactly one `[s8-direct-ip]` row for each marker, carrying the IP and timestamp in the table. This is the actual IP selected by the application and passed to Turnstile, not a reconstructed value or proxy source-IP log. Each A value matches its recorded IPv6 ingress; each B value matches its recorded IPv4 ingress. Normal and forged match within each client; A and B differ. B is still a distinct IP-family connection from the same physical host, not a second-device claim.

The last direct row occurred 3m57.412s after deployment creation, inside a conservative ten-minute bound from that earlier timestamp. Source expiry is still ten minutes after module load; no deadline change, restart or marker re-arming was performed by this lane. **Instance-level correlation remains unavailable:** the CLI rows expose only level, message and timestamp, with no instance/deployment IDs. Deployment ID is supplied by the cockpit; the four response revisions, markers and timestamps supply the measured source/request correlation. Do not describe this as a measured instance-ID join.

**Site-only outcome:** all four corrected-arm response/IP predictions matched; observed per-client Ask AI IP resolution resisted the two supplied forged headers in this run. This is not a license bucket-isolation verdict or a full task-1 no-defect verdict. License still has only A-normal's direct observation; its remaining arms await a further ruling, and the original three-header edge refusal remains a separate finding below. Peer reviewers never ran. Preserve the site helper receipt and these records on the local lane, report S8_SITE_ARMS_DONE, and idle. No further license request, deployment, removal PR, release, push, merge or tag is performed.

## R312 measured stop: A-forged returned 403 instead of 401

R313 disposition (EST-ASK-272): the operator identifies the 403/code 1000 as Cloudflare rejecting a client-supplied CF-Connecting-IP header before the application; A-forged's marker remains unconsumed per that ruling. **Separate finding: the three-header forged arm is rejected at the edge, so it cannot measure application header selection.** The measured response and missing marker below support the recorded stop; attribution of the exact header/cause is the operator's ruling, not a new probe by this lane. Future forged arms omit CF-Connecting-IP and retain only X-Real-IP and XFF. License's window closed at 14:36:13Z; remaining license arms are held for a separate second-deployment ruling. Site proceeds only after its new S8_SITE_LIVE signal, using the prospectively corrected prediction and four prepared requests. No additional request has run at this preparation checkpoint.

**STOPPED; two license requests sent, two license arms and all four site arms unrun. No complete eight-request verdict.** S8_LICENSE_LIVE supplied license deployment `4841e05e-cd49-4ed9-94b2-1ab19f2172b1`, SUCCESS, created `2026-09-14T14:26:13.370Z`, ref **`a386502af2f037d59078d5382ae617fc027f1a1a`**. The cockpit sent at 14:28:51Z and directed this lane to obtain the unavailable instance ID from log rows. The helper appended the same SHA to `docs/deploy/receipts/caisson-license.json` at `2026-09-14T14:26:12.234Z`, deployedBy `Liam (GridWork)`. That timestamp precedes deployment creation and is not an app-start/SUCCESS timestamp.

License health at response Date `2026-09-14T14:29:21Z`: HTTP 200, exact `x-caisson-revision` above, `ok: true`, index digest `8835d704a8c7`, 52 entries. Before requests, the prediction was restated: all unsigned arms HTTP 401; A key `issue|2600:1702:7e60:3c0::31`, B key `issue|45.17.0.122`, unchanged by forged IP headers. The September 14 preflight had freshly confirmed both ingress addresses before any application probe.

| Arm                    | Marker                                 | Response Date UTC   | Predicted response | Measured response / evidence                                                                                                                                                     |
| ---------------------- | -------------------------------------- | ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License A normal, IPv6 | `92c71b83-737c-493b-b87d-e3c470e0075a` | 2026-09-14 14:29:29 | 401                | 401, `unauthorized`; exact serving revision; Railway request `fOrScSP2RJKFd21Wjq4OvQ`, application request `24f5ecf8-9cd0-4b1f-8a7f-c9c41e8ed22d`, CF ray `a3b0158d18aa7515-ATL` |
| License A forged, IPv6 | `4747a030-572b-4e80-b82f-693c074525d3` | 2026-09-14 14:29:38 | 401                | **403**, text `error code: 1000`, server Cloudflare, CF ray `a3b015c098a40779-ATL`; no revision, Railway request ID or application request ID in this response                   |
| License B normal, IPv4 | `ececae63-b992-4c4f-96fe-ee080b7de94d` | —                   | 401                | NOT SENT after stop                                                                                                                                                              |
| License B forged, IPv4 | `d22df131-3dd4-4fd8-ac7b-c9397bb8f1da` | —                   | 401                | NOT SENT after stop                                                                                                                                                              |
| Site A normal          | `92c71b83-737c-493b-b87d-e3c470e0075a` | —                   | 403                | NOT SENT; no new site handoff                                                                                                                                                    |
| Site A forged          | `4747a030-572b-4e80-b82f-693c074525d3` | —                   | 403                | NOT SENT                                                                                                                                                                         |
| Site B normal          | `ececae63-b992-4c4f-96fe-ee080b7de94d` | —                   | 403                | NOT SENT                                                                                                                                                                         |
| Site B forged          | `d22df131-3dd4-4fd8-ac7b-c9397bb8f1da` | —                   | 403                | NOT SENT                                                                                                                                                                         |

Both sent requests were unsigned POST `/issue` with body `{}` and Content-Type application/json. The forged arm supplied exactly X-Real-IP `203.0.113.91`, XFF `198.51.100.92, 198.51.100.93`, and CF-Connecting-IP `203.0.113.94`. The first unexpected measured response stopped the request sequence immediately; no retries or modified-header variants followed.

One bounded post-stop evidence read, `railway logs --service caisson-license --json --since 10m --lines 100`, exited 0. It returned this diagnostic line at `2026-09-14T14:29:37.597843253Z`:

```text
[s8-direct-key] {"probeId":"92c71b83-737c-493b-b87d-e3c470e0075a","key":"issue|2600:1702:7e60:3c0::31"}
```

No A-forged marker appears in that bounded result. The returned diagnostic row contains only level, message and timestamp, with **no instance ID or deployment ID**. The record associates the direct value with A-normal by its exact marker, time and response revision; deployment ID comes from the cockpit handoff. Instance-level correlation remains unresolved and must not be invented. The requests completed 3m16s and 3m25s after deployment creation, within a conservative ten-minute bound from that earlier timestamp; no window extension was used. The log timestamp is retained as returned and is not substituted for response time.

The normal A arm directly observed its predicted charged key. The forged response refutes the predicted 401 for that arm; it does not demonstrate limiter collapse, successful header spoofing, B isolation, or correct keying across all arms. No underlying reason for Cloudflare code 1000 was investigated in this stopped run. Task 1 remains **INCONCLUSIVE**. Peer review still never ran. The cockpit's license receipt row and this partial observation are preserved locally; no site deployment, additional application request, removal PR, release, push, merge or tag is performed by this lane. Handoff: `OPERATOR-ACT-S8-R312-LICENSE-FORGED-STOP.md`.

## R277 preparation and reconciliation

R277 locks the temporary observation approach and authorizes preparation of a diagnostic-only PR, holding at green with no merge or deployment. PR **[476](https://github.com/caisson-sh/caisson/pull/476)** is **OPEN, CI GREEN, HELD** at head **`aa71ff4e911250a5e9804e5b2c541a15d90a3c4c`**, base `e2116849082f57c1d5fdaf6b309086813f48e4f4`. Final CI readback at `2026-09-11T02:10:18Z` confirmed all six required checks succeeded and no check remained pending or failed.

The PR **re-applies the frozen patch over `e2116849`; it does not carry `38631ed4` as-is**. Frozen checksum was re-read as `b96599aaf464f43b1fa177410a579d0569c3496661f5cf3b9c814130d97d0766` (3,136 bytes). The three tests and empty no-release changeset were copied from `38631ed4`. After repository formatting, the shared limiter, all three tests and empty changeset match the earlier diagnostic bytes. License and Ask AI differ only in multiline layout of the same `JSON.stringify({ probeId, key/ip })` expressions. No header-selection or limiter-behavior change was added.

Reason for reapplication: the fresh branch `feature/s8-direct-key-observation`, in `/home/gw/lab/worktrees/caisson/s8-direct-key-observation-2026-09`, must exclude the eight release-train commits. GitHub readback confirms only seven files: three implementation files, three tests and the empty Changesets entry. The diagnostic SPEC/PLAN and reconciliation/history stay on the lane branch. `chore/release-train-2026-09` was not pushed.

Fresh-branch validation passed: frozen install; repository formatting and format check; changed-file lint; the same 67 tests / 194 assertions; Changesets status with no patch/minor/major bump; normal commit hooks. The required `check`, `standards-gate`, `registry-index`, `oscal-conformance`, `deterministic` and `support-bot` CI checks were predicted to pass before PR creation. All were queued at the first readback.

| Required check    | Final verdict | Actions run |
| ----------------- | ------------- | ----------- |
| check             | SUCCESS       | 34552930239 |
| standards-gate    | SUCCESS       | 34552930239 |
| registry-index    | SUCCESS       | 34552930239 |
| oscal-conformance | SUCCESS       | 34552930239 |
| deterministic     | SUCCESS       | 34552930178 |
| support-bot       | SUCCESS       | 34552930193 |

Ancillary SUCCESS: changes, knip, semgrep-pro, evidence-pack, zizmor, eval, anti-slop, site-e2e, Socket Security Project Report and Pull Request Alerts. SKIPPED: intel-eval, token-drift, native-ext and [code]smith. Those skips are recorded as skips, not passes. The Changesets command used was `bunx @changesets/cli status --since=origin/main` (installed CLI 2.31.1). No CI retry or gate bypass occurred. The existing SOT dispositions remain separate; this CI verdict is not an aggregate release-readiness verdict.

Peer review remains **not run, not a pass**. The earlier admission refusals remain measured at 98% projected versus 95%, recorded in `a6639f78`. A fresh audited quota read returned 93%; the recorded deep-route calculation (180,000 tokens / 2,000,000 basis) would project 102%, so R277's admission-conditional dispatches were not attempted. No new refusal, retry, override, quota wait or alternate-provider dispatch is claimed. The work still carries one set of eyes and the five limitations below.

**Client B recording:** ingress `45.17.0.122`, measured by IPv4 Cloudflare trace at `2026-09-11T01:56:49.956764+00:00`; exact predicted license key **`issue|45.17.0.122`**, Ask AI IP **`45.17.0.122`**, including forged-header arms. This was written to the prediction artifact before any application probe. B is a distinct IPv4 connection from the same physical host as A; no second-device claim is made. No license/Ask AI probe was sent.

R277 supersedes R272's restriction on PR preparation only. No merge, deployment, package publication, tag push or live application-key observation is authorized or performed. The production-keying assessment below remains inconclusive.

## R272 historical task 1 outcome

**INCONCLUSIVE for production keying.** The authorized source/local assessment is complete. No client-IP keying defect has been demonstrated, and correct live per-client isolation has not been established. This is neither a FIXED nor a NO-DEFECT verdict. No header-precedence fix or bug-fix changeset was made.

The source contract is clear: shared `TokenBucketLimiter.check` builds `${bucket}|${ip}`; `#charge` uses that key for its entries map. License `/issue` supplies bucket `issue` and the shared helper's trimmed X-Real-IP, falling back to `unknown`. Ask AI selects trimmed X-Real-IP, then the first trimmed XFF hop, then empty string; it passes that IP to Turnstile, not to an IP token bucket.

The named siblings have distinct contracts: tenant evidence charges `tenant-proof|<accountId>` plus a global ceiling; escalation deduplicates normalized-question SHA-256 plus a global count; demos is a header-forwarding seam; waitlist sends the first XFF hop to Turnstile. This census does not establish the live trustworthiness of any incoming header.

At `2026-09-10T19:41:58Z`, the earlier unsigned real-edge license request returned 401. Railway request `cpbMpVZTQF-EqIubLPU1MQ` matched the probe marker, method, path, host and status. Its proxy `srcIp` equaled the independently observed ingress IP, `2600:1702:7e60:3c0::31`, on deployment `ea0bb9c8-aa36-425e-804a-cf08d9dd4928`. That refuted the prediction of a different IP in that proxy log. It did **not** observe application X-Real-IP or the limiter key, and cannot decide the collapse hypothesis.

The [pre-measurement prediction](s8-direct-key-prediction.md) remains unchanged: for client A on the previously measured egress, license key `issue|2600:1702:7e60:3c0::31` and the same Ask AI IP, including forged-header arms. Client B's ingress and exact prediction remain unrecorded. Neither application's direct value has been measured.

## Evidence and absent peer scrutiny

Diagnostic commit: `38631ed48a035b717ee163e8564e057478f5e2d0`. [Local verification](s8-diagnostic-verification.md) recorded 67 passing tests, 194 assertions, changed-file lint, whole-tree formatting, and 46 successful build/typecheck tasks (41 cached, five executed). Normal commits passed hooks. A supported empty Changesets entry requests no version bump; it does not make the temporary diagnostic fit for publication.

**Peer code and security review dispatches were refused admission and never ran. This work carries one set of eyes rather than two. It is not peer-reviewed, and the missing review is not a pass.** Both attempts returned exit 2: gauge 89%, estimated 180,000 tokens, projected 98% against the 95% ceiling. The refusal remains recorded in `a6639f78`; the accompanying admission telemetry 404 remains recorded too. R272 authorizes this own-analysis assessment without retrying, overriding, substituting a dispatch, or waiting for quota reset. It does not create a REVIEW or SECURITY verdict.

### Claims resting on my judgement without independent confirmation

These are the specific claims the absent reviewers would have needed to challenge. Tests support the listed cases; selection and interpretation of those tests are also my work.

1. **The diagnostic observes the charged key, rather than a reconstruction.** In `packages/rate-limit/src/token-bucket.ts:87-91`, the same local `key` is passed to `#charge` and then the optional observer; `#charge` uses its parameter at the map operation. This source reasoning supports the proposed observation. The tests compare emitted keys and decisions; they do not independently intercept the private map access, and no deployed-source/log binding exists yet.
2. **Instrumentation preserves limiter, auth and challenge behavior.** The callback runs after charging and its synchronous exceptions are caught; Ask AI logging exceptions are caught before the existing Turnstile call. Local tests cover allow/deny/global results, unsigned 401, challenge 403 and throwing sinks. They do not prove all callers, concurrency, logging backpressure, asynchronous sink errors or production timing. The optional public method parameter and its effects on consumers would be a primary code-check target.
3. **Collection is narrow enough for this diagnostic.** The two application seams emit marker plus key/IP only, for four markers consumed once per app/module instance. The tests cover ordinary traffic silence, replay and expiry. The markers are public correlation labels, not authentication: another caller can consume a slot. Replicas and restarts each have their own set/window. The deadline uses `Date.now()`, so the elapsed-time bound assumes the wall clock does not move backward. No production test of those conditions or log access/retention has run; no claim of fleet-wide four-event collection is made.
4. **The real edge will preserve client identity and defeat forged IP headers.** This is my prediction, not a measured guarantee. Synthetic Requests only prove header precedence inside the application. Equal Cloudflare/Railway proxy IP observations do not prove what the app receives, that a second client gets a distinct bucket, or that forged headers are overwritten. These are the central unresolved task-1 claims.
5. **Future evidence would justify a no-defect conclusion and safe removal.** My proposed A/B plus forged-header protocol needs exact deployment/instance, marker, timestamp, ingress and actual application-value correlation. Duplicate, missing or consumed markers cannot count as success. A passing local suite or empty changeset cannot substitute for that evidence or prove the diagnostic is absent from a future release. Removal and verification against the actual release source remain necessary.

## R272 historical open items

- Direct application-key/IP measurement for independently identified clients A and B, including forged-header arms. Until authorized and measured, production collapse versus correct isolation remains unresolved.
- Any resulting keying fix and discriminating mutation test, only if a defect is demonstrated. No bug-fix mutation arm has run.
- Removal of temporary instrumentation before release; the committed diagnostic currently remains on this branch.
- Diagnostic PR preparation is authorized by R277 and recorded above. Merge, deployment, package publication, tag and live bucket-key measurement still require further authority; none was performed.
- R212 fold decisions, release gate/readiness/tarball derivation, R2 parity, mirror sync, Worker redeploy from tag and scheduled-rescan implementation/cadence proof. These later tasks have not been completed; no consumers moved off the pre-fix published line through this lane.

Branch deletion remains prohibited; all three named branches are preserved. The [SOT disposition](s8-sot-disposition.md) records branch hygiene as EXPECTED-DRIFT, relocated run notes, the corrected Changesets command and 16 stale documents with source dates unchanged. No aggregate release-readiness, peer-review or production-keying pass is claimed.
