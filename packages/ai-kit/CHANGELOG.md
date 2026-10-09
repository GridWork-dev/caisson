# @caisson-sh/ai-kit

## 0.6.6

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [8226c84]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/agent-trajectory@0.6.2
  - @caisson-sh/ai-config@0.3.11
  - @caisson-sh/ai-meter@1.1.4
  - @caisson-sh/guardrails@0.5.2
  - @caisson-sh/tenancy-rls@0.6.2
  - @caisson-sh/field-crypto@1.1.3
  - @caisson-sh/credits@0.6.4
  - @caisson-sh/jobs@0.7.5
  - @caisson-sh/kernel@0.10.1
  - @caisson-sh/prompt-registry@1.1.3

## 0.6.5

### Patch Changes

- ac1a1a4: Move the guard-boundary guidance for tool authors onto `LoopTool.approvalRequired`'s own doc
  comment, where a tool author actually looks, instead of a paragraph in the file header. Doc-only,
  no behavior change.
- 69b3ba3: Routine non-major dependency refresh.

  `apps/site` picks up `@azure/identity`, `@plausible-analytics/tracker`, `motion` and
  `web-vitals` point releases (the `motion` 13.x major stays held). The CLI's
  `@modelcontextprotocol/sdk` moves to `1.30.0`, and `@caisson/ai-kit`'s own
  devDependency moves in lockstep — it imports the SDK's `Server` type directly alongside
  `@caisson/mcp-server`, a workspace sibling that shares a resolution subtree with the
  CLI, and a split version there makes the two `Server` types nominally distinct at
  typecheck. The email package's `nodemailer` moves to `9.0.5`. Root build tooling moves
  too: `@types/bun`, `dependency-cruiser` to `18.2.0` with its patch file re-cut,
  `eslint-plugin-storybook`, `knip`, `oxfmt` and `oxlint`.

  Three bumps prepared alongside these are deliberately **not** here. Each independently
  breaks something, and none is fixable by choosing a different version:

  - **`fumadocs-core` / `fumadocs-mdx` / `fumadocs-ui`.** Two separate blockers, and the
    second only appeared under the browser gate. First, the static search client's
    `initOrama` option is deprecated in favour of `initDB` and its default now builds
    against `zbsearch` rather than `@orama/orama` — that part is a _trivial_ adoption, a
    deletion: drop the hand-written init and call `oramaStaticClient()` bare, because the
    library default is already `create({ schema: { _: "string" } })` and `zbsearch`'s
    tokenizer defaults `language` to `"english"` on its own. Second, and the actual
    blocker: **16.15.1 renders two `main` landmarks on `/docs`.** The site's docs layout
    renders none of its own by design, so both come from fumadocs, and the P1 browser
    guard fails with `Expected: 1, Received: 2`. Notably the search guard
    (`P1-004`, focus return on every dismissal path) **passes** under the migration, so
    the search half is sound — the a11y regression is what holds the line.
  - **`kysely` `0.29.4` to `0.29.5`.** Only `apps/site` declares kysely, as a single exact
    pin, so there are never two copies of it. Moving it perturbs the peer-hash of
    `@better-auth/core`, and the site imports `better-auth` and
    `@better-auth/kysely-adapter` side by side; they then land on differently-hashed
    copies of the shared core whose `BetterAuthOptions` are nominally distinct under
    `exactOptionalPropertyTypes`. An override forcing one `@better-auth/core` version does
    not help — an override pins a version, not a peer-hash.
  - **A repo-wide `jose` pin.** On its own, from a clean baseline, it reproduces exactly
    the same three errors in the same file by the same mechanism. Both peer-hash items are
    tracked as backlog work; the override route is already ruled out.

  An earlier draft of this note argued the reverse of that last point: that the `jose` pin
  was load-bearing, and that dropping it would split the auth core and stop the site
  typechecking. That is backwards. Measured from `main`'s manifests as a green baseline,
  adding one group at a time: the pin alone produces the split, and `main` itself carries
  two `jose` versions and exactly one `@better-auth/core` while typechecking clean.

- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0
  - @caisson/agent-trajectory@0.6.1
  - @caisson/ai-meter@1.1.3
  - @caisson/credits@0.6.3
  - @caisson/field-crypto@1.1.2
  - @caisson/jobs@0.7.4
  - @caisson/prompt-registry@1.1.2
  - @caisson/ai-config@0.3.10
  - @caisson/guardrails@0.5.1

## 0.6.4

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
- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [8993cf7]
- Updated dependencies [1964e9d]
- Updated dependencies [87275f6]
- Updated dependencies [e6866e5]
- Updated dependencies [c10e3b6]
  - @caisson/guardrails@0.5.0
  - @caisson/kernel@0.9.0
  - @caisson/field-crypto@1.1.1
  - @caisson/jobs@0.7.3
  - @caisson/ai-meter@1.1.2
  - @caisson/tenancy-rls@0.6.0
  - @caisson/agent-trajectory@0.6.0
  - @caisson/ai-config@0.3.9
  - @caisson/credits@0.6.2
  - @caisson/prompt-registry@1.1.1

## 0.6.3

### Patch Changes

- @caisson/credits@0.6.1
- @caisson/ai-meter@1.1.1

## 0.6.2

### Patch Changes

- Updated dependencies [e1226f6]
- Updated dependencies [8875592]
- Updated dependencies [5d1f295]
- Updated dependencies [e19da1d]
- Updated dependencies [7d74f8f]
- Updated dependencies [f3c62cc]
- Updated dependencies [742c979]
  - @caisson/agent-trajectory@0.5.0
  - @caisson/field-crypto@1.1.0
  - @caisson/prompt-registry@1.1.0
  - @caisson/ai-meter@1.1.0
  - @caisson/kernel@0.8.0
  - @caisson/credits@0.6.0
  - @caisson/jobs@0.7.2
  - @caisson/guardrails@0.4.12
  - @caisson/ai-config@0.3.8
  - @caisson/tenancy-rls@0.5.8

## 0.6.1

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/jobs@0.7.1
  - @caisson/field-crypto@1.0.1
  - @caisson/credits@0.5.11
  - @caisson/agent-trajectory@0.4.1
  - @caisson/ai-config@0.3.7
  - @caisson/ai-meter@1.0.11
  - @caisson/guardrails@0.4.11
  - @caisson/prompt-registry@1.0.6
  - @caisson/tenancy-rls@0.5.7

## 0.6.0

### Minor Changes

- 13e814d: Add disposable request-scoped KMS contexts with append-only Postgres wrapped-key persistence,
  wire production BYOK to purge-protected Azure Key Vault keys, and let MCP run tools bind an async
  field-crypto context and its tenant executor in one atomic transaction without retaining plaintext
  keys between requests.

  BREAKING for direct API consumers, carried as a minor bump because these packages are pre-1.0:

  - `RunToolsDeps.keyProvider` (a `SyncFieldKeyProvider`) is REMOVED from `buildRunTools` and
    replaced by a required `fieldCryptoContext` runner. Callers passing a key provider no longer
    compile.
  - `WrappedKeyStore` gains a required `putWrappedIfAbsent` member, so any external implementation
    of that interface must add it.

  Also bounds request-context prefetch with a new `maxPrefetchVersions` option (default 64), so a
  tenant whose rotation depth exceeds what the request budget can serve fails with an error naming
  that depth instead of an anonymous deadline timeout; accepts AWS multi-Region `mrk-` key
  identifiers and reports replica-pending deletion without inventing a deletion date; requires an
  explicit Azure service principal rather than resolving an ambient credential chain; and erases key
  material returned by a provider call that completes after its deadline already elapsed.

### Patch Changes

- 0d87855: Test updated for the field-crypto scoped-key migration: the run-tools KMS test now checks key liveness inside the lend rather than reading a returned buffer afterwards. No runtime behaviour change in this package.
- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [31bf5f1]
- Updated dependencies [13e814d]
- Updated dependencies [0d87855]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
  - @caisson/field-crypto@1.0.0
  - @caisson/agent-trajectory@0.4.0
  - @caisson/kernel@0.6.0
  - @caisson/jobs@0.7.0
  - @caisson/ai-meter@1.0.10
  - @caisson/guardrails@0.4.10
  - @caisson/prompt-registry@1.0.5
  - @caisson/credits@0.5.10
  - @caisson/ai-config@0.3.6
  - @caisson/tenancy-rls@0.5.6

