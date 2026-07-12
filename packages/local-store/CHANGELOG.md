# @caisson/local-store

## 1.0.0

### Minor Changes

- 679cce6: `hybridSearch` gains an `ftsWeight` option (CAISSON-83): the FTS leg's reciprocal-rank
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
