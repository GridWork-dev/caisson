# @caisson/rate-limit

## 0.2.1

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0
  - @caisson/mcp-server@0.6.11

## 0.2.0

### Minor Changes

- 2405d9e: Add `createRateLimitedMcpServer`, a public composition factory that wires the RLS-scoped account throttle into `@caisson/mcp-server`, preserves caller overrides, and reports store failures without locking buyers out.

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
  - @caisson/mcp-server@0.6.10
  - @caisson/tenancy-rls@0.6.0

## 0.1.10

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0
  - @caisson/tenancy-rls@0.5.8

## 0.1.9

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/tenancy-rls@0.5.7

## 0.1.8

### Patch Changes

- 96aa01d: Document caller-owned limiter infrastructure-failure policy while the license service now fails
  open only for Paddle webhooks and fails protected issuer, admin, and evaluation routes closed.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/tenancy-rls@0.5.6

## 0.1.7

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

## 0.1.6

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/tenancy-rls@0.5.4

## 0.1.5

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/tenancy-rls@0.5.3

## 0.1.4

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/tenancy-rls@0.5.2

## 0.1.3

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

## 0.1.2

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0

## 0.1.1

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 850b844: Moved the per-account throttle store out of the commercial license service and into the
  new shared, freely licensed rate-limiting package. The open reference application now
  composes this shared store directly for its buyer-facing throttling instead of depending
  on the commercial license service to get it. Buyer-visible throttling behavior is
  unchanged; this only changes where the code lives and removes an unnecessary dependency
  from the open reference application.
- 850b844: Added a new shared rate-limiting package with an in-memory per-client-IP throttle for
  surfaces with no signed-in identity yet. The docs and license services now both import
  this shared limiter instead of each keeping a separate copy of the same logic. The
  internal licensing-boundary check also now recognizes the new package as part of the
  open, freely licensed base set. Buyer-visible throttling behavior, including the limits,
  the retry timing, and which header is trusted for the client IP, is unchanged; this only
  changes where the code lives.
- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0
