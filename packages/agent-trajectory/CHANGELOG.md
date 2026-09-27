# @caisson/agent-trajectory

## 0.6.2

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
  - @caisson-sh/ai-meter@1.1.4
  - @caisson-sh/tenancy-rls@0.6.2
  - @caisson-sh/field-crypto@1.1.3
  - @caisson-sh/kernel@0.10.1

## 0.6.1

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0
  - @caisson/ai-meter@1.1.3
  - @caisson/field-crypto@1.1.2

## 0.6.0

### Minor Changes

- c10e3b6: Add the ./usage entry point: price normalization (priceUsage), the pricebook alias map (resolveModelAlias), and the Codex rollout adapter (parseCodexRollout), folded in from the retired agent-usage package so one package owns the whole transcript-to-priced-events surface.

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
  - @caisson/field-crypto@1.1.1
  - @caisson/ai-meter@1.1.2
  - @caisson/tenancy-rls@0.6.0

## 0.5.0

### Minor Changes

- e1226f6: agent-trajectory gains a browser-safe `./browser` entry point: the strict event schema, the
  in-memory append-only store, the run-state port with its in-memory implementation, both
  deterministic projections, and the Claude transcript adapter can now be imported inside a client
  bundle, so a dashboard can replay and validate a trajectory in the browser. The main entry is
  unchanged and keeps the full surface, including the two Postgres-backed stores, and every
  browser-entry export is also available there. The site's replay interactive demo now runs that
  real code end to end instead of a hand-maintained copy.

### Patch Changes

- Updated dependencies [8875592]
- Updated dependencies [7d74f8f]
  - @caisson/field-crypto@1.1.0
  - @caisson/kernel@0.8.0
  - @caisson/tenancy-rls@0.5.8

## 0.4.1

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/field-crypto@1.0.1
  - @caisson/tenancy-rls@0.5.7

## 0.4.0

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

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [31bf5f1]
- Updated dependencies [13e814d]
- Updated dependencies [0d87855]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
  - @caisson/field-crypto@1.0.0
  - @caisson/kernel@0.6.0
  - @caisson/tenancy-rls@0.5.6

## 0.3.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/field-crypto@0.3.5
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

## 0.3.3

### Patch Changes

- 2229209: Release integrity hardening: every recorded package artifact now carries the dependency
  resolution it was built under, so a resolution change between releases is reported as a
  precise "republish this package" notice instead of a checksum mismatch. The agent loop's
  credit-budget guard is restated in fail-closed form, and stale documentation comments in
  the registry schema and the agent-trajectory manifest are corrected. No behavioral
  changes to published APIs.

## 0.3.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/field-crypto@0.3.4
  - @caisson/tenancy-rls@0.5.4

## 0.3.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/field-crypto@0.3.3
  - @caisson/tenancy-rls@0.5.3

## 0.3.0

### Minor Changes

- c7476b9: Parked agent-run bodies (the conversation and tool-call arguments a run saves while it waits for
  approval) are now encrypted at rest. Previously this snapshot was stored in the clear; a database
  dump or a stray query could read it. Now every parked body is sealed with the same per-tenant
  authenticated encryption the rest of the platform's sensitive fields use, and only the run that
  saved it can ever decrypt it back. Approving or denying a pending tool call, and resuming a run
  afterward, work exactly as before — this only changes what sits in the database in between.
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
- dffd0c1: Usage events gain a fourth billing band, `priced`: pricebook-computed integer credits
  attached to real adapter-extracted token counts, with provenance stamped in the new
  optional `priceBookVersion` field. Priced events are cost statements, never charges —
  only `metered` remains ledger-truth. The schema now enforces the credit invariant
  (nonzero credits are only valid on `metered`/`priced` events), and run projections
  report a `priced` usage band alongside the existing three.
- 696b2c5: Agent runs now project a scored-consumable tool-call list. `projectToolCalls(events)` folds
  a run's tool proposals, approvals, denials, and results into one entry per call — its name,
  its argument digest, who approved or denied it and how, and whether it succeeded — ordered
  by proposal order and stable under out-of-order event delivery, exactly like the existing
  run projection. This is a new, separate projection: the existing run projection and its
  shape are unchanged.

## 0.2.0

### Minor Changes

- 3f05e1e: New engine-neutral trajectory package: an append-only, replayable event schema for a governed agent
  run (runs, steps, model calls, tool proposals, approvals, tool results, usage, checkpoints). Every
  event is validated at a strict boundary with integer token and credit units; sensitive bodies —
  prompt text, tool argument and result bodies, checkpoint state — are carried only as a sha256 digest
  reference, never inlined. The package ships an append-only store port (idempotent per run sequence,
  gaps and rewrites rejected) with an in-memory implementation, a deterministic projection that folds
  the same log to a byte-identical view regardless of arrival order, and a first usage adapter that
  reads Claude Code transcript lines into estimated usage events. Reserved and unpublished for now:
  it joins no bundle and carries no committed price until the runtime loop lands.
