# R324 image-publication gate diagnosis

## Measured history

| Run / source                                                                                    | Site job     | Runner label                 | Site gates                                                   | Test summaries                                                   |
| ----------------------------------------------------------------------------------------------- | ------------ | ---------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| [33642937584](https://github.com/caisson-sh/caisson/actions/runs/33642937584), 69b3ba35, Sep 2  | 100290530582 | blacksmith-4vcpu-ubuntu-2404 | SUCCESS, 14:35:40–14:38:02 UTC (142s)                        | 67 summaries, 7,264 reported tests                               |
| [34431098568](https://github.com/caisson-sh/caisson/actions/runs/34431098568), e2116849, Sep 10 | 102726671048 | blacksmith-4vcpu-ubuntu-2404 | SUCCESS, 02:52:46–02:54:49 UTC (123s)                        | 67 summaries, 7,265 reported tests                               |
| [34877205333](https://github.com/caisson-sh/caisson/actions/runs/34877205333), 0b2046e7, Sep 14 | 104087468701 | ubicloud-standard-2          | CANCELLED, 17:52:15–17:56:00 UTC (225s); overall job FAILURE | 40 completed summaries, 3,219 reported tests before interruption |

Counts are sums of the complete site-job logs' `Ran N tests` summaries, including separately executed registry/deploy suites; not unique-test cardinalities. Sep 2/10 whole-job pass-line counts are 7,258/7,259. Sep 14 has incomplete tasks, so its smaller number is not reduced coverage.

All six Sep 2 gate steps passed (142–173 seconds); all six Sep 10 gate steps also passed (120–145 seconds). Sep 10 admin/demos/site jobs failed later; site annotation names Docker buildx exit 137 in `bunx turbo run build --filter=@caisson/site --concurrency=50%`. This is distinct from Sep 14: six cancelled gate steps (175–328 seconds), each on a different runner name. Six matrix suites are duplicated work, but the GitHub job records do not place them in one shared-memory VM.

## Shutdown sequence and hypotheses

Sep 14 site log: 17:55:58.6342131Z runner reports receiving a shutdown signal; 17:55:59.7013783Z/7143004Z test scripts receive SIGTERM (Polite quit request); 17:55:59.7838Z onwards ui/tenancy-rls/org-controls tasks report exit 137; 17:56:00.2529222Z operation cancelled. The runner shutdown precedes child failures. Neither these logs nor annotations contain a kernel OOM counter or memory-pressure measurement. OOM is not yet a proven cause.

Source across green 69b3ba35 and removal 0b2046e7: deploy/gates.sh, root turbo.json and publish-image concurrency/runner expressions unchanged. The workflow diff only updates sbom-action. Runner selection changed externally through the cockpit-owned variable; no variable is changed by this repair. Matrix fail-fast:false and workflow cancel-in-progress:false rule out those configured sibling-cancellation mechanisms, not every possible external cancellation. Test-summary growth Sep 2→10 is one test, so no material test-growth explanation for the first red run.

The repo's successful required `check` job explicitly uses --concurrency=50%; deploy/gates.sh shells root scripts that omit a cap. Turbo 2.10 default is 10; `TURBO_CONCURRENCY` controls run/watch concurrency ([run reference](https://v2-10-8.turborepo.dev/docs/reference/run), [environment reference](https://turborepo.dev/docs/reference/system-environment-variables)). Candidate hypothesis: runner memory pressure under default intra-job fan-out. Exact baseline runs the unchanged script with /proc/meminfo, pressure and cgroup counters; no credentialed step, publish, Docker build or deploy.

## Prospective branch measurement

Draft PR #480 baseline `bf3af057e2d22e90b59f8dd4aead8aeca542adb1`, run 34879216994, job 104093991797. Predict gates CANCELLED or FAILURE at default concurrency. Do not apply a fix until that step conclusion is read. A successful baseline refutes the deterministic reproduction prediction and must stop for operator disposition, rather than being called a mutation pass.

If baseline is the predicted red, set the Turbo cap to 50% and preserve every gate command. Predict the same job gates SUCCESS. The before/after step conclusions, source heads and memory evidence are the mutation evidence; source-text unit tests alone cannot substitute. Independent reviews have not run; no reviewed or ready claim.

## Baseline result and bounded candidate

Baseline head bf3af057e2d22e90b59f8dd4aead8aeca542adb1, run 34879216994, job 104093991797: actual `gates` conclusion **cancelled**, started 18:11:18Z, completed 18:14:34Z (196s), overall job failure. This matches the prospective red. Thirty-seven memory samples: MemTotal 8,131,576 KiB; minimum MemAvailable **51,404 KiB** at 18:14:26Z (about 50 MiB); full memory-pressure avg10 **50.86** at 18:14:27Z, before exit 137 and cancellation. This reproduces failure in one isolated job with no publisher siblings. It supports intra-job memory exhaustion under default fan-out; the precise runner shutdown/OOM killer implementation is not exposed, so no kernel-oom-kill claim.

Candidate sets exported `TURBO_CONCURRENCY=50%` in deploy/gates.sh, retaining all ten original command invocations and their fail-fast behavior. This matches required CI's cap without editing runner variables or the shared publication workflow. The shell-control test ran red against the original script (inherited 99 vs required 50% for all ten calls), then green after export: two tests, four assertions; lint and shell syntax passed. An initial test-stub interpolation syntax error was corrected once before the meaningful red; it is not mutation evidence.

Prediction before fixed-branch push: same PR-only gates step **success**, lower memory pressure, every original suite completes; no remote cache restored, no publish credentials, image push or deploy. Required CI remains for the ready PR after the branch measurement.

Existing deploy/gates.test.ts was discovered during status review and restored byte-for-byte before commit; new coverage lives in deploy/gates-concurrency.test.ts. Combined existing/new suites pass **5 tests, 8 assertions**, preserving preparation-hook, command-order and fail-fast coverage. This corrects an own-file-placement mistake, not a removed-test exception.
