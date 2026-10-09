# @caisson-sh/mcp-server

## 1.0.0

### Major Changes

- 611f1de: `BuyerToken` is renamed `ClientToken`.

### Minor Changes

- 73bdf3c: The server no longer scopes tools by entitlement. Every registered tool is listed and callable by any authenticated caller, `list_modules` returns the whole catalog, `describe_module` returns the module's latest version and description, and `generate` takes a project name and modules. Bearer authentication is unchanged: tokens are still compared in constant time, and a missing or wrong token is refused. `BuyerToken` is now `{ token, accountId }`, and `requiredEntitlement` is gone from tool, resource and prompt registrations.

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 73bdf3c: `createMcpServer` now refuses an empty Bearer token, or one shorter than 32 characters, when the server is built, so a guessable token can never go live. The error names the account and never the token. The stdio and HTTP transports and `createRateLimitedMcpServer` all build through it. Token comparison is unchanged.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/ai-config@0.3.11
  - @caisson-sh/ds-manifest@0.3.5
  - @caisson-sh/kernel@0.10.1
  - @caisson-sh/ui@0.6.8
  - @caisson-sh/registry-schema@0.6.0

## 0.6.11

### Patch Changes

- Updated dependencies [97ec962]
- Updated dependencies [cd694f1]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/ds-manifest@0.3.4
  - @caisson/registry-schema@0.5.12
  - @caisson/ui@0.6.7
  - @caisson/kernel@0.10.0
  - @caisson/ai-config@0.3.10

## 0.6.10

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
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
- Updated dependencies [c10e3b6]
  - @caisson/kernel@0.9.0
  - @caisson/ui@0.6.6
  - @caisson/registry-schema@0.5.11
  - @caisson/ds-manifest@0.3.3
  - @caisson/ai-config@0.3.9

## 0.6.9

### Patch Changes

- Updated dependencies
  - @caisson/registry-schema@0.5.10

## 0.6.8

### Patch Changes

- Updated dependencies [fab7a0d]
- Updated dependencies [98bf1f3]
- Updated dependencies [68df709]
- Updated dependencies [7d74f8f]
  - @caisson/ds-manifest@0.3.2
  - @caisson/ui@0.6.5
  - @caisson/kernel@0.8.0
  - @caisson/ai-config@0.3.8
  - @caisson/registry-schema@0.5.9

## 0.6.7

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [b5cd9d6]
  - @caisson/ds-manifest@0.3.1
  - @caisson/registry-schema@0.5.9
  - @caisson/kernel@0.7.0
  - @caisson/ui@0.6.4
  - @caisson/ai-config@0.3.7

## 0.6.6

### Patch Changes

- Updated dependencies [6d1c805]
- Updated dependencies [25fd03c]
- Updated dependencies [a00a9ef]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [2cd4184]
- Updated dependencies [a21c478]
- Updated dependencies [108a358]
- Updated dependencies [6d1c805]
- Updated dependencies [56e46f1]
  - @caisson/ui@0.6.3
  - @caisson/registry-schema@0.5.8
  - @caisson/ds-manifest@0.3.0
  - @caisson/kernel@0.6.0
  - @caisson/ai-config@0.3.6

## 0.6.5

### Patch Changes

- Updated dependencies [31d59fd]
  - @caisson/registry-schema@0.5.7

## 0.6.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/ui@0.6.2
  - @caisson/ai-config@0.3.5
  - @caisson/ds-manifest@0.2.2
  - @caisson/kernel@0.5.3
  - @caisson/registry-schema@0.5.6

## 0.6.3

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/registry-schema@0.5.5

## 0.6.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/ai-config@0.3.4

## 0.6.1

### Patch Changes

- Updated dependencies [5d03808]
- Updated dependencies [7de6fa4]
  - @caisson/registry-schema@0.5.4
  - @caisson/kernel@0.5.1
  - @caisson/ai-config@0.3.3

## 0.6.0

### Minor Changes

