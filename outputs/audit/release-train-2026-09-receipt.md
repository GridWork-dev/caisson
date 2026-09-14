# S8 release train receipt — R332 rescan PR 482 held on base CVEs

## S8_PUBLISH_RED and R333 — authorized repair in progress

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
