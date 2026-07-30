# @caisson/tool-exec

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
