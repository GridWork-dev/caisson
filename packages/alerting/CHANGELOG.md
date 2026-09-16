# @caisson/alerting

## 0.3.2

### Patch Changes

- Updated dependencies [e211684]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [69b3ba3]
- Updated dependencies [498b279]
  - @caisson/email@0.5.8
  - @caisson/kernel@0.10.0

## 0.3.1

### Patch Changes

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
  - @caisson/email@0.5.7

## 0.3.0

### Minor Changes

- 49f26a4: Both packages gain a browser-safe `./browser` entry point. For alerting that is the event contract,
  dedup, rate-cap, quiet hours, the delivery port with its isolation wrapper and capture driver, the
  audit port with its in-memory driver, and `processAlert` itself — everything except the five
  network delivery drivers, which stay on the main entry because a browser cannot hold a webhook
  signing secret. For retention runner it is the request contract, the erasure-target port with all
  three reference drivers, the audit-sink port with its in-memory driver, and `runErasure` itself —
  everything except the recurring-sweep scheduling helpers. The main entry of each package is
  unchanged and keeps the full surface, and every browser-entry export is also available there.

  Internally, alerting's delivery port, its per-channel isolation wrapper, and the capture driver move
  into their own module so the orchestrator no longer pulls the network drivers in behind it. Every
  public export keeps its name and shape.

  The alerting and retention-runner interactive demos on the site now run the shipped packages end to
  end instead of hand-maintained copies, so what the demo does is what the code does — including the
  erasure request validation the copy left out.

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0
  - @caisson/email@0.5.6

## 0.2.6

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/email@0.5.5

## 0.2.5

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [6d1c805]
- Updated dependencies [6d1c805]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/email@0.5.4
  - @caisson/kernel@0.6.0

## 0.2.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/email@0.5.3
  - @caisson/kernel@0.5.3

## 0.2.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/email@0.5.2

## 0.2.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/email@0.5.1

## 0.2.1

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [59e1365]
- Updated dependencies [a0fd9b1]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/email@0.5.0

## 0.2.0

### Minor Changes

- 2b65cf3: `@caisson/alerting` adds a fifth network channel, `createDiscordChannel` (SSRF-guarded, maps an
  `AlertEvent` to a Discord webhook embed colored by severity), plus a `deliverImmediate` helper for
  callers with no persisted incident/rate-cap state of their own. `@caisson/jobs`' pg-boss driver
  adds an optional `alerting` port (`JobAlertingDeps`) to `createPgBossJobQueue`: a `work()` task
  failure now reports through it before re-throwing (pg-boss's own retry/dead-letter machinery is
  untouched), and the underlying `PgBoss` instance's `error` event — previously unhandled, a process-
  crash risk per pg-boss's own docs — is now wired via the new `wireBossErrorHandler`. Both additions
  are additive and optional; every existing caller keeps compiling unchanged.

### Patch Changes

- Updated dependencies [81223a7]
- Updated dependencies [b8fe873]
- Updated dependencies [114e2a0]
- Updated dependencies [4036574]
- Updated dependencies [5e9996e]
- Updated dependencies [2b65cf3]
- Updated dependencies [d5cef92]
- Updated dependencies [8253e76]
- Updated dependencies [9a81dd7]
- Updated dependencies [97b0341]
  - @caisson/email@0.4.0
  - @caisson/kernel@0.4.3

## 0.1.5

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and corrected a couple of stale cross-package dependency and usage claims to
  match the shipped code. No runtime behavior changed in any package — documentation and
  comments only.
- Updated dependencies [b791198]
- Updated dependencies [783110d]
- Updated dependencies [4d7eb71]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/email@0.3.0
  - @caisson/kernel@0.4.2

## 0.1.4

### Patch Changes

- cf66d65: Hardened row-level security on the alert-audit log table: the tenant-isolation check now
  discards an empty-string tenant identifier before comparing it against a row's tenant column,
  instead of comparing against it directly. This closes a narrow gap where certain
  connection-pooling configurations can leave a database session with an empty string instead
  of a properly cleared value, which previously could coincide with a real row's tenant column
  and let it be read. Shipped as a follow-up migration alongside the original table migration,
  so existing installs pick up the hardening on their next migrate run.
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/email@0.2.3

## 0.1.3

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/email@0.2.2

## 0.1.2

### Patch Changes

- 549dd4e: Security hardening pass (ADR-0204). kernel: new shared SSRF guard (`ssrf.ts`) — literal denylist + async DNS resolve-recheck of every resolved IP, defending against DNS rebinding. alerting + ai-kit: dedupe onto the kernel guard and resolve-recheck at the outbound-fetch seam (alerting per fetch; ai-kit via an injected guarded `fetch` for custom provider baseUrls). billing: `purchase.completed` carries `lineItems: {priceId, quantity}[]` so a multi-item cart fulfills every paid line, not just the first, plus a `subscription_update` regression test.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
  - @caisson/email@0.2.1

## 0.1.1

### Patch Changes

- 33bee35: Security hardening pass: BYOK (tenant-key) inference now
  makes zero wallet movement while internal metering still runs;
  provider-unreported token usage is kept distinct from genuine zero so reconcile settles at
  the reserved estimate instead of silently refunding a real call; the spend-window bucket is
  fixed at reserve and reused at reconcile so boundary-straddling calls no longer undercount
  the hard-cap breaker. Alerting webhook/Slack/Telegram destinations get an https-only +
  private/metadata-range SSRF guard at both the Zod boundary and the fetch seam, mirroring the
  ai-kit baseUrl policy. The retention_audit table gets fail-closed RLS via an append-only
  follow-up migration. The pg-boss production job driver now validates task name + payload
  schema on enqueue like its sibling drivers.
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/email@0.2.0
