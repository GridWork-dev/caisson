# S8 release train receipt — R272 task 1 assessment, 2026-09-10

Governing brief: `/home/gw/lab/briefs/estate-2026-09/S8-caisson-release.md`, with the operator's subsequent corrections and R272. Historical stops and their dispositions remain in [the run notes](release-train-2026-09-RUN-NOTES.md).

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
- PR/CI, deployment and release actions. R272 explicitly withholds PR, deployment, publish, tag and live bucket-key measurement pending a further ruling. No such action was taken in this assessment.
- R212 fold decisions, release gate/readiness/tarball derivation, R2 parity, mirror sync, Worker redeploy from tag and scheduled-rescan implementation/cadence proof. These later tasks have not been completed; no consumers moved off the pre-fix published line through this lane.

Branch deletion remains prohibited; all three named branches are preserved. The [SOT disposition](s8-sot-disposition.md) records branch hygiene as EXPECTED-DRIFT, relocated run notes, the corrected Changesets command and 16 stale documents with source dates unchanged. No aggregate release-readiness, peer-review or production-keying pass is claimed.
