# @caisson-sh/prompt-registry

## 1.1.4

### Patch Changes

- Updated dependencies [4954dc1]
- Updated dependencies [fa815fc]
- Updated dependencies [304851a]
- Updated dependencies [e58ddc3]
  - @caisson-sh/kernel@0.10.2
  - @caisson-sh/tenancy-rls@0.6.3

## 1.1.3

### Patch Changes

- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/tenancy-rls@0.6.2
  - @caisson-sh/kernel@0.10.1
  - @caisson-sh/ui@0.6.8

## 1.1.2

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/ui@0.6.7
  - @caisson/kernel@0.10.0

## 1.1.1

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
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/ui@0.6.6
  - @caisson/tenancy-rls@0.6.0

## 1.1.0

### Minor Changes

- 5d1f295: The prompt registry gains a browser-safe `./browser` entry point: `name@version` and `name@alias`
  addressing plus the injection-safe render boundary and its strict variable schemas can now be
  imported inside a client bundle. The registry functions and the schema stay off that entry
  deliberately, each one takes a tenant executor and runs SQL, so fail-closed tenant isolation stays
  on the server. The main entry is unchanged and keeps the full surface; every browser-entry export
  is also available there. The site's prompt-registry interactive demo now runs that real addressing
  and versioning logic instead of a hand-maintained copy.

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [68df709]
- Updated dependencies [7d74f8f]
  - @caisson/ui@0.6.5
  - @caisson/kernel@0.8.0
  - @caisson/tenancy-rls@0.5.8

## 1.0.6

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [b5cd9d6]
  - @caisson/kernel@0.7.0
  - @caisson/ui@0.6.4
  - @caisson/tenancy-rls@0.5.7

## 1.0.5

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [6d1c805]
- Updated dependencies [a00a9ef]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [2cd4184]
- Updated dependencies [6d1c805]
- Updated dependencies [56e46f1]
  - @caisson/ui@0.6.3
  - @caisson/kernel@0.6.0
  - @caisson/tenancy-rls@0.5.6

## 1.0.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/ui@0.6.2
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

## 1.0.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/tenancy-rls@0.5.4

## 1.0.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/tenancy-rls@0.5.3

## 1.0.1

### Patch Changes

- e183860: Unify the workspace on zod 4 (catalog flip; the zod4 sub-catalog is retired). Explicit key schemas on every z.record call, and the ZodObject generic signatures drop the v3 "strict" type parameter. Runtime validation behavior is unchanged apart from zod 4's tightened RFC-4122 uuid and email format checks, verified against the money and license seams.
- Updated dependencies [e5e4311]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/ui@0.6.1
  - @caisson/tenancy-rls@0.5.2

## 1.0.0

### Minor Changes

- 1bc677a: Add an optional embeddable prompt browser at the `@caisson/prompt-registry/ui` subpath. It lists
  your registered prompt versions with their role shape, variable count, and a one-line preview, and
  splits distinct prompt names from total versions so the append-only version history stays legible.
  The surface renders only the versions you hand it — no tenant executor, no database. Presentational
  and server-render safe; composes the `@caisson/ui` kit. Importing the package root stays React-free.

### Patch Changes

- Updated dependencies [08fd857]
- Updated dependencies [0137008]
- Updated dependencies [2b65cf3]
- Updated dependencies [5a8b317]
- Updated dependencies [8253e76]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [47e04fd]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b43959c]
  - @caisson/ui@0.6.0
  - @caisson/kernel@0.4.3
  - @caisson/tenancy-rls@0.5.1

## 0.2.5

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/tenancy-rls@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 22077d1: Hardening pass (2026-07-01): emitted buyer CI templates get
  least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
  messages collapse to one generic reason (oracle closed); judgeGrader validates live judge
  verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
  strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
  free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
  is wired into the Agentic-Dev edition (ADR-0199, honoring ADR-0178); guardrails cheapDeny is
  stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
  values and total rendered content. Additional coverage was also added for the admin control
  plane, metering/BYOK paths, destructive job flows, composition roots, and WORM integrity.
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/tenancy-rls@0.2.0
