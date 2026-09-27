# @caisson/audit-harness

## 1.0.4

### Patch Changes

- 784a846: The home page's repository tree shows the apps that exist today, and the release pipeline publishes every package through npm trusted publishing.
- 73bdf3c: The site, demos and internal tooling follow the move to Apache-2.0: the gate now requires every published package to be Apache-2.0 with its LICENSE file, the commerce and entitlement checks are gone, and the docs install everything from public npm.
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/ui@0.6.8

## 1.0.3

### Patch Changes

- ecfa65e: Adds a static test guarding the image-publish pipeline's vulnerability-scan posture. The shared CI template that publishes container images records CVE findings but never blocks a publish on them by default, relying on a repository variable being left unset — a choice documented only in prose until now. The new test reads the template and the security playbook directly and fails if the template's default ever flips, or if the playbook section documenting the choice disappears, so a silent posture change can no longer pass unnoticed.
- Updated dependencies [cd694f1]
  - @caisson/ui@0.6.7

## 1.0.2

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

- b0e66b6: Move the internal audit harness and shared component demo catalog into the tooling workspace namespace. Package names and import paths are unchanged.
- Updated dependencies [2405d9e]
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
  - @caisson/ui@0.6.6

## 1.0.1

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/ui@0.6.2

## 1.0.0

### Minor Changes

- 1bc677a: Add an optional embeddable matrix viewer at the `@caisson/audit-harness/ui` subpath for the tooling
  app. It pivots the coverage rows into a domain-by-dimension grid (latest round wins) and lists the
  reconciled findings, with an open / high-severity headline up top. The surface renders only the
  findings and coverage handed to it — no run, no filesystem — and composes the `@caisson/ui` kit.
  Importing the package root stays React-free.

### Patch Changes

- 8670f38: Audit coverage and gate-test correctness fixes. The audit-harness domain partition now sweeps
  loose files at the tooling, infra, and tools container roots into a per-container root domain,
  so a script added directly under one of those directories can no longer escape the coverage
  gate; its test task is also marked uncacheable because the gate reads the whole repository tree.
  The MCP server's entitlement gate test is re-pinned to the current catalog vocabulary: a
  dissolved edition id resolves only as its indexed meta-package and no longer grants that
  edition's member modules, which are denied fail-closed; the current bundle ids remain the way a
  purchase grants its member set.
- b63d107: Update the root-docs coverage domain to the slimmed root allowlist (README.md, CLAUDE.md, AGENTS.md) after the 2026-07-11 docs-surface phase moved PRODUCT/DESIGN/plan/SUMMARY under docs/.
- Updated dependencies [08fd857]
- Updated dependencies [0137008]
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

## 0.1.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).

## 0.1.0

### Minor Changes

- 56c9be2: audit-harness v2: replace the hand-grown domain list with a mechanically derived,
  coverage-gated partition. `deriveDomains(root)` emits one domain per tree unit and
  `coverage-gate.test.ts` fails loud on any unclaimed or double-claimed unit, so a run can no longer
  grow its scope mid-flight. Adds the orthogonal DIMENSION axis (D1..D7 in `dimensions.ts`) with a
  sparse class-driven applicability matrix, a dimension-keyed `stableId`
  (`domain ∷ dimension ∷ subject ∷ title`), a `reconcile()` that throws on an id collision or an
  out-of-universe domain instead of silently dropping a finding, and a per-round coverage ledger
  (`coverage.ts`) with an explicit `isRoundDry()` loop-termination predicate. Internal tooling,
  non-blocking to a merge.

## 0.0.2

### Patch Changes

- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.

## 0.0.1

### Patch Changes

- c192c80: Extend AUDIT_DOMAINS with the round-2 surfaces the first-run globs never reached (python-services, iac-authz, ci-supply-chain, telemetry-egress, financial-integrity, registry-edge) and the round-3 surfaces the completeness critic named (generator-templates, auth-boundary, email-egress, ai-evals-integrity, mcp-transport, agent-governance, guardrails-prompts). Declaration-only data change.
- c1ed657: ADR-0188 pipeline completion for the internal (private, unsold) `@caisson/audit-harness`:
  the scoped `reconcile(previous, current, scope)` correctness fix (out-of-scope domains pass through —
  no silent cross-domain false-close), the `--domains` fail-loud CLI, and the pure enablers
  (`enumerateSurface` / `selectValidateCandidates` / `summarize`) + `check-scope`/`report` subcommands.
  Private package — versioned locally, never published.
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
- a07feb0: Fold the Stage-2 harvest primitives into the edition member pin maps (ADR-0178): Compliance now bundles
  `@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`, so buyers
  get them at the edition price (matches the ADR-0137 below-module-sum reprice).

  Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
  `@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
  extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
  (dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.
