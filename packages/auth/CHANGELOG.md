# @caisson/auth

## 0.4.6

### Patch Changes

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
  - @caisson-sh/tenancy-rls@0.6.2
  - @caisson-sh/kernel@0.10.1

## 0.4.5

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0

## 0.4.4

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
  - @caisson/tenancy-rls@0.6.0

## 0.4.3

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0
  - @caisson/tenancy-rls@0.5.8

## 0.4.2

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/tenancy-rls@0.5.7

## 0.4.1

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/tenancy-rls@0.5.6

## 0.4.0

### Minor Changes

- b8b14b4: Session tokens are now stored hashed at rest: buyer session cookies are looked up by an
  HMAC-SHA-256 lookup key instead of the raw bearer token, so a database export alone is no
  longer a usable session credential. This ships as a one-time hard cutover — every
  currently-signed-in buyer is signed out and simply signs back in.

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

## 0.3.5

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/tenancy-rls@0.5.4

## 0.3.4

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/tenancy-rls@0.5.3

## 0.3.3

### Patch Changes

- a8696cf: Remove redundant assignments and retain original errors when wrapping failures under the ESLint 10 recommended rules.
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/tenancy-rls@0.5.2

## 0.3.2

### Patch Changes

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
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3
  - @caisson/tenancy-rls@0.5.1

## 0.3.1

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0

## 0.3.0

### Minor Changes

- 0c883ae: The org module carve: ONE merged commercial package
  `@caisson/org-controls` at $249 (tier `paid`, priceCents 24900, `LicenseRef-Caisson-Commercial`).
  It absorbs three surfaces out of the open Base:

  - **WorkOS SSO** (`createWorkosSsoProvider`) from `@caisson/auth` (zero live consumers).
  - The **owner-gated MANAGE membership** surface (`listAccountMembers` / `addAccountMember` /
    `assertCanManageMembers`) from `@caisson/auth`. The login-critical session-resolution half
    (`resolveUserAccounts` / `ensurePersonalAccount` / `selectActiveAccount`) STAYS in open
    `@caisson/auth` — it runs on every buyer login.
  - The **full 6-export admin-write RLS layer** (`withAdminWrite` / `buildAdminWritePolicySql` /
    `buildAdminSelectPolicySql` / `ADMIN_WRITE_ROLE` / `ADMIN_WRITE_ROLE_BOOTSTRAP_SQL` /
    `AdminWritePolicyOptions`) from `@caisson/tenancy-rls`. The fail-closed privileged-role guard is
    DUPLICATED into org-controls (file-private) rather than exported, keeping the open tenancy-rls API
    unchanged. Buyer tenant isolation (`withTenant` / `withUser` / `buildTenantPolicySql`) stays open.

  Plus a new fail-closed `/dashboard/members` entitlement gate (`holdsOrgControls`) — the surface is
  gated on the org-controls entitlement, denying to an upsell state. `@caisson/auth` and
  `@caisson/tenancy-rls` stay Apache-2.0 at their now-narrower surfaces (no OPEN_BASE_NAMES change).

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
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

- 9483a36: Initial public release (0.1.0). The open Base substrate (Apache-2.0) publishes to
  public npm; the commercial editions, primitives, and generator publish to a restricted
  registry. Versions were aligned to 0.1.0 for this release.

### Patch Changes

- 22077d1: Security hardening: account-token verification failures now collapse to one
  generic reason instead of leaking which check failed; judge-graded verdicts validate
  fail-closed and judge output is bounded; MCP module generation bounds its id/version
  strings against oversized input; the agent-dev config emitter escapes free-text
  frontmatter so its tool allowlist can't be suppressed; the guardrails deny-list check is
  stateless across calls; prompt rendering bounds template-variable and total output size.
- a07feb0: Compliance now bundles `@caisson/alerting` and `@caisson/retention-runner`, and
  Agentic-Dev bundles `@caisson/tool-exec`, at no extra cost over the edition price.

  Also: `@caisson/auth`'s manifest now declares its real `@caisson/tenancy-rls` dependency
  (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto` extracts the
  `KmsClient` port to a leaf `kms-port.ts` to break a type cycle between its KMS modules.
  `KmsClient` is still re-exported from `kms.ts` for back-compat.

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/tenancy-rls@0.2.0