## 0.5.5

### Patch Changes

- @caisson/credits@0.5.9
- @caisson/ai-meter@1.0.9

## 0.5.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/agent-trajectory@0.3.4
  - @caisson/ai-config@0.3.5
  - @caisson/ai-meter@1.0.8
  - @caisson/credits@0.5.8
  - @caisson/field-crypto@0.3.5
  - @caisson/guardrails@0.4.9
  - @caisson/jobs@0.6.3
  - @caisson/kernel@0.5.3
  - @caisson/prompt-registry@1.0.4
  - @caisson/tenancy-rls@0.5.5

## 0.5.3

### Patch Changes

- 2229209: Release integrity hardening: every recorded package artifact now carries the dependency
  resolution it was built under, so a resolution change between releases is reported as a
  precise "republish this package" notice instead of a checksum mismatch. The agent loop's
  credit-budget guard is restated in fail-closed form, and stale documentation comments in
  the registry schema and the agent-trajectory manifest are corrected. No behavioral
  changes to published APIs.
- Updated dependencies [8ff4c62]
- Updated dependencies [2229209]
  - @caisson/guardrails@0.4.8
  - @caisson/agent-trajectory@0.3.3
  - @caisson/credits@0.5.7
  - @caisson/ai-meter@1.0.7

## 0.5.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/agent-trajectory@0.3.2
  - @caisson/ai-config@0.3.4
  - @caisson/ai-meter@1.0.6
  - @caisson/credits@0.5.6
  - @caisson/field-crypto@0.3.4
  - @caisson/guardrails@0.4.7
  - @caisson/jobs@0.6.2
  - @caisson/prompt-registry@1.0.3
  - @caisson/tenancy-rls@0.5.4

## 0.5.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/credits@0.5.5
  - @caisson/agent-trajectory@0.3.1
  - @caisson/ai-config@0.3.3
  - @caisson/ai-meter@1.0.5
  - @caisson/field-crypto@0.3.3
  - @caisson/guardrails@0.4.6
  - @caisson/jobs@0.6.1
  - @caisson/prompt-registry@1.0.2
  - @caisson/tenancy-rls@0.5.3

## 0.5.0

### Minor Changes

- c7476b9: You can now start a governed agent run and check its status without writing any code. The
  `caisson run start "<prompt>"` command opens a bounded, metered run through your own gateway and
  prints the result — including a pause for review if the model wants to use a tool that needs
  approval. A matching pair of agent-facing tools, `run_start` and `run_status`, is available from
  your buyer MCP server for an AI agent to call directly, gated behind the same licensed entitlement
  as the rest of the runtime. Neither surface ever exposes the raw parked-run snapshot; status
  reporting only ever shows the run's state and its trajectory.
- 9d50e7c: The AI kit gains `runToolLoop` — a bounded, governed agent tool loop. Each model step and
  each tool execution reserves credits before it runs and settles to actuals after (the same
  debit-before-spend ledger every gateway call uses), with a hard step ceiling, a caller-side
  integer credit budget that fails the run closed when the next step cannot fit, and a full
  append-only trajectory of the run (prompts, tool arguments, and results travel as content
  digests, never bodies). Tools are executed by the loop itself between model steps, so a
  declined reservation or an exhausted budget stops execution before any spend. The meter
  now also accepts a zero output-token bound on reservations, which lets non-generating
  actions take a zero-credit, cap-checked reservation.
- c3b0e41: Agent-runtime tool calls can now require human approval before they execute. A tool marked
  `approvalRequired` parks the run instead of running it: the proposal is recorded, the run's
  state is saved durably, and the run process can exit cleanly while the request waits. An
  operator reviews the pending call and approves or denies it — from the `caisson` CLI or any
  service with database access — and approval resumes the run from exactly where it left off,
  picks up the approved call, and continues to completion. Denial finishes the run without ever
  executing the tool. A durable run-state store and a durable trajectory log back this: approving
  the same call twice is a no-op, two concurrent resume attempts can never both execute the tool,
  and everything is tenant-isolated. The underlying tool-execution primitive gained a matching
  two-phase mode — validate and park a call, then execute it later once it's approved — for
  callers who want the same propose/execute split without the full run loop.