- c7476b9: You can now start a governed agent run and check its status without writing any code. The
  `caisson run start "<prompt>"` command opens a bounded, metered run through your own gateway and
  prints the result — including a pause for review if the model wants to use a tool that needs
  approval. A matching pair of agent-facing tools, `run_start` and `run_status`, is available from
  your buyer MCP server for an AI agent to call directly, gated behind the same licensed entitlement
  as the rest of the runtime. Neither surface ever exposes the raw parked-run snapshot; status
  reporting only ever shows the run's state and its trajectory.

### Patch Changes

- Updated dependencies [f40653b]
  - @caisson/registry-schema@0.5.3

## 0.5.1

### Patch Changes

- Updated dependencies [f844386]
  - @caisson/ds-manifest@0.2.1

## 0.5.0

### Minor Changes

- 3667926: Add an MCP prompts surface to the buyer MCP, the prompt-side mirror of the tool and resource
  registries. Prompts are entitlement-scoped exactly like tools and resources (a prompt a caller is not
  entitled to is invisible: prompts/list omits it and prompts/get returns the same not-found an unknown
  name gets), rate-limited through the same per-account hook, and served under the same timing-safe
  Bearer gate. Each prompts/get validates the caller's arguments against the prompt's declared argument
  set — a missing required argument and any undeclared extra key are both rejected — before rendering.
  Both transports (stdio and Streamable-HTTP) now advertise the prompts capability and wire
  prompts/list and prompts/get.

  Three prompts ship: integrate_module (open to any authenticated buyer) narrates a describe_module
  then generate recipe for adding one purchased module to a project and validates the module against
  the registry allowlist up front; setup_ai_config (ai-kit tier) is the guided inspect_env,
  propose_ai_config, validate_setup, write_forge_config walkthrough; and compliance_evidence_walkthrough
  (compliance tier) renders a generate recipe for the compliance edition plus where framework evidence
  assembly lives. Prompts carry provider and module identifiers only, never a secret value, so they stay
  secrets-safe by construction like the coach tools they narrate.

## 0.4.0

### Minor Changes

- 0dbb9f7: Add a readable MCP resources surface to the buyer MCP, the read-side mirror of the tool registry.
  Resources are entitlement-scoped exactly like tools (a resource a caller is not entitled to is
  invisible: resources/list omits it and resources/read returns the same not-found an unknown URI
  gets), rate-limited through the same per-account hook, and served under the same timing-safe Bearer
  gate. Both transports (stdio and Streamable-HTTP) now advertise the resources capability and wire
  resources/list and resources/read. URIs follow a stable caisson://<namespace>/<name> scheme:
  caisson://registry/index serves the full module registry catalog to any authenticated buyer, and —
  when the host wires a design-system manifest — caisson://design-system/components and
  caisson://design-system/tokens are open, with a caisson://design-system/pro-components roster gated
  on the pro tier. The design-system resources front the same pure read functions the design-system
  tools use, so it is one data layer behind two protocol fronts.

## 0.3.2

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2

## 0.3.1

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/registry-schema@0.5.1

## 0.3.0

### Minor Changes

- 7f68b56: Add the agent-ready design-system tools to the buyer MCP: three base read tools
  (list_components / describe_component / get_tokens) any authenticated buyer can call to discover the
  open @caisson/ui kit, plus an entitlement-gated check_usage static doctor (on a dedicated doctor
  slug) and an optional gated describe_pro_component. Ships a local stdio-only discovery server that
  exposes the three read tools over the Apache-base manifest with no auth and no network listener, and
  a runnable discovery entry an agent configures as a local MCP.

### Patch Changes

- a8696cf: Keep the Bun HTTP server callback compatible with the Node 26 request type declarations.
- Updated dependencies [7f68b56]
- Updated dependencies [e5e4311]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/ds-manifest@0.2.0
  - @caisson/kernel@0.5.0
  - @caisson/ui@0.6.1
  - @caisson/ai-config@0.3.2
  - @caisson/registry-schema@0.5.0

## 0.2.6

### Patch Changes

