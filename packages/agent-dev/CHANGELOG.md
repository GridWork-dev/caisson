# @caisson-sh/agent-dev

## 0.6.12

### Patch Changes

- Updated dependencies [4954dc1]
- Updated dependencies [fa815fc]
- Updated dependencies [e58ddc3]
  - @caisson-sh/kernel@0.10.2
  - @caisson-sh/agent-kernel@0.8.2
  - @caisson-sh/agent-runner@0.3.4
  - @caisson-sh/ai-config@0.3.12
  - @caisson-sh/local-store@1.1.4
  - @caisson-sh/tool-exec@0.4.2

## 0.6.11

### Patch Changes

- eb2648e: Source comments no longer describe these packages or their parts as paid, commercial or sellable.
- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/ai-config@0.3.11
  - @caisson-sh/agent-kernel@0.8.1
  - @caisson-sh/agent-runner@0.3.3
  - @caisson-sh/kernel@0.10.1
  - @caisson-sh/local-store@1.1.3
  - @caisson-sh/tool-exec@0.4.1

## 0.6.10

### Patch Changes

- Updated dependencies [045b21e]
- Updated dependencies [f02b193]
- Updated dependencies [f02b193]
- Updated dependencies [87b07c6]
- Updated dependencies [ac1a1a4]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/local-store@1.1.2
  - @caisson/agent-runner@0.3.2
  - @caisson/tool-exec@0.4.0
  - @caisson/kernel@0.10.0
  - @caisson/agent-kernel@0.8.0
  - @caisson/ai-config@0.3.10

## 0.6.9

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
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/agent-kernel@0.7.1
  - @caisson/local-store@1.1.1
  - @caisson/agent-runner@0.3.1
  - @caisson/ai-config@0.3.9
  - @caisson/tool-exec@0.3.1

## 0.6.8

### Patch Changes

- Updated dependencies [03ca530]
- Updated dependencies [42d9710]
- Updated dependencies [f368318]
- Updated dependencies [7d74f8f]
  - @caisson/agent-runner@0.3.0
  - @caisson/tool-exec@0.3.0
  - @caisson/local-store@1.1.0
  - @caisson/agent-kernel@0.7.0
  - @caisson/kernel@0.8.0
  - @caisson/ai-config@0.3.8

## 0.6.7

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/agent-kernel@0.6.5
  - @caisson/agent-runner@0.2.7
  - @caisson/ai-config@0.3.7
  - @caisson/local-store@1.0.6
  - @caisson/tool-exec@0.2.5

## 0.6.6

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
  - @caisson/kernel@0.6.0
  - @caisson/agent-kernel@0.6.4
  - @caisson/agent-runner@0.2.6
  - @caisson/local-store@1.0.5
  - @caisson/ai-config@0.3.6
  - @caisson/tool-exec@0.2.4

## 0.6.5

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/agent-kernel@0.6.3
  - @caisson/agent-runner@0.2.5
  - @caisson/ai-config@0.3.5
  - @caisson/kernel@0.5.3
  - @caisson/local-store@1.0.4
  - @caisson/tool-exec@0.2.3

## 0.6.4

### Patch Changes

- @caisson/agent-runner@0.2.4

## 0.6.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/agent-kernel@0.6.2
  - @caisson/agent-runner@0.2.3
  - @caisson/ai-config@0.3.4
  - @caisson/local-store@1.0.3
  - @caisson/tool-exec@0.2.2

## 0.6.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/agent-kernel@0.6.1
  - @caisson/agent-runner@0.2.2
  - @caisson/ai-config@0.3.3
  - @caisson/local-store@1.0.2
  - @caisson/tool-exec@0.2.1

## 0.6.1

### Patch Changes

- Updated dependencies [c3b0e41]
  - @caisson/tool-exec@0.2.0
  - @caisson/agent-runner@0.2.1

## 0.6.0

### Minor Changes

- 586916f: Skills can now ship bundled files. A skill artifact gains three optional maps — `references` and `assets` for supporting docs and static files, and `scripts` for executable helpers — each a relative path plus its content. The multi-harness emitter writes them into every SKILL.md directory it produces.

  Executable content is trust-tiered. The curated default skill set always emits its scripts; scripts on a skill set you supply yourself are held back unless you pass `allowScripts`, and any withheld scripts are reported rather than dropped silently. References and assets always emit. All three fields are optional, so skills authored before this release are unaffected.

### Patch Changes