### Patch Changes

- ba4f62d: Fixed two edge cases in the metered inference gateway's billing path. A reconcile that needed
  to charge above the up-front reservation, but hit a wallet that couldn't cover the difference,
  now surfaces a distinct `OrphanedReservationError` instead of an unmarked insufficient-credits
  error — the held reservation is no longer invisible, and a later retry under the same call id
  settles it exactly once. And a stream aborted before the provider was ever contacted now settles
  zero cost instead of the estimated input tokens; a stream aborted after the provider responded
  still charges for what was actually consumed.
- Updated dependencies [9d50e7c]
- Updated dependencies [c7476b9]
- Updated dependencies [c3b0e41]
- Updated dependencies [c3b0e41]
- Updated dependencies [dffd0c1]
- Updated dependencies [4c6d3f7]
- Updated dependencies [696b2c5]
  - @caisson/ai-meter@1.0.4
  - @caisson/agent-trajectory@0.3.0
  - @caisson/jobs@0.6.0
  - @caisson/guardrails@0.4.5
  - @caisson/credits@0.5.4

## 0.4.4

### Patch Changes

- @caisson/credits@0.5.3
- @caisson/ai-meter@1.0.3

## 0.4.3

### Patch Changes

- 3f05e1e: The metered gateway now accepts an optional trajectory recorder. When one is wired, `infer()` and
  `inferStream()` emit a `model.call` event (model id plus a sha256 prompt digest only, never the
  prompt text) before the provider call and a `model.usage` event (`billingStatus: 'metered'`, the same
  integer token and credit numbers the ledger just settled) after reconcile. The instrumentation is
  purely additive: with no recorder the gateway behaves byte-for-byte as before, and a recorder that
  throws is swallowed and surfaced as a `trajectory.record_failed` ops warning — observation never fails
  the metered call.
- Updated dependencies [3f05e1e]
  - @caisson/agent-trajectory@0.2.0
  - @caisson/credits@0.5.2
  - @caisson/ai-meter@1.0.2

## 0.4.2

### Patch Changes

- 93c0a78: Migrate the metered inference and embedding gateway to AI SDK v7 while preserving provider routing and integer usage reconciliation.
- a8696cf: Remove redundant assignments and retain original errors when wrapping failures under the ESLint 10 recommended rules.
- 59e1365: Fold the last two non-catalog typescript pins back to `catalog:` (root devDependency at ^5.6.3 and
  apps/ai-kit at ^5.7.3) — the root pin was silently hoisting tsc 5.9.3 over the 6.0.3 catalog,
  making the bridge a mixed-version illusion. Also dates the bunfig minimumReleaseAgeExcludes for
  the AI SDK v7 family (adopted 2026-07-10; remove after 2026-07-17) — exact names only,
  scope globs don't work in bun 1.3.14.
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/prompt-registry@1.0.1
  - @caisson/ai-config@0.3.2
  - @caisson/ai-meter@1.0.1
  - @caisson/credits@0.5.1
  - @caisson/field-crypto@0.3.2
  - @caisson/guardrails@0.4.4
  - @caisson/tenancy-rls@0.5.2

## Unreleased

### Patch Changes

- Migrated the metered inference, streaming, embedding, and provider registry surfaces to AI SDK v7
  through an independently green v6 checkpoint. Provider transports, timeout injection, integer
  usage reconciliation, and the committed eval and accounting baselines remain unchanged. Streaming
  reservations now settle independently of consumer iteration, pre-delivery failures refund in full,
  and malformed or ledger-unsafe usage reconciles through bounded integer-safe fallbacks without
  refunding a completed call below its reservation.

## 0.4.1

### Patch Changes

