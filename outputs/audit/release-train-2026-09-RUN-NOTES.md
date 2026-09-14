# S8 release train run notes — 2026-09-10

Current location: `outputs/audit/release-train-2026-09-RUN-NOTES.md`, relocated from the repository root by the operator's SOT ruling. Earlier root-path diagnostics below describe historical runs.

## Compact continuation checkpoint — operator SOT ruling

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
