# @caisson/cli

## 0.7.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/ds-manifest@0.2.2
  - @caisson/jobs@0.6.3
  - @caisson/kernel@0.5.3
  - @caisson/migrate@0.2.9
  - @caisson/registry-schema@0.5.6
  - @caisson/tenancy-rls@0.5.5

## 0.7.3

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/registry-schema@0.5.5

## 0.7.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/jobs@0.6.2
  - @caisson/migrate@0.2.8
  - @caisson/tenancy-rls@0.5.4

## 0.7.1

### Patch Changes

- Updated dependencies [5d03808]
- Updated dependencies [7de6fa4]
  - @caisson/registry-schema@0.5.4
  - @caisson/kernel@0.5.1
  - @caisson/jobs@0.6.1
  - @caisson/migrate@0.2.7
  - @caisson/tenancy-rls@0.5.3

## 0.7.0

### Minor Changes

- c7476b9: You can now start a governed agent run and check its status without writing any code. The
  `caisson run start "<prompt>"` command opens a bounded, metered run through your own gateway and
  prints the result — including a pause for review if the model wants to use a tool that needs
  approval. A matching pair of agent-facing tools, `run_start` and `run_status`, is available from
  your buyer MCP server for an AI agent to call directly, gated behind the same licensed entitlement
  as the rest of the runtime. Neither surface ever exposes the raw parked-run snapshot; status
  reporting only ever shows the run's state and its trajectory.
- c3b0e41: Agent-runtime tool calls can now require human approval before they execute. A tool marked
  `approvalRequired` parks the run instead of running it: the proposal is recorded, the run's
  state is saved durably, and the run process can exit cleanly while the request waits. An
  operator reviews the pending call and approves or denies it — from the `caisson` CLI or any
  service with database access — and approval resumes the run from exactly where it left off,
  picks up the approved call, and continues to completion. Denial finishes the run without ever
  executing the tool. A durable run-state store and a durable trajectory log back this: approving
  the same call twice is a no-op, two concurrent resume attempts can never both execute the tool,
  and everything is tenant-isolated. The underlying tool-execution primitive gained a matching
  two-phase mode — validate and park a call, then execute it later once it's approved — for
  callers who want the same propose/execute split without the full run loop.

### Patch Changes

- Updated dependencies [f40653b]
- Updated dependencies [c3b0e41]
  - @caisson/registry-schema@0.5.3
  - @caisson/jobs@0.6.0

## 0.6.3

### Patch Changes

- f844386: Fix the public mirror's CI, which failed `bun test` on every sync since the registry-index
  bundler test was added: `bundle-registry-index.test.ts` reads the repo-root `registry/index.json`
  ledger, absent-by-design from the mirror, and is now excluded (same class as the existing
  `entitlement-expansion.test.ts` exclusion). Also fixes two bugs the mirror's new lint/test gate
  surfaced along the way: `generate.test.ts`'s edition-auto-expand describe block loaded the same
  absent registry ledger at describe-definition time (now `describe.skipIf`-gated + lazy in
  `beforeAll`, matching the `advisory-lock.integration.test.ts` precedent — zero behavior change in
  the private repo, where the file is always present); and `ds-manifest`'s doctor tool
  (`UI_IMPORT_RE` / `PKG_UI_DEP_RE`) hardcoded the `@caisson/ui` npm specifier, so the shipped
  `@caisson-sh/ds-manifest` could never detect a hallucinated-component import against the public
  `@caisson-sh/ui` package a real mirror buyer would install — both regexes now accept an optional
  `-sh` scope (strict widening, no behavior change for real `@caisson/ui` commercial usage).

  The mirror's exporter (`scripts/export-public-mirror.ts`, not itself a published package) also
  gained: a lint + format-check CI leg; a root `eslint.config.js` + `.prettierignore` shipped into
  the mirror; an export-time `prettier --write` pass so the npm scope rename's length change can
  never desync the mirror from its own format-check; and a fix to `sanitizeSourceComments`'s naive
  regex, which previously misread a `/* */`-lookalike sequence inside a string literal (a
  comment-injection test fixture) as a real comment span and silently corrupted real code caught in
  the false span — it is now string/template-literal-aware.

- Updated dependencies [f844386]
  - @caisson/ds-manifest@0.2.1

## 0.6.2

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2

## 0.6.1

### Patch Changes

- 3f05e1e: Track the kernel 0.5.0 release in the EU AI Act sample template's dependency range so a freshly
  generated sample installs the current Apache-2.0 kernel instead of pinning a superseded minor.
- Updated dependencies [3f05e1e]
  - @caisson/registry-schema@0.5.1

## 0.6.0

### Minor Changes

