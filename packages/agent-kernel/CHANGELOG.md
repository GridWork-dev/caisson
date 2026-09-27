# @caisson/agent-kernel

## 0.8.1

### Patch Changes

- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/kernel@0.10.1

## 0.8.0

### Minor Changes

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

## 0.7.1

### Patch Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
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

## 0.7.0

### Minor Changes

- f368318: Agent kernel gains a browser-safe `./browser` entry point: the agent/skill/rule schema and its
  authoring helpers, the seven-act lifecycle FSM, the allow/deny/mutate governance algebra, and the
  redacting logger can now be imported inside a client bundle. The main entry is unchanged and keeps
  the full surface, including the shell-command hook handler and the audited hash-chain lifecycle;
  every browser-entry export is also available there.

  Local sync needs no second entry point, because its single entry is now browser-safe end to end:
  the changeset types, the hybrid logical clock, and the tombstone-aware merge all import cleanly
  into a client bundle. As part of that, the replica id minted when a change log is first opened now
  uses the runtime's built-in WebCrypto `crypto.randomUUID()` instead of the Node crypto module —
  the same UUID format, and the id is still persisted and reused on every later open — and the
  package now declares a Node 20.12 minimum.

  The site's agent-kernel and local-sync interactive demos run the shipped packages end to end
  instead of hand-maintained copies of their logic.

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.6.5

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.6.4

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.6.3

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.6.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.6.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.6.0

### Minor Changes

- 586916f: Skills can now ship bundled files. A skill artifact gains three optional maps — `references` and `assets` for supporting docs and static files, and `scripts` for executable helpers — each a relative path plus its content. The multi-harness emitter writes them into every SKILL.md directory it produces.

  Executable content is trust-tiered. The curated default skill set always emits its scripts; scripts on a skill set you supply yourself are held back unless you pass `allowScripts`, and any withheld scripts are reported rather than dropped silently. References and assets always emit. All three fields are optional, so skills authored before this release are unaffected.

## 0.5.0

### Minor Changes

- ce1e576: Add the agentskills.io SKILL.md portability fields to `SkillArtifact`: optional `license`, `compatibility`, `metadata`, and `allowedTools`, each bounded to the specification's caps and validated through the Zod strict boundary. Skill `name` and `description` gain the spec's 64 and 1024 character caps. Every field is optional, so an absent field round-trips byte-identically and every previously authored skill parses unchanged. No `scripts`, `references`, or `assets` fields — that trust boundary is deferred to a later write-gate program.

## 0.4.2

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.4.1

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.4.0

### Minor Changes

- 8c53ca3: `RuleArtifact` and `SkillArtifact` gain an optional `activation` (`always` / `paths` /
  `manual`) and `paths` (bounded, relative-glob-only) pair, letting an authored rule or skill scope
  its activation instead of always loading. The multi-harness emitter fixes the shipped Cursor
  degrade (rules no longer hardcode `alwaysApply: true`) and gains three new targets — Devin Desktop
  (mirrored to the legacy Windsurf path), GitHub Copilot (repo-wide instructions + per-artifact
  path-scoped instructions), and Cline — plus an `EmittedBundle.warnings[]` channel that fires a
  specific, actionable warning whenever a target cannot represent the source's activation intent
  instead of silently degrading it. The emitted `AGENTS.md` is reframed as the universal multi-tool
  base layer (Codex, Cursor, Devin, Zed, Gemini CLI, and the Copilot coding agent all read it
  natively) — its emitted content and path are unchanged.

## 0.3.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.3.0

### Minor Changes

- cf66d65: Add a secret-redacting structured event logger. `makeRedactingLogger` builds a
  logger that redacts every string leaf and any credential- or PII-named field in a
  structured event before handing it to your own write sink (file, database, log
  shipper), and `toRedactedJsonlLine` serializes one redacted event to a single JSON
  Lines record. Use it as the default scrub pass before agent audit-trail events are
  persisted, so API keys, tokens, and other secrets accidentally captured in an event
  payload never reach disk or a downstream log store.

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
