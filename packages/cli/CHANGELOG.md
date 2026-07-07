# @caisson/cli

## 0.4.0

### Minor Changes

- 8c53ca3: `create-caisson` now supports an interactive first run: run it in a terminal with no flags (or
  only some of them) and it prompts for whatever is still missing — starting with a choice between
  a licensed module/edition build and the free sample, then the project name, and finally which
  modules to include. Any flag you already pass is never re-prompted, and piping input or running
  in a non-interactive shell (CI, scripts) behaves exactly as before with no prompts at all.

  Generated projects can now also request a starter deploy configuration for Railway, Fly.io, or
  Vercel via `--deploy <target>` (or the matching step in interactive mode). Leaving it unset
  generates the exact same files as before.

- `create-caisson`'s `--edition` flag now accepts the six-bundle catalog vocabulary
  (`compliance`, `ai-production`, `local-first`, `agentic-dev`, `provenance`, `everything`), read
  directly off `@caisson/registry-schema`'s single alias point so the generator never falls behind
  the catalog again. The four legacy edition ids (`ai-kit`, `local-ai`, `agent-dev`, `compliance`)
  keep working forever and normalize to their bundle id, producing the byte-identical generated
  project either way. The README's stated install command is also corrected to the locked canonical
  `bunx @caisson-sh/cli@latest` (the previous `npx create-caisson` form remains a working secondary
  path).

### Patch Changes

- Updated dependencies [8170382]
  - @caisson/registry-schema@0.4.0

## 0.3.0

### Minor Changes

- ad02304: The cli codegen debit is decoupled behind a required `DebitFn` injection port (`GenerationDeps.debit`; `@caisson/credits` moves to devDependencies and off the manifest), and `@caisson/credits` flips commercial at $149 (tier `paid`, priceCents 14900, `LicenseRef-Caisson-Commercial`).

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 4d7eb71: Test-double bootstrap sweep for the credit-expiry migrations: every credit-table
  bootstrap now applies `CREDIT_EXPIRY_MIGRATION_SQL` + `GRANT_CONSUMPTION_MIGRATION_SQL` (the
  `debit()` FIFO path reads `expires_at` and writes `grant_consumption`). No runtime source change
  in these packages.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [d6cc28e]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [850b844]
- Updated dependencies [aec9f1c]
- Updated dependencies [31d6a41]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/migrate@0.2.4
  - @caisson/registry-schema@0.3.0

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/credits@0.3.2
  - @caisson/migrate@0.2.3

## 0.2.2

### Patch Changes

- bad0541: Flip the generator's buyer-repo `.npmrc`: `@caisson:registry` now points at
  `https://registry.caisson.sh` with `//registry.caisson.sh/:_authToken=${CAISSON_LICENSE_TOKEN}`
  (npm's own env interpolation at install time -- no token is ever committed), replacing the
  retired `npm.pkg.github.com` GitHub Packages channel. Updates both the live `templatesEngine`
  template (`templates/base/.npmrc` + `README.md`) and the legacy `defaultEngine` literal in
  `generate.ts` for parity, with golden fixtures re-blessed to match.
- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/credits@0.3.1
  - @caisson/migrate@0.2.2

## 0.2.1

### Patch Changes

- ccf8b10: Branded money types + rounding provenance (ADR-0212).
  Kernel gains `src/money.ts`: TS-native nominal `Cents`/`Credits`/`MicroUsd`/`MicroUsdPerCredit`
  brands (compile-time only, zero runtime cost), `asCents`/`asCredits`/`asMicroUsd`/
  `asMicroUsdPerCredit` constructors (throw `ValidationError` on a non-integer/negative input),
  the identity `unwrapMoney` DB-boundary marker, and the `RoundedMoney<TRaw,TResult>`
  `{raw, mode, result}` record; `centsToCredits` now returns `Credits` and
  `centsToCreditsProvenance` returns the round-DOWN provenance record. Credits: `GrantInput`/
  `DebitInput.amount` are `Credits`, both accept optional `rounding`, and the new
  `CREDIT_ROUNDING_MIGRATION_SQL` (appended as platform migration `0007_credit_rounding.sql` —
  never an edit to the checksum-pinned `CREDIT_SCHEMA_SQL`) adds nullable
  `rounding_raw`/`rounding_mode` to `credit_event` with a biconditional + mode-enum CHECK.
  Pricebook: `creditsPerCycle`/`credits`/`codegenRunCredits` are branded; re-exports
  `centsToCreditsProvenance`. ai-meter: `CostBreakdown` is branded and gains `roundingCredits`
  (`mode: "up"`, ADR-0060) which `reserve()`/`reconcile()` persist onto their ledger rows;
  `BUNDLED_PRICE_BOOK` gains the `openai/text-embedding-3-small` row (ADR-0213 —
  embedding pricing is config, not code; `PRICE_BOOK_VERSION` bumped to 2026-07-02).
  `apply-billing-event` grants stay exact table integers with NULL/NULL provenance
  (ADR-0089 §5); ADR-0007 integer-at-rest is untouched. ai-kit/cli: boundary mints +
  test fixture updates only.
- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [549dd4e]
  - @caisson/registry-schema@0.2.1
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/migrate@0.2.1

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
  - @caisson/credits@0.2.0
  - @caisson/migrate@0.2.0
