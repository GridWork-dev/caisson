# @caisson-sh/cli

## 0.9.0

### Minor Changes

- 73bdf3c: `create-caisson` generates from the public catalog only. The `--edition`, `--sample` and `--demo` flags, bundle expansion, generation metering and the licensed-registry `.npmrc` are removed; pick modules with `--module <id@version>` and install them from public npm with no token.
- 73bdf3c: The module catalog `create-caisson` validates against is now built from the packages released with it: every public `@caisson-sh/*` package at its current version, one version per module, with its description, dependencies and stability. Every such package can be generated, and `--module` pins match what npm serves for that release. An unbuilt checkout with no catalog file now fails with a message naming `bun run build` instead of reading a stale index.

### Patch Changes

- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
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
  - @caisson-sh/ds-manifest@0.3.5
  - @caisson-sh/migrate@0.2.15
  - @caisson-sh/tenancy-rls@0.6.2
  - @caisson-sh/jobs@0.7.5
  - @caisson-sh/kernel@0.10.1
  - @caisson-sh/registry-schema@0.6.0

## 0.8.1

### Patch Changes

- e211684: Update the generated Next.js framework template and email transport to patched dependency releases. The workspace lockfile also refreshes the affected transitive security fixes without changing their declared dependency ranges.
- 6604844: Pin generated deployment images to Bun 1.4.2 by image index digest, matching the Caisson build and runtime fleet.
- 498b279: Add bounded Postgres pool construction for autoscaled runtimes and finite migration jobs, and use it in generated applications.
- 69b3ba3: Routine non-major dependency refresh.

  `apps/site` picks up `@azure/identity`, `@plausible-analytics/tracker`, `motion` and
  `web-vitals` point releases (the `motion` 13.x major stays held). The CLI's
  `@modelcontextprotocol/sdk` moves to `1.30.0`, and `@caisson/ai-kit`'s own
  devDependency moves in lockstep — it imports the SDK's `Server` type directly alongside
  `@caisson/mcp-server`, a workspace sibling that shares a resolution subtree with the
  CLI, and a split version there makes the two `Server` types nominally distinct at
  typecheck. The email package's `nodemailer` moves to `9.0.5`. Root build tooling moves
  too: `@types/bun`, `dependency-cruiser` to `18.2.0` with its patch file re-cut,
  `eslint-plugin-storybook`, `knip`, `oxfmt` and `oxlint`.

  Three bumps prepared alongside these are deliberately **not** here. Each independently
  breaks something, and none is fixable by choosing a different version:

  - **`fumadocs-core` / `fumadocs-mdx` / `fumadocs-ui`.** Two separate blockers, and the
    second only appeared under the browser gate. First, the static search client's
    `initOrama` option is deprecated in favour of `initDB` and its default now builds
    against `zbsearch` rather than `@orama/orama` — that part is a _trivial_ adoption, a
    deletion: drop the hand-written init and call `oramaStaticClient()` bare, because the
    library default is already `create({ schema: { _: "string" } })` and `zbsearch`'s
    tokenizer defaults `language` to `"english"` on its own. Second, and the actual
    blocker: **16.15.1 renders two `main` landmarks on `/docs`.** The site's docs layout
    renders none of its own by design, so both come from fumadocs, and the P1 browser
    guard fails with `Expected: 1, Received: 2`. Notably the search guard
    (`P1-004`, focus return on every dismissal path) **passes** under the migration, so
    the search half is sound — the a11y regression is what holds the line.
  - **`kysely` `0.29.4` to `0.29.5`.** Only `apps/site` declares kysely, as a single exact
    pin, so there are never two copies of it. Moving it perturbs the peer-hash of
    `@better-auth/core`, and the site imports `better-auth` and
    `@better-auth/kysely-adapter` side by side; they then land on differently-hashed
    copies of the shared core whose `BetterAuthOptions` are nominally distinct under
    `exactOptionalPropertyTypes`. An override forcing one `@better-auth/core` version does
    not help — an override pins a version, not a peer-hash.
  - **A repo-wide `jose` pin.** On its own, from a clean baseline, it reproduces exactly
    the same three errors in the same file by the same mechanism. Both peer-hash items are
    tracked as backlog work; the override route is already ruled out.

  An earlier draft of this note argued the reverse of that last point: that the `jose` pin
  was load-bearing, and that dropping it would split the auth core and stop the site
  typechecking. That is backwards. Measured from `main`'s manifests as a green baseline,
  adding one group at a time: the pin alone produces the split, and `main` itself carries
  two `jose` versions and exactly one `@better-auth/core` while typechecking clean.

