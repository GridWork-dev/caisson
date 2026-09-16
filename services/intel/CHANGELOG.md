# @caisson/service-intel

## 0.0.11

### Patch Changes

- 7e11672: Upgrade runtime OS layers on pinned bases and gate fixable HIGH/CRITICAL runtime OS findings while reporting application and raw-base residuals.
- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [9cb7681]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/observability@0.3.9
  - @caisson/kernel@0.10.0
  - @caisson/alerting@0.3.2

## 0.0.10

### Patch Changes

- 2609293: Consolidation wave one: the eighteen refutation-verified cuts from the August consolidation audit.

  New public API: `@caisson/kernel` gains the narrow `./crypto` subpath (node:crypto-only graph,
  so a Cloudflare Worker can import the timing-safe compare without the wide `./node` barrel's
  `node:dns` reach), and `@caisson/tenancy-rls` exports `createPgTransactor(pool)` — the canonical
  node-postgres BEGIN/COMMIT/best-effort-ROLLBACK/release adapter previously copy-pasted across the
  site, admin, the license deploy entry, the CLI, and the generated Next starter (which also gains
  the best-effort rollback it lacked). Everything else is deletion or internal consolidation with
  behavior pinned by tests: dead marketplace/build residue and dead nav derivation out of the site,
  the unused account-entitlement resolver and 111 unreachable barrel exports out of the license
  service, the orphan EU AI Act manifest out of compliance (it was being packed while unreachable),
  an unused trust-page devDependency, shared task-registry lookup across the five jobs drivers,
  shared exact byte-identical parser readers in billing-orchestration, the kernel browser-graph
  walker folded onto the shared testing module-graph, the intel OpenRouter transport shared between
  enrichment and its eval judge, license scheduler test fixtures consolidated, the dependency graph
  guard moved into standards-gate ownership (its test now runs in the package suite), the Better
  Stack adapter's unauthenticated dev bypass deleted and its secret compare folded onto the kernel
  primitive, and one boundary-policy data source feeding ESLint, dependency-cruiser, and the
  standards gate — closing a drifted cruiser hand-copy that had silently stopped guarding the five
  current bundle roots.

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/alerting@0.3.1
  - @caisson/observability@0.3.8

## 0.0.9

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [49f26a4]
- Updated dependencies [7d74f8f]
  - @caisson/observability@0.3.7
  - @caisson/alerting@0.3.0
  - @caisson/kernel@0.8.0

## 0.0.8

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/alerting@0.2.6
  - @caisson/observability@0.3.6

## 0.0.7

### Patch Changes

- Updated dependencies [a00a9ef]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
  - @caisson/observability@0.3.5
  - @caisson/kernel@0.6.0
  - @caisson/alerting@0.2.5

## 0.0.6

### Patch Changes

- 3820d6f: `dep-digest` watcher: buyer-impact packages now split into direct vs transitive-only. A
  dependency bump finding used to list only packages that declare the affected dependency in their
  own manifest; it now also resolves `bun.lock` to find packages that only pull the dependency in
  through another internal package or a resolved third-party package, and lists those separately.
  If the lockfile lookup fails for any reason, the finding falls back to the direct-only list with
  a note, so the watcher never drops a finding over it.
- ad9b1e0: New weekly `dep-digest` watcher: flags stalled Renovate PRs, available toolchain/pinned-dependency
  upgrades (including the exact-pinned better-auth session adapter and the native TypeScript
  compiler pin), and new bun releases, holding a bump for a short window after publish before
  reporting it as actionable. Each finding lists which internal packages depend on the affected
  dependency directly. Alerts route through the same Telegram/Linear delivery path production error
  findings already use. Private service — versioned, not published.
- Updated dependencies [c36b9e2]
  - @caisson/alerting@0.2.4
  - @caisson/kernel@0.5.3
  - @caisson/observability@0.3.4

## 0.0.5

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/alerting@0.2.3
  - @caisson/observability@0.3.3

## 0.0.4

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/alerting@0.2.2
  - @caisson/observability@0.3.2

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