- Updated dependencies [1bc677a]
- Updated dependencies [230f02a]
- Updated dependencies [a79acb4]
- Updated dependencies [2b65cf3]
- Updated dependencies [7df836a]
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
- Updated dependencies [1bc677a]
  - @caisson/ai-meter@1.0.0
  - @caisson/credits@0.5.0
  - @caisson/guardrails@0.4.3
  - @caisson/kernel@0.4.3
  - @caisson/ai-config@0.3.1
  - @caisson/tenancy-rls@0.5.1
  - @caisson/prompt-registry@1.0.0
  - @caisson/field-crypto@0.3.1

## 0.4.0

### Minor Changes

- 8c53ca3: field-crypto ships a real GCP Cloud KMS driver (`createGcpKmsClient`) beside
  the existing AWS driver: injected config, `ConfigError` fail-closed, per-tenant CryptoKey targeting
  with an `additionalAuthenticatedData` scope binding, and version-scoped crypto-shred via
  `destroyCryptoKeyVersion`. Registered in the shared `KmsClient` port-conformance suite; a self-skipping
  `live/kms-gcp.live.test.ts` proves the real adapter stack end to end against a throwaway per-run
  CryptoKey (GCP KeyRings/CryptoKeys can't be deleted, so the fixture KeyRing is pre-provisioned via
  `CAISSON_KMS_GCP_KEY_RING`; only the CryptoKey and its primary version are minted/destroyed per run).

  ai-config's provider lane enum gains three named OpenAI-compatible vendors — `groq`, `mistral`,
  `together` — following the same `apiKeyEnv`-required rule as `openai`/
  `openrouter`. ai-kit's `providerFor` wires all three over `createOpenAICompatible` with a hardcoded
  default `baseUrl` per vendor (Groq `https://api.groq.com/openai/v1`, Mistral
  `https://api.mistral.ai/v1`, Together `https://api.together.xyz/v1`, each overridable), and fails
  closed when the named `apiKeyEnv` resolves to no value (these are paid vendor APIs, unlike the
  `local`/`ollama` placeholder key).

### Patch Changes

- The two retired-alias meta packages now advertise their alias target's locked bundle price in
  the registry manifest ($739 for the AI Production Kit, $329 for Agentic-Dev), replacing the
  old pre-launch placeholder numbers. Purchasing behavior is unchanged — both ids keep resolving
  to their bundles exactly as before.
- Updated dependencies [8c53ca3]
- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/field-crypto@0.3.0
  - @caisson/ai-config@0.3.0
  - @caisson/tenancy-rls@0.5.0
  - @caisson/credits@0.4.1
  - @caisson/guardrails@0.4.2
  - @caisson/ai-meter@0.3.4
  - @caisson/prompt-registry@0.2.5

## 0.3.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 4d7eb71: Test-double bootstrap sweep for the credit-expiry migrations: every credit-table
  bootstrap now applies `CREDIT_EXPIRY_MIGRATION_SQL` + `GRANT_CONSUMPTION_MIGRATION_SQL` (the
  `debit()` FIFO path reads `expires_at` and writes `grant_consumption`). No runtime source change
  in these packages.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [dec93f3]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [4d7eb71]
- Updated dependencies [4d7eb71]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/ai-config@0.2.4
  - @caisson/ai-meter@0.3.3
  - @caisson/credits@0.4.0
  - @caisson/field-crypto@0.2.4
  - @caisson/guardrails@0.4.1
  - @caisson/kernel@0.4.2
  - @caisson/prompt-registry@0.2.4
  - @caisson/tenancy-rls@0.4.0

## 0.3.0

### Minor Changes

- cf66d65: Added `structuredGenerate<T>()`, a typed wrapper around the metered inference call for
  callers that want a parsed, schema-validated JSON value instead of raw model text. Pass a
  Zod schema and it returns `{ value, raw }` on success; on an empty completion, malformed
  JSON, or a schema mismatch it throws a typed `StructuredGenerateError` (with a `reason` of
  `refusal`, `invalid_json`, or `schema_mismatch`) instead of silently handing back an empty
  or unusable result. This closes a class of bug where a blocked or malformed model response
  was easy to miss because nothing failed loudly.

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/guardrails@0.4.0
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2
  - @caisson/ai-config@0.2.3
  - @caisson/ai-meter@0.3.2
  - @caisson/credits@0.3.2
  - @caisson/prompt-registry@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/ai-config@0.2.2
  - @caisson/ai-meter@0.3.1
  - @caisson/credits@0.3.1
  - @caisson/field-crypto@0.2.2
  - @caisson/guardrails@0.3.1
  - @caisson/prompt-registry@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.2.1

