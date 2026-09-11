# S8 release train receipt — R277 diagnostic PR, 2026-09-10

Governing brief: `/home/gw/lab/briefs/estate-2026-09/S8-caisson-release.md`, with the operator's subsequent corrections, R272 and R277. Historical stops and their dispositions remain in [the run notes](release-train-2026-09-RUN-NOTES.md).

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

## Task 1 outcome

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

## What remains open

- Direct application-key/IP measurement for independently identified clients A and B, including forged-header arms. Until authorized and measured, production collapse versus correct isolation remains unresolved.
- Any resulting keying fix and discriminating mutation test, only if a defect is demonstrated. No bug-fix mutation arm has run.
- Removal of temporary instrumentation before release; the committed diagnostic currently remains on this branch.
- Diagnostic PR preparation is authorized by R277 and recorded above. Merge, deployment, package publication, tag and live bucket-key measurement still require further authority; none was performed.
- R212 fold decisions, release gate/readiness/tarball derivation, R2 parity, mirror sync, Worker redeploy from tag and scheduled-rescan implementation/cadence proof. These later tasks have not been completed; no consumers moved off the pre-fix published line through this lane.

Branch deletion remains prohibited; all three named branches are preserved. The [SOT disposition](s8-sot-disposition.md) records branch hygiene as EXPECTED-DRIFT, relocated run notes, the corrected Changesets command and 16 stale documents with source dates unchanged. No aggregate release-readiness, peer-review or production-keying pass is claimed.