- 8670f38: Audit coverage and gate-test correctness fixes. The audit-harness domain partition now sweeps
  loose files at the tooling, infra, and tools container roots into a per-container root domain,
  so a script added directly under one of those directories can no longer escape the coverage
  gate; its test task is also marked uncacheable because the gate reads the whole repository tree.
  The MCP server's entitlement gate test is re-pinned to the current catalog vocabulary: a
  dissolved edition id resolves only as its indexed meta-package and no longer grants that
  edition's member modules, which are denied fail-closed; the current bundle ids remain the way a
  purchase grants its member set.
- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.
- Updated dependencies [3d23da7]
- Updated dependencies [9a81dd7]
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
- Updated dependencies [99d665a]
- Updated dependencies [ab352ab]
- Updated dependencies [4d85f28]
  - @caisson/registry-schema@0.5.0
  - @caisson/kernel@0.4.3
  - @caisson/ai-config@0.3.1

## 0.2.5

### Patch Changes

- Updated dependencies [8170382]
- Updated dependencies [8c53ca3]
  - @caisson/registry-schema@0.4.0
  - @caisson/ai-config@0.3.0

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- d6cc28e: Adds the bundle vocabulary spine: a new additive "bundle" module kind (historical edition entries stay valid), the shared BUNDLE_IDS constant plus the legacy-purchased-id alias map with normalizeEntitlementId, and resolve-time alias normalization at the single entry point inside expandEntitlements — legacy edition and bundle-sentinel purchase ids keep resolving to the identical leaf sets forever, and a kind:"bundle" index entry expands via its members map exactly like an edition. The mcp-server change is test-only coverage of the alias and bundle paths through the generate gate.
- 6e48b18: The HTTP MCP transport now rejects a wildcard origin at server construction — an
  `allowedOrigins` allowlist containing a bare `"*"` throws immediately instead of being
  accepted, so a misconfigured deployment can never silently open MCP tool calls to every
  origin. Every response from the HTTP handler (success, auth failure, and body-parse
  error paths) also now carries the standard security response headers
  (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [d6cc28e]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [850b844]
- Updated dependencies [31d6a41]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/ai-config@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/registry-schema@0.3.0

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/ai-config@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/ai-config@0.2.2

## 0.2.1

### Patch Changes

- c98d07b: ADR-0216: `ToolRegistration` gains a Zod-validated declarative manifest
  (`description`/`version`/`audit.logArgs`) checked in `registerTool()` before the
  duplicate-name guard, so a malformed manifest is a registration-time `ValidationError`,
  never a call-time surprise; all 7 existing registrations (3 base + 4 coach) are
  annotated (`logArgs: false` on every coach tool — unchanged secrets-safe posture).
  `listTools` now returns `readonly ToolRegistration[]` (both callers already only read
  `.name`); `stdio.ts`/`http.ts` surface `description` in `ListToolsRequestSchema`. New
  append-only retired-tool ledger: `retireTool()` + a `RetiredToolError` (410,
  `{reason, retiredAt}`) checked in `handleToolCall` before the existing `NotFoundError` —
  a deliberately-retired tool now answers a distinct, actionable error instead of the same
  404 an unknown tool gets. No auth/entitlement/rate-limit logic touched.
- Updated dependencies [b5915e0]
- Updated dependencies [9558a46]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/registry-schema@0.2.1
  - @caisson/ai-config@0.2.1
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 22077d1: Whole-repo audit round-3 remediation (ledger 2026-07-01): emitted buyer CI templates get
  least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
  messages collapse to one generic reason (oracle closed); judgeGrader validates live judge
  verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
  strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
  free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
  is wired into the Agentic-Dev edition (ADR-0199, honoring ADR-0178); guardrails cheapDeny is
  stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
  values and total rendered content. Plus the round-4/5 audit domains (admin-plane,
  metering-byok, destructive-jobs, composition-roots, worm-integrity) added to AUDIT_DOMAINS.
- Updated dependencies [72ffd85]
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/registry-schema@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/ai-config@0.2.0
