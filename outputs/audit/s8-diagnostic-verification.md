# S8 diagnostic preparation verification — 2026-09-10

R272 disposition: proceed on the orchestrator's own analysis without retrying the refused peer dispatches. Neither peer ran; no peer-review or security-audit pass exists. The task 1 receipt names the claims supported only by that single-author analysis and local tests. Production keying remains inconclusive, and R272 prohibits PR, deployment, publish, tag and live key measurement without a further ruling. No code/test change or new execution result is asserted here.

Scope: temporary observation in shared `TokenBucketLimiter.check`, license `/issue`, and Ask AI's IP passed to Turnstile. Header precedence, limiter budgets and response/authentication paths are unchanged. This verifies local preparation, not the live-key goal.

## Predicted and measured gates

Each run was predicted to pass before execution. All completed with exit 0.

| Gate                      | Measured result                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run format`          | Passed; 3,476 files visited; porcelain contained only task-owned paths before staging                                                                                                                         |
| Receipt commit            | `24229e8c`; normal hooks passed                                                                                                                                                                               |
| Three focused suites      | `bun test packages/rate-limit/src/token-bucket.test.ts services/license/src/issue-app.integration.test.ts apps/site/lib/ask-ai/handler.test.ts --timeout 60000`: 67 pass, 0 fail, 194 assertions              |
| Changed-file lint         | `bunx oxlint` over the six changed TypeScript source/test files: exit 0                                                                                                                                       |
| Whole-tree format         | `bun run format:check`: all matched files correct                                                                                                                                                             |
| Affected builds/typecheck | `bunx turbo run build typecheck --filter=@caisson/site --filter=@caisson/service-license --filter=@caisson/rate-limit --no-daemon --concurrency=4`: 46 successful tasks; 41 cached, 5 executed; 40.58 seconds |

Build logs included non-failing Turbo daemon deprecation/circular-package warnings and a Next dynamic-filesystem-tracing warning from `packages/cli/dist/writer.js`. No change to those unrelated paths is proposed. Cache replay included historical paths in cached logs; this run's working directory remained the release-train worktree.

Next type generation added a `root-params.d.ts` import to `apps/site/next-env.d.ts`. That generated build-only delta was inspected and removed from the proposed source diff; it is unrelated to application-key observation.

## What the new tests establish

The shared observation preserves allow/deny/global decisions, emits the selected key including the unknown sentinel, and tolerates a throwing sink. Real license application tests preserve unsigned 401 responses, log a recognized marker once, stay silent for ordinary traffic and a health request, stop logging after expiry, and tolerate logger failure. Ask AI tests bind logged IP to the actual Turnstile argument, preserve 403 before session work, and cover ordinary traffic, duplicate marker, expiry and logger failure.

These synthetic requests do not test Cloudflare/Railway behavior. Direct deployed key observation remains required. No defect/no-defect verdict, mutation proof of a keying fix, or release readiness is claimed.

## Sweep and publication boundary

The optional callback is temporary and source-compatible with existing two-argument callers. It has no configured observer in other consumers. The source census includes the four operator-named siblings with their distinct contracts in `s8-direct-key-prediction.md`. A supported empty Changesets entry records that this diagnostic requests no package release; the diagnostic must be removed before the train.

Code/security review and CI remain pending. Deployment remains an operator act under R203; the direct-key prediction is already committed and must not be rewritten after measurement.

Diagnostic commit: `38631ed48a035b717ee163e8564e057478f5e2d0`, parent `24229e8c1ba446e360f0cd28005e4a289fec88ed`. The subsequent governed code/security review attempts both refused quota admission before reviewer startup: exit 2, gauge 89%, estimate 180,000 tokens, projected 98% versus ceiling 95%. No audit verdict exists. The admission telemetry sink also returned 404. No bypass, retry or alternate dispatch followed; the lane is held under the operator's stop rule.

The corrected `bunx @changesets/cli status --since=origin/main` preflight also passed with the supported empty changeset staged: no patch, minor or major bumps. After frozen installation this resolves the repository's installed CLI 2.31.1 (the earlier dependency-free invocation used 3.0.2).