- 7f68b56: Add a second `caisson` bin alongside `create-caisson`. `caisson describe --json` prints the full
  committed @caisson/ui component manifest (or one component by name, case-insensitive) as
  deterministic JSON — the same data layer the MCP tools serve, free and with no Caisson account. The
  `caisson doctor` verify command rides the same bin as a thin authed client of the buyer MCP.

### Patch Changes

- 46e45e6: Buyer-template CI workflows track actions/checkout v7; generate golden fixtures re-blessed to
  match.
- 59e1365: Generated-project templates now declare their own type surface: explicit `types` in both template
  tsconfigs (base: bun; next: bun + node) and an `@types/bun` devDependency. TS 6.0 exposed a latent
  template bug — the shipped `golden.test.ts` imports `bun:test`, which only ever type-checked
  because the monorepo's own hoisted @types leaked into the composition exit-gate; a buyer's fresh
  install had no such luck. Golden filesets re-blessed accordingly.
- Updated dependencies [7f68b56]
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/ds-manifest@0.2.0
  - @caisson/kernel@0.5.0
  - @caisson/migrate@0.2.6
  - @caisson/registry-schema@0.5.0

## 0.5.0

### Minor Changes

- 679cce6: `--edition <bundle>` alone now auto-selects the bundle's current modules:
  the selection is resolved through `expandEntitlements` against the live registry index,
  pinned at each member's `latest`, with bundle/edition meta entries dropped — so
  `bunx create-caisson my-app --edition compliance` scaffolds without a `--module` list.
  Explicit `--module` flags still win outright, and the interactive wizard pre-selects the
  expansion so a bundle buyer confirms rather than re-picks. Fail-closed: an unknown or
  retired edition id, or an expansion that resolves to zero installable modules, throws
  before anything is written.
- 15c50bd: `create-caisson --demo`: generate a runnable project against the FULL module catalog without a
  license. Free (Apache-2.0) modules install for real from the Caisson registry (no license key
  needed), exactly like a licensed build; every commercial module is replaced by a local,
  clearly-watermarked stub under `src/demo-stubs/` so you can see the shape of the catalog and try
  the scaffolding before buying. Every stub call throws a `CAISSON DEMO STUB` error naming the real
  module and pointing at https://caisson.sh — it is never the licensed source and is never for
  production. The generated repo also gets a `DEMO.md` listing the whole catalog (installed vs.
  stubbed), a not-for-production banner on `README.md`/`AGENTS.md`, and a corrected module list so
  neither file overstates what's actually installed. Reach it with `create-caisson --demo --name
<slug>`, or pick "the full catalog, commercial modules as stubs" from the interactive first-run
  wizard.
- bfa481d: `create-caisson --framework next`: an opt-in Next.js App Router starter (same shape as the
  `--deploy <target>` family) — a wired app on the base substrate instead of the bare
  `Bun.serve` harness. Ships small, working examples of every base-substrate seam: account-JWT
  session verification as a `proxy.ts` (Next 16's `middleware.ts` rename) and a Route Handler,
  tenant-scoped Postgres access via `withTenant` in a Server Action, a `BillingProvider`-port
  webhook stub, a `JobQueue` enqueue example, an `Emailer` send example, and an `@caisson/ai-config`
  lane read. Unselected, generator output is unchanged (portable-by-omission); combine with
  `--deploy railway|fly|vercel` and the shared Dockerfile's `bun run build`/`bun run start` resolve
  to `next build`/`next start` with no extra wiring.

### Patch Changes

- 08ac43e: `create-caisson` now accepts the advertised quickstart form `create-caisson my-app` — a bare
  project name with no `--name` flag — matching every install command shown in the docs and the
  site. An explicit `--name` still wins if both are given.

  Fixes a real-install bug where the generator could not find its module registry once installed
  from npm outside this monorepo: the registry snapshot is now bundled into the published package,
  so a fresh `bunx create-caisson` install resolves it correctly instead of failing.

  Fixes a second real-install bug in the same generated project: the `.npmrc` file that wires up
  module installation and your license key was silently missing from every generated project once
  the CLI was installed from a real package (package registries never ship a file literally named
  `.npmrc`). The generator now writes it correctly every time.

  `--help` now names the correct license-token environment variable, `CAISSON_LICENSE_TOKEN`
  (it previously named the wrong one).

  The `create-caisson` documentation page no longer describes a lockfile or a result type the
  generator does not produce — it now matches what the tool actually writes and returns.

- 9a81dd7: Edition-trace purge: the generator is now six-bundle-only. `--edition` input is read off the
  registry-schema alias spine, which the purge emptied, so the dissolved edition names (`ai-kit`/`local-ai`/
  `agent-dev`/`bundle`) are no longer accepted — the input set is exactly the six canonical bundle ids
  (`compliance`/`ai-production`/`local-first`/`agentic-dev`/`provenance`/`everything`). No code change to the
  seam (it self-narrows off the spine); a future module rename plugs into the same single point.
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
  - @caisson/migrate@0.2.5

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
