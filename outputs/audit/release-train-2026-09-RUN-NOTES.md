# S8 release train run notes — 2026-09-10

Current location: `outputs/audit/release-train-2026-09-RUN-NOTES.md`, relocated from the repository root by the operator's SOT ruling. Earlier root-path diagnostics below describe historical runs.

## Compact continuation checkpoint — operator SOT ruling

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
