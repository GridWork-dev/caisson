# @caisson/service-intel

## 0.0.3

### Patch Changes

- 0a58f8e: Hash-mode compliance change notices (EU AI Act, SOC 2) now persist a bounded normalized snapshot next
  to the detection hash and carry a real before/after content delta in the finding payload, so the
  composed operator brief can state WHAT changed instead of "content-level delta unavailable"
  (CAISSON-101). Private service — versioned, not published.
- 7e823a9: Renovate dependency pins (exact versions) across the app and service workspaces; no code change.
- Updated dependencies [e5e4311]
- Updated dependencies [d1b4afa]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/observability@0.3.1
  - @caisson/alerting@0.2.1

## 0.0.2

### Patch Changes

- CAISSON-102: Replace one-paragraph enrichment with a strict, grounded WHAT/WHY/ACTION JSON
  composition contract and render explicit operator sections. The watcher cassette schema now stores
  raw deterministic findings only; brief composition and actionability judging run live through a
  fail-closed OpenRouter judge on GitHub-hosted CI. A red live run never blesses or commits datasets.
- 88ccb09: New standing operator intelligence daemon: watches compliance-framework updates (NIST OSCAL, EU AI
  Act, HIPAA breach portal, AICPA SOC 2), competitor pages, GitHub traction, product analytics
  (PostHog + Plausible), and production errors, detecting changes cheaply and deterministically
  before any optional LLM enrichment runs. Findings land in a dedicated, additive Postgres schema;
  production-error signal routes through the alerting pipeline to the operator's Telegram bridge and
  an auto-filed Linear issue. Each watcher is independently runnable via the service CLI as well as
  the daemon's own internal scheduler.
- 55b3d48: Fix the intelligence scheduler so watcher cadences longer than about 24.8 days fire at their true interval instead of collapsing into a tight loop, and run the admin control-plane's auth-table migration at server boot — with the health check failing closed if that migration does not succeed, so a broken deploy is never marked healthy.
- 8c9a830: The cassette recorder's judge-verdict parse now tolerates fence-wrapped JSON: OpenRouter drops
  `response_format` for anthropic models and the judge wraps its object in markdown fences, which
  the strict parse read as non-JSON and threw on every finding. The recorder extracts the outermost
  object before parsing and stays fail-closed when no JSON is present. Surfaced by the first live
  recording run.
- 2b65cf3: Both services now alert on background-job/watcher failures: `service-license` threads an
  `alerting` port into the credit-expiry pg-boss scheduler (a sweep/notice/tick task failure or a
  pg-boss connection error notifies the operator, then the original failure still propagates
  unchanged); `service-intel` alerts when a watcher tick fails. Both fan out to an operator Discord
  channel when `DISCORD_OPS_WEBHOOK_URL` is configured; absent it, behavior is unchanged from
  before. No public API changes.
- 3da56f0: Add a judged replay eval lane for the intel daemon's briefs. An operator-run recorder
  (`src/eval/record.cli.ts`) captures a sanitized cassette per watcher to the pinned path
  `services/intel/__cassettes__/<watcher>.json` — request/response exchanges, the watch_state read, the
  findings produced, and one embedded LLM verdict per finding — behind a fail-closed scrub gate that
  throws if any secret value survives the write. A replay harness re-runs the REAL watcher code against
  a cassette with zero network and zero tokens and grades a HYBRID rubric: accuracy + grounding
  deterministically in code, and actionability from the cassette's replayed judge verdicts. Two pooled
  `defineEval` runs (deterministic at threshold 1.0, judged at 0.7, both with a 0.6 Wilson floor for the
  small session-4 sample) gate against a committed baseline via `@caisson/ai-evals`, joined to the turbo
  `eval` task. The lane self-skips with zero cassettes, so it stays green until an operator records and
  blesses a baseline post-merge. Private package only; no publishable release.
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [0dd715a]
- Updated dependencies [8253e76]
  - @caisson/alerting@0.2.0
  - @caisson/kernel@0.4.3
  - @caisson/observability@0.3.0