### Patch Changes

- 5fd31fe: streaming-path test coverage
- 44a6414: Fetch-deadline floor fix + metered embeddings (ADR-0213, harden-in-place ADR-0210): every live
  `@ai-sdk/*` provider factory now binds its outbound `fetch` to a configurable `timeoutMs` (default
  60s, via `fetchWithTimeout`) instead of the ambient global fetch, closing a hang/DoS-adjacent gap on
  every provider path; `infer()`'s `generateText` now forwards `opts.abortSignal`, mirroring
  `inferStream()`'s existing wiring. New `embed()`/`embedMany()` join the gateway through the SAME
  ai-meter reserve-before/reconcile-after chokepoint, provider-agnostic via the ai-config lane and
  BYOK-routed — a metered, buyer-facing embeddings surface for RAG/semantic-search built on the proved
  registry-resolver/reserve/reconcile machinery, no guardrails or prompt-registry render (an embed input
  feeds a vector index, not a moderated chat turn). Zero diff in `@caisson/ai-config`,
  `@caisson/ai-meter`, or `@caisson/pricebook` — a bundled embedding price-book row / bulk-embed SKU is
  cross-package money, deferred to a later release.
- ccf8b10: Branded money types + rounding provenance (ADR-0212).
  Kernel gains `src/money.ts`: TS-native nominal `Cents`/`Credits`/`MicroUsd`/`MicroUsdPerCredit`
  brands (compile-time only, zero runtime cost), `asCents`/`asCredits`/`asMicroUsd`/
  `asMicroUsdPerCredit` constructors (throw `ValidationError` on a non-integer/negative input),
  the identity `unwrapMoney` DB-boundary marker, and the `RoundedMoney<TRaw,TResult>`
  `{raw, mode, result}` record; `centsToCredits` now returns `Credits` and
  `centsToCreditsProvenance` returns the round-DOWN provenance record. Credits: `GrantInput`/
  `DebitInput.amount` are `Credits`, both accept optional `rounding`, and the new
  `CREDIT_ROUNDING_MIGRATION_SQL` (appended as platform migration `0007_credit_rounding.sql` —
  never an edit to the checksum-pinned `CREDIT_SCHEMA_SQL`) adds nullable
  `rounding_raw`/`rounding_mode` to `credit_event` with a biconditional + mode-enum CHECK.
  Pricebook: `creditsPerCycle`/`credits`/`codegenRunCredits` are branded; re-exports
  `centsToCreditsProvenance`. ai-meter: `CostBreakdown` is branded and gains `roundingCredits`
  (`mode: "up"`, ADR-0060) which `reserve()`/`reconcile()` persist onto their ledger rows;
  `BUNDLED_PRICE_BOOK` gains the `openai/text-embedding-3-small` row (ADR-0213 —
  embedding pricing is config, not code; `PRICE_BOOK_VERSION` bumped to 2026-07-02).
  `apply-billing-event` grants stay exact table integers with NULL/NULL provenance
  (ADR-0089 §5); ADR-0007 integer-at-rest is untouched. ai-kit/cli: boundary mints +
  test fixture updates only.
- 549dd4e: Strix pentest remediation (ADR-0204). kernel: new shared SSRF guard (`ssrf.ts`) — literal denylist + async DNS resolve-recheck of every resolved IP, the DNS-rebinding defense (vuln-0004). alerting + ai-kit: dedupe onto the kernel guard and resolve-recheck at the outbound-fetch seam (alerting per fetch; ai-kit via an injected guarded `fetch` for custom provider baseUrls). billing: `purchase.completed` carries `lineItems: {priceId, quantity}[]` so a multi-item cart fulfills every paid line, not just the first (vuln-0005), and a `subscription_update` regression test (vuln-0002).
- Updated dependencies [b5915e0]
- Updated dependencies [9558a46]
- Updated dependencies [959e555]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [081a1d8]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/ai-config@0.2.1
  - @caisson/ai-meter@0.3.0
  - @caisson/guardrails@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/field-crypto@0.2.1
  - @caisson/prompt-registry@0.2.1

