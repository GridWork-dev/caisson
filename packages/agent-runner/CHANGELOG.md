# @caisson/agent-runner

## 0.3.2

### Patch Changes

- 045b21e: The reference cloud embedder now validates the destination, not just the scheme. Its config schema proved the endpoint was https and nothing more, so a private, loopback or cloud-metadata address was a valid endpoint and the embedder would POST the configured Bearer credential to it. The shared public-host guard already used by four sibling egress sinks now runs once at construction, and the credential-bearing request refuses to follow redirects so a 3xx cannot re-target it past that check. The check is deliberately literal-host only and construction-time: the embedder wraps per text, so a name-resolving check on that path would cost a lookup per embedded string and break split-horizon deployments.

  The alerting webhook adapter now sends the standard security headers on every response rather than only a content type. All of its return paths, including the unauthorized one, share a single response constructor, so the headers apply by construction; a test now sweeps each status path individually rather than sampling the success case.

  The external timestamping client refuses redirects on submission. Its acceptance of cleartext and private-network endpoints is unchanged and now has a test pinning that behaviour, because only a hash is transmitted, trust comes from verifying the signed response rather than from the transport, and an internal timestamp authority is a supported deployment — applying a public-host restriction there would break both mainstream public authorities and self-hosted buyers.

  One comment corrected: the agent runner's endpoint check describes admitting cleartext for loopback providers, while the code admits it for any host. The code is right — named service endpoints are the common local deployment — and the comment now says so.

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0
  - @caisson/agent-trajectory@0.6.1

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
- Updated dependencies [c10e3b6]
  - @caisson/kernel@0.9.0
  - @caisson/agent-trajectory@0.6.0

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

- Updated dependencies [e1226f6]
- Updated dependencies [7d74f8f]
  - @caisson/agent-trajectory@0.5.0
  - @caisson/kernel@0.8.0

## 0.2.7

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/agent-trajectory@0.4.1

## 0.2.6

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [13e814d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
  - @caisson/agent-trajectory@0.4.0
  - @caisson/kernel@0.6.0

## 0.2.5

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/agent-trajectory@0.3.4
  - @caisson/kernel@0.5.3

## 0.2.4

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/agent-trajectory@0.3.3

## 0.2.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/agent-trajectory@0.3.2

## 0.2.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/agent-trajectory@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [c7476b9]
- Updated dependencies [c3b0e41]
- Updated dependencies [dffd0c1]
- Updated dependencies [696b2c5]
  - @caisson/agent-trajectory@0.3.0

## 0.2.0

### Minor Changes

- 3f05e1e: Add optional trajectory observation to the agent runner. When a caller injects a trajectory recorder
  (the append-only store port from the new engine-neutral trajectory package), the runner can replay a
  finished run's transcript into a trajectory event log: a run-started event, a step per assistant
  turn, tool proposals and results paired by tool-use id, a run-finished event, and a final usage event
  whose billing status is unsupported because the runner has no validated token contract and therefore
  makes no token claims. Sensitive bodies — the opening input, tool argument and result payloads — are
  carried only as a sha256 digest reference, never inlined. Recording is strictly opt-in: with no
  recorder configured the runner behaves byte-identically to before and stays off the hot path.

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/agent-trajectory@0.2.0

## 0.1.6

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.1.5

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.1.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.1.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.1.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.1.1

### Patch Changes

- ea52d1f: Add `@caisson/agent-runner` (new, ADR-0186): the sandboxed governed agent runner completing
  the Agentic-Dev "run agents safely" story. Spawns a headless agent CLI as a detached subprocess
  in an isolated worktree with a from-scratch scrubbed env — never spreads `process.env`; fixed
  non-secret passthrough allowlist + only the target provider's key + isolated HOME/config dir
  (ship-blocking leak-guard test, unit + end-to-end through a real spawn). Provider-agnostic
  config `{ binary, baseUrlEnv, authEnv, model, args }` with a worked Claude-CLI profile
  (`--strict-mcp-config`, no credentialed MCP); durable `.jsonl` transcript surviving launcher
  exit; run registry `spawn`/`tail`/`status`/`kill`/`list`/`finalReport` with `.strict()`-validated
  meta reads and a structured report (tool calls, files touched, final result) parsed from the
  transcript. Registered in the `apps/agent-dev` demo composition (`runAgentRunnerDemo`), and
  folded into the Agentic-Dev edition's `members` pin map + dependencies (ADR-0186 F5 edition-only
  SKU, the ADR-0178 tool-exec form).
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