- Updated dependencies [498b279]
- Updated dependencies [97ec962]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/ds-manifest@0.3.4
  - @caisson/registry-schema@0.5.12
  - @caisson/kernel@0.10.0
  - @caisson/jobs@0.7.4
  - @caisson/migrate@0.2.14

## 0.8.0

### Minor Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.

### Patch Changes

- 2609293: Consolidation wave one: the eighteen refutation-verified cuts from the August consolidation audit.

  New public API: `@caisson/kernel` gains the narrow `./crypto` subpath (node:crypto-only graph,
  so a Cloudflare Worker can import the timing-safe compare without the wide `./node` barrel's
  `node:dns` reach), and `@caisson/tenancy-rls` exports `createPgTransactor(pool)` — the canonical
  node-postgres BEGIN/COMMIT/best-effort-ROLLBACK/release adapter previously copy-pasted across the
  site, admin, the license deploy entry, the CLI, and the generated Next starter (which also gains
  the best-effort rollback it lacked). Everything else is deletion or internal consolidation with
  behavior pinned by tests: dead marketplace/build residue and dead nav derivation out of the site,
  the unused account-entitlement resolver and 111 unreachable barrel exports out of the license
  service, the orphan EU AI Act manifest out of compliance (it was being packed while unreachable),
  an unused trust-page devDependency, shared task-registry lookup across the five jobs drivers,
  shared exact byte-identical parser readers in billing-orchestration, the kernel browser-graph
  walker folded onto the shared testing module-graph, the intel OpenRouter transport shared between
  enrichment and its eval judge, license scheduler test fixtures consolidated, the dependency graph
  guard moved into standards-gate ownership (its test now runs in the package suite), the Better
  Stack adapter's unauthenticated dev bypass deleted and its secret compare folded onto the kernel
  primitive, and one boundary-policy data source feeding ESLint, dependency-cruiser, and the
  standards gate — closing a drifted cruiser hand-copy that had silently stopped guarding the five
  current bundle roots.

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
- Updated dependencies [8993cf7]
- Updated dependencies [886e1e7]
- Updated dependencies [1964e9d]
- Updated dependencies [87275f6]
- Updated dependencies [c10e3b6]
  - @caisson/kernel@0.9.0
  - @caisson/jobs@0.7.3
  - @caisson/tenancy-rls@0.6.0
  - @caisson/registry-schema@0.5.11
  - @caisson/ds-manifest@0.3.3
  - @caisson/migrate@0.2.13

## 0.7.9

### Patch Changes

- Updated dependencies
  - @caisson/registry-schema@0.5.10

## 0.7.8

### Patch Changes

- Updated dependencies [fab7a0d]
- Updated dependencies [7d74f8f]
- Updated dependencies [742c979]
  - @caisson/ds-manifest@0.3.2
  - @caisson/kernel@0.8.0
  - @caisson/jobs@0.7.2
  - @caisson/migrate@0.2.12
  - @caisson/registry-schema@0.5.9
  - @caisson/tenancy-rls@0.5.8

## 0.7.7

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/ds-manifest@0.3.1
  - @caisson/registry-schema@0.5.9
  - @caisson/kernel@0.7.0
  - @caisson/jobs@0.7.1
  - @caisson/migrate@0.2.11
  - @caisson/tenancy-rls@0.5.7

## 0.7.6

### Patch Changes

- Updated dependencies [25fd03c]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
- Updated dependencies [108a358]
  - @caisson/registry-schema@0.5.8
  - @caisson/ds-manifest@0.3.0
  - @caisson/kernel@0.6.0
  - @caisson/jobs@0.7.0
  - @caisson/migrate@0.2.10
  - @caisson/tenancy-rls@0.5.6

## 0.7.5

### Patch Changes

- 0f2215e: The Next.js starter template's dependency pins now track the current package versions (all
  seven were stale, two unsatisfiably so — a newly generated Next.js project failed install). A
  new guard test reads the real workspace versions, so any future package bump fails loudly until
  the template pin rides along in the same change — the same protection the sample template
  already had.
- Updated dependencies [31d59fd]
  - @caisson/registry-schema@0.5.7

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
