# @caisson-sh/tool-exec

## 0.4.2

### Patch Changes

- Updated dependencies [4954dc1]
- Updated dependencies [fa815fc]
- Updated dependencies [e58ddc3]
  - @caisson-sh/kernel@0.10.2

## 0.4.1

### Patch Changes

- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/kernel@0.10.1

## 0.4.0

### Minor Changes

- f02b193: Bind two-phase approvals to private one-shot records and revalidate current policy before execution. Legacy hand-built proposals are rejected; the browser preview and run path remain unchanged.

  Pending approvals now expire after fifteen minutes and support atomic reject(approvalId) without spawning. Durable approval-store adapters must implement rejection and expiration cleanup.

- ac1a1a4: Let hook and tool subprocesses run under a caller-supplied environment.

  A `CommandHookSpec` (agent-kernel) and a `CommandSpec` allowlist entry (tool-exec) may now set an
  optional `env` object. Supplied, it is passed to the spawned process verbatim, never merged with
  the parent's environment, so a caller narrowing a child to exactly the vars it needs must include
  `PATH` explicitly if the command needs it. Absent, the default is unchanged: the child inherits
  the parent's full environment. Flipping that default is a separate, deliberate major version, not
  this change.

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
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

## 0.3.0

### Minor Changes

- 03ca530: Both packages gain a browser-safe `./browser` entry point, so the parts of each that are pure
  validation can now be imported inside a client bundle.

  `@caisson/agent-runner/browser` carries the provider profile model, `CLAUDE_CLI_PROFILE`,
  `PASSTHROUGH_KEYS`, and `buildEngineEnv` — the env scrub, exactly as the runner itself runs it.
  `buildEngineEnv`'s first parameter is now typed structurally instead of as Node's process-env type,
  so it no longer requires Node's ambient types; `process.env` still satisfies it and existing callers
  are unchanged.

  `@caisson/tool-exec/browser` carries `createToolProposer`, the default-deny allowlist lookup plus
  Zod argv validation with no spawn seam attached — the same gate `createToolExec` runs, now also
  available on the main entry, so a UI can show whether a call is permitted without a process
  boundary anywhere near it.

  The main entry of each package is unchanged and keeps the full Node-capable surface, and every
  browser-entry export is also available there. The site's agent-runner and tool-exec interactive
  demos now run that real logic instead of a hand-maintained copy.

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.2.5

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.2.4

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.2.3

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.2.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.2.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.2.0

### Minor Changes

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

## 0.1.7

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.1.6

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.1.5

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- 5349b63: The tool-exec primitive's registry manifest carried a pre-launch placeholder price. Its listed
  price now matches the committed $99 shown at checkout, so buyers browsing the module registry and
  buyers checking out see the same number.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.1.4

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.1.3

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
