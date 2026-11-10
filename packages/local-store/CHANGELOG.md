# @caisson-sh/local-store

## 1.1.4

### Patch Changes

- Updated dependencies [4954dc1]
- Updated dependencies [fa815fc]
- Updated dependencies [e58ddc3]
  - @caisson-sh/kernel@0.10.2

## 1.1.3

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
  - @caisson-sh/ui@0.6.8

## 1.1.2

### Patch Changes

- 045b21e: The reference cloud embedder now validates the destination, not just the scheme. Its config schema proved the endpoint was https and nothing more, so a private, loopback or cloud-metadata address was a valid endpoint and the embedder would POST the configured Bearer credential to it. The shared public-host guard already used by four sibling egress sinks now runs once at construction, and the credential-bearing request refuses to follow redirects so a 3xx cannot re-target it past that check. The check is deliberately literal-host only and construction-time: the embedder wraps per text, so a name-resolving check on that path would cost a lookup per embedded string and break split-horizon deployments.

  The alerting webhook adapter now sends the standard security headers on every response rather than only a content type. All of its return paths, including the unauthorized one, share a single response constructor, so the headers apply by construction; a test now sweeps each status path individually rather than sampling the success case.

  The external timestamping client refuses redirects on submission. Its acceptance of cleartext and private-network endpoints is unchanged and now has a test pinning that behaviour, because only a hash is transmitted, trust comes from verifying the signed response rather than from the transport, and an internal timestamp authority is a supported deployment — applying a public-host restriction there would break both mainstream public authorities and self-hosted buyers.

  One comment corrected: the agent runner's endpoint check describes admitting cleartext for loopback providers, while the code admits it for any host. The code is right — named service endpoints are the common local deployment — and the comment now says so.

- f02b193: Resolve and reject private DNS destinations before every credential-bearing cloud embedding request.
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/ui@0.6.7
  - @caisson/kernel@0.10.0

## 1.1.1

### Patch Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
- b0e66b6: Clarify the internal module boundaries for local embed scrubbing and AI token-rate normalization. Public exports and runtime behavior are unchanged.
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

## 1.1.0

### Minor Changes

- 42d9710: The Reciprocal Rank Fusion arithmetic is now a public function, `fuseByRrf`, exported from the main
  entry alongside `RRF_K` and from a new browser-safe `./browser` entry point. Hand it leg rankings
  your server or worker already produced and it returns the fused ranking — the same function
  `hybridSearch` merges its vector and keyword legs through, so there is one implementation rather
  than a formula restated per call site, and it runs inside a client bundle. Retrieval itself stays
  on the main entry: the vec0 KNN and FTS5 legs need SQLite and its vector extension. Ranking,
  scores, and tie-breaks are unchanged. The site's local-store interactive demo now runs that real
  fusion instead of a hand-maintained copy. Invalid limits now fail closed: `fuseByRrf` rejects
  negative, non-integer, and non-finite values instead of letting `Array.slice` turn them into a
  plausible truncated or empty ranking.

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [68df709]
- Updated dependencies [7d74f8f]
  - @caisson/ui@0.6.5
  - @caisson/kernel@0.8.0

## 1.0.6

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [b5cd9d6]
  - @caisson/kernel@0.7.0
  - @caisson/ui@0.6.4

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

## 1.0.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/ui@0.6.2
  - @caisson/kernel@0.5.3

## 1.0.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 1.0.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 1.0.1

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/ui@0.6.1

## 1.0.0

### Minor Changes

- 679cce6: `hybridSearch` gains an `ftsWeight` option: the FTS leg's reciprocal-rank
  contribution is scaled by `ftsWeight / (RRF_K + rank)` so callers can damp or boost
  lexical matches against the vector leg without forking the fusion. Default is 1 —
  byte-identical scores to the previous behavior — and a non-positive or non-finite
  weight throws a ValidationError.
- 1bc677a: Add an optional embeddable search surface at the `@caisson/local-store/ui` subpath. It pairs a
  controlled query box with a ranked results table, distinguishing "type to search" from "no matches"
  so a blank query never reads as an empty store. Your app runs the retrieval and hands the hits in —
  the surface opens no tenant database and calls no embedder. Presentational and server-render safe;
  composes the `@caisson/ui` kit. Importing the package root stays React-free.

### Patch Changes

- 329150a: Fixed a retrieval bug that silently killed the FTS leg of hybrid search for every multi-word
  query: caller text was wrapped as a single FTS5 phrase, which required all the query's tokens to
  appear adjacent and in order in a document. A natural-language query like "refund policy" or
  "how do I install" matched zero rows, leaving retrieval to the vector leg alone (or returning
  nothing on the FTS floor). Queries are now sanitized per token — each whitespace-split token is
  individually quoted and OR-joined — so FTS operators in caller text stay inert while multi-word
  queries match documents containing any of the terms, ranked by bm25.
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

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 4d7eb71: Add LocalStore.list({ limit, offset }) — a bounded, newest-first page over the docs table for
  read-only consumers (the agent-dev inspector's /memory route) that want "what's in
  here" rather than a ranked hybridSearch query. Limit and offset are clamped, never thrown on.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- e62c88d: ADR-0215: guardrails' `guard.ts` gains an unconditional `"secret"`
  `GuardCategory` — a credential-shaped span (AWS/GitHub/OpenAI keys, JWTs, PEM blocks, secret-named
  assignments, URL userinfo passwords) now blocks at the cheap pre-screen tier, before the (possibly
  outaged) `Moderator` ever runs, closing the named egress-secret asymmetry. The `scrubForEgress`/
  `looksLikeSecret` predicate moves to `@caisson/kernel` (`secret-scrub.ts`) — the shared zero-dep base
  both `guardrails` and `local-store` already depend on — so the predicate has exactly one
  implementation; `@caisson/local-store`'s `egress-guard.ts` re-exports it, keeping its public surface
  and golden-pinned scrub contract unchanged (internal-only move, patch). `@caisson/guardrails` also
  ships a new standalone FTC "4 Ps" dark-pattern presentation guardrail (`ftc4p.ts`): a pure heuristic
  evaluator scoring marketing/UI copy against prominence/presentation/placement/proximity for false
  urgency, forced continuity, confirmshaming, opt-out-framed enrollment, and drip pricing, optionally
  wrappable as a `Moderator` via `ftc4pModerator`.
- 623d07c: Doc-only: README note on the macOS fleet CI leg and the host-provisioned extension-capable SQLite.
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