- Updated dependencies [586916f]
  - @caisson/agent-kernel@0.6.0

## 0.5.0

### Minor Changes

- ce1e576: Emit skills as agentskills.io SKILL.md directories. Claude Code skills move from the flat `.claude/skills/<name>.md` to `.claude/skills/<name>/SKILL.md`, and a new universal `.agents/skills/<name>/SKILL.md` cross-tool surface (Codex's current home, Cursor-compatible) is emitted with byte-identical SKILL.md content. The SKILL.md frontmatter now renders the optional portability fields (license, compatibility, space-separated allowed-tools, nested metadata) when a skill sets them. The AGENTS.md aggregate and every other target are unchanged; a skill whose activation cannot be represented on the `.agents` surface raises a fidelity warning rather than degrading silently.

### Patch Changes

- Updated dependencies [ce1e576]
  - @caisson/agent-kernel@0.5.0

## 0.4.3

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/agent-runner@0.2.0

## 0.4.2

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/agent-kernel@0.4.2
  - @caisson/agent-runner@0.1.6
  - @caisson/ai-config@0.3.2
  - @caisson/local-store@1.0.1
  - @caisson/tool-exec@0.1.7

## 0.4.1

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [329150a]
- Updated dependencies [679cce6]
- Updated dependencies [1bc677a]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3
  - @caisson/local-store@1.0.0
  - @caisson/ai-config@0.3.1
  - @caisson/agent-kernel@0.4.1
  - @caisson/agent-runner@0.1.5
  - @caisson/tool-exec@0.1.6

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

### Patch Changes

- The two retired-alias meta packages now advertise their alias target's locked bundle price in
  the registry manifest ($739 for the AI Production Kit, $329 for Agentic-Dev), replacing the
  old pre-launch placeholder numbers. Purchasing behavior is unchanged — both ids keep resolving
  to their bundles exactly as before.
- Updated dependencies [8c53ca3]
- Updated dependencies [8c53ca3]
  - @caisson/agent-kernel@0.4.0
  - @caisson/ai-config@0.3.0

## 0.3.0

### Minor Changes

- b791198: The Agentic-Dev edition now re-exports the sandboxed agent-runner surface (createAgentRunner, buildEngineEnv, run summaries, and the runner config types) from the edition's single import home, completing the composition the edition manifest already declares. Runner provider configuration types are exposed as AgentRunnerProviderConfig / AgentRunnerProviderConfigInput to avoid clashing with the AI-config provider types.

### Patch Changes

- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [4d7eb71]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [5349b63]
  - @caisson/agent-kernel@0.3.1
  - @caisson/agent-runner@0.1.4
  - @caisson/ai-config@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/local-store@0.2.4
  - @caisson/tool-exec@0.1.5

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/agent-kernel@0.3.0
  - @caisson/agent-runner@0.1.3
  - @caisson/ai-config@0.2.3
  - @caisson/local-store@0.2.3
  - @caisson/tool-exec@0.1.4

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/agent-kernel@0.2.2
  - @caisson/agent-runner@0.1.2
  - @caisson/ai-config@0.2.2
  - @caisson/local-store@0.2.2
  - @caisson/tool-exec@0.1.3

## 0.2.1

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
- Updated dependencies [ea52d1f]
- Updated dependencies [9558a46]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [623d07c]
- Updated dependencies [549dd4e]
  - @caisson/agent-runner@0.1.1
  - @caisson/ai-config@0.2.1
  - @caisson/kernel@0.3.0
  - @caisson/local-store@0.2.1
  - @caisson/agent-kernel@0.2.1
  - @caisson/tool-exec@0.1.2

## 0.2.0

### Minor Changes

- a07feb0: Fold the Stage-2 harvest primitives into the edition member pin maps (ADR-0178): Compliance now bundles
  `@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`, so buyers
  get them at the edition price (matches the ADR-0137 below-module-sum reprice).

  Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
  `@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
  extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
  (dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 22077d1: Hardening pass: emitted buyer CI templates now get least-privilege `permissions:` +
  `persist-credentials: false`; the agent-dev emitter YAML-escapes all free-text frontmatter so the
  `tools:` allowlist can't be suppressed by a crafted value; and the sandboxed `@caisson/tool-exec`
  gate is now wired live into the Agentic-Dev edition composition.
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/agent-kernel@0.2.0
  - @caisson/ai-config@0.2.0
  - @caisson/local-store@0.2.0
  - @caisson/tool-exec@0.1.1