## 0.2.0

### Minor Changes

- 59d332f: Edition seam-completion (ADR-0179..0185).

  - `@caisson/compliance`: OSCAL export lifted to v1.2.2 with a JSON→XML converter path (`oscal-export-xml`)
    and NIST-conformant SAR + POA&M output across all three frameworks (SOC2/HIPAA/EU-AI-Act) — finding
    status carries a constrained token + `remarks`, POA&M satisfies the `poam-items` min-1 XSD rule with a
    truthful "no open items" entry rather than a fabricated gap, and the root `props` block is dropped. Adds
    the AI-risk-register + field-crypto-policy collectors.
  - `@caisson/ai-kit`: BYOK key resolver (free-tier + edge-safe).
  - `@caisson/observability`: manual Bun-OTel request spans (`request-span`).
  - `@caisson/pricebook`: seam action export.

- 57170c5: Editions go live (ADR-0187 + ADR-0201/0202): live transports proven + retention escalation + support impersonation.

  - `@caisson/audit-worm`: `extendRetention` on the `ArtifactStore` port (strictly-monotonic, never
    shortens — ADR-0202), `escalateToCompliance` on the S3 backend behind the ADR-0051 three-belt gate,
    and the chain-evidenced `escalateRetention` helper (`retention.escalated` on the tenant chain;
    a chain-append failure fails the whole operation loudly). Live S3 Object-Lock proof in `live/`
    (`test:live`, self-skipping — ADR-0201).
  - `@caisson/ai-kit`: `openrouter`/`local`/`ollama` provider lanes moved to
    `@ai-sdk/openai-compatible`, fixing the AI SDK v5 Responses-API default that would have POSTed
    live calls to `{baseURL}/responses` instead of `/chat/completions`; a baseUrl-less `local`/`ollama`
    lane now fails closed instead of silently calling api.openai.com. Live gateway proof in `live/`.
  - `@caisson/local-ai`: `createOpenRouterRentedTransport` — the hosted (non-BYOK, fully-metered)
    rented lane over OpenRouter's OpenAI-compatible wire, egress-guarded and strict-revalidated.
    Live rented + availability-gated ONNX proofs in `live/`.
  - `@caisson/compliance`: the support-impersonation kernel with a dual audit trail (ADR-0187) —
    time-bounded, reason-required sessions; operator + acting-as-tenant records linked by `sessionId`
    on the target tenant's WORM-anchored chain; `impersonation_session` migration (RLS + column-scoped
    GRANT); the impersonation evidence collector cited by both the SOC2 and HIPAA plans.

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 33bee35: Whole-repo audit round-4 remediation (ledger 2026-07-01): BYOK (tenant-key) inference now
  makes zero wallet movement while internal metering still runs, implementing ADR-0182/0198;
  provider-unreported token usage is kept distinct from genuine zero so reconcile settles at
  the reserved estimate instead of silently refunding a real call; the spend-window bucket is
  fixed at reserve and reused at reconcile so boundary-straddling calls no longer undercount
  the hard-cap breaker. Alerting webhook/Slack/Telegram destinations get an https-only +
  private/metadata-range SSRF guard at both the Zod boundary and the fetch seam, mirroring the
  ai-kit baseUrl policy. The retention_audit table gets fail-closed RLS via an append-only
  follow-up migration. The pg-boss production job driver now validates task name + payload
  schema on enqueue like its sibling drivers.
- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- Updated dependencies [22077d1]
- Updated dependencies [33bee35]
- Updated dependencies [72ffd85]
- Updated dependencies [69817a1]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/guardrails@0.2.0
  - @caisson/prompt-registry@0.2.0
  - @caisson/ai-meter@0.2.0
  - @caisson/field-crypto@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/ai-config@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/tenancy-rls@0.2.0
