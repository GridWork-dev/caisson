# @caisson-sh/site

## 0.5.1

### Patch Changes

- 304851a: Correct first-contact documentation: generated projects now tell you to run `bun run test` (bare `bun test` also picks up built output), the WORM retention copy states that GOVERNANCE mode can be bypassed by a principal with the bypass-governance permission while COMPLIANCE mode cannot, and package READMEs no longer refer to product editions or call the drizzle-orm `.forceRLS()` change an issue.
- bd2f5aa: Fix the documented generator command. `bunx @caisson-sh/cli` starts the package's first bin,
  `caisson`, which rejects the generator flags, so the README and the docs now run the generator as
  `bunx --package @caisson-sh/cli create-caisson` (or `npx --package @caisson-sh/cli create-caisson`
  under Node). The pinned-install example now uses versions that exist on npm.
- c3bbcbe: Homepage and marketplace copy now claim audit evidence rather than audit readiness, count five
  module families (the whole-catalog Everything set is no longer counted as a sixth), take the base
  package count from the base list, and no longer say every module has a live demo.
- 1157153: The WORM storage copy on the home, compliance and provenance pages no longer says the escalation to
  COMPLIANCE mode happens "at launch". The package provides the escalation; the adopter decides when
  to use it.
- Updated dependencies [4954dc1]
- Updated dependencies [fa815fc]
- Updated dependencies [304851a]
- Updated dependencies [e58ddc3]
- Updated dependencies [5ca14b4]
  - @caisson-sh/kernel@0.10.2
  - @caisson-sh/audit-worm@2.2.6
  - @caisson-sh/email@1.0.1
  - @caisson-sh/ai-meter@1.1.5
  - @caisson-sh/local-store@1.1.4
  - @caisson-sh/prompt-registry@1.1.4
  - @caisson-sh/ui-pro@0.3.10
  - @caisson-sh/demo-registry@0.2.18

## 0.5.0

### Minor Changes

- 7d153d5: caisson.sh stops selling and ships as a static export. The cart, checkout, sign-in, buyer dashboard, plans, compare, stack fit, glossary and design-partner pages are gone, and every price is removed. The marketplace is now a demonstration gallery: each module links to its docs and to the module page that runs its live in-browser demo. The site and demos no longer build container images. The interactive demos export statically under /demos and ship inside the same site build, and security headers and redirects now ship as static `_headers` and `_redirects` files.

### Patch Changes

- 9e5da35: The docs gain pages for the `agent-dev` and `agent-trajectory` Agentic-Dev packages and the `ai-kit` AI-Production package, wired into their sections' navigation.
- 9e5da35: The docs gain pages for the remaining base packages: ds-manifest, migrate, observability, rate-limit, and registry-schema, linked from the Base substrate index.
- 9e5da35: The docs gain pages for the compliance evidence kit, access-review, risk-register, the trust-page generator, the shared artifact-render primitive, and the out-of-band verify-pack verifier, plus links to them from the Compliance family index.
- 784a846: The home page's repository tree shows the apps that exist today, and the release pipeline publishes every package through npm trusted publishing.
- 73bdf3c: The site, demos and internal tooling follow the move to Apache-2.0: the gate now requires every published package to be Apache-2.0 with its LICENSE file, the commerce and entitlement checks are gone, and the docs install everything from public npm.
- 1c765e8: The home page's "Who's behind it" line now says Caisson is open source under Apache-2.0, built and maintained by Caisson Software LLC.
- 05307e7: Docs code blocks are legible for visitors whose system prefers dark mode and who have not picked a theme: the highlighted tokens now use the dark palette on the dark code surface instead of the light one.
- 05307e7: Content-hashed build output under /\_next/static/ is served with a one-year immutable cache header, so repeat visits stop revalidating every script and stylesheet.
- d790f5d: The site's structured data names its founder through the maintainer's published Person entry, and no longer references pages on a retired domain.
- 8226c84: The live route test's header no longer points at the removed Terraform directory.
- 611f1de: The MCP server docs name the renamed `ClientToken` type.
- 05307e7: Module pages no longer scroll sideways on a 360px screen: long identifiers in the lede and in the code-artifact notes wrap instead of widening the column.
- 05307e7: The site no longer loads the Plausible tracker or fires custom events, and its Content-Security-Policy allows no third-party origin.
- 2eb8746: caisson.sh counts page views with Cloudflare Web Analytics: cookieless, aggregate only, and loaded only on the caisson.sh hostname. The Content-Security-Policy allows its two origins, and the privacy policy and subprocessor list describe it.
- 72d82a8: The compliance package's docs page is reachable: an old redirect sent `/docs/compliance/compliance` to the section index, and a site test now fails if any `/docs` redirect hides a page.
- eb2648e: The email docs no longer mention the removed admin preview and send-test routes or the removed purchase-receipt template.
- 0b0fbb1: The email docs page no longer lists the removed sales templates.
- Updated dependencies [0b0fbb1]
- Updated dependencies [eb2648e]
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/email@1.0.0
  - @caisson-sh/ui-pro@0.3.9
  - @caisson-sh/ai-meter@1.1.4
  - @caisson-sh/audit-worm@2.2.5
  - @caisson-sh/kernel@0.10.1
  - @caisson-sh/local-store@1.1.3
  - @caisson-sh/prompt-registry@1.1.3
  - @caisson-sh/ui@0.6.8
  - @caisson-sh/brand@0.1.7
  - @caisson-sh/demo-registry@0.2.17

## 0.4.1

### Patch Changes

- 1e2f79a: Health probe paths now answer ahead of the edge origin gate. The platform healthcheck reaches each container internally and cannot carry the edge-injected origin-secret header, so arming the gate as the first check made every one of the four gated services fail its own readiness probe and froze the whole deploy path. The exemption is keyed on exact string equality against each service's configured `healthcheckPath`, never a prefix, so a trailing slash, a longer path, a differing case and a traversal segment all stay behind the gate; a per-service test pins the constant against the deployment manifest so a drift in either cannot silently re-freeze deploys.

  Because the probe path is now reachable without the secret, the responses shrink to liveness for unauthenticated callers. The docs service withholds its corpus chunk count, and the license service and the operator control-plane withhold their registry index digest and entry count, unless the caller presents a valid origin secret. Traffic arriving through the edge carries that header, so the registry index parity probe keeps reading the digest from both services; only a caller reaching a raw platform origin directly is reduced to a bare status.

- af2e132: The agent-readable index now names both categories the product actually sells into. Its summary line described compliance infrastructure for regulated SaaS and stopped there, so an answer engine classifying the product for governance of AI coding agents had nothing structured to read — the governed-agent kernel, the sandboxed runner and the default-deny tool-execution gate were listed in the flat module catalog but never surfaced as a category. The summary now names both, and a dedicated section leads with the framing above the modules that make the claim true. Each of those modules is resolved from the module-page catalog by slug rather than restated, so a renamed or retired module fails the build instead of shipping a dead link into the file engines quote verbatim.

  Two whole route families were missing from the index: the comparison pages and the writing pieces. Both now have their own headings and are generated from the same records the pages themselves render, so adding either lands in the index with no second edit. Tests pin every entry in both catalogs individually rather than counting them, and the governance section's assertions are scoped to that section — a whole-file check passes on those module links whatever the section contains, because the module catalog lists them too.

- 8619c41: Document three module surfaces that previously had no guide, and correct two metering examples.

  New: a getting-started guide for the OSCAL module covering the evidence-pack round trip, XML
  conversion, the ISO 27001 statement of applicability, and control-id lookup against the pinned
  NIST catalog. New: an end-to-end tutorial for the governed agent loop, covering approval-gated
  tools, the parked result, the operator approve and deny flow, resume behaviour, and every failure
  code the loop can return. Added to the field-encryption page: a migration section for callers
  upgrading from a pre-1.0 release, covering the borrowed-key callback that replaced direct key
  derivation, the runner change, and the key-store interface addition.

  The metering quickstart named a model with no entry in the bundled price book, so pasting it
  raised a configuration error before the first call. Both examples now name a priced model, and the
  agent-loop guide states the requirement so the failure is diagnosable rather than surprising.

- 7e11672: Upgrade runtime OS layers on pinned bases and gate fixable HIGH/CRITICAL runtime OS findings while reporting application and raw-base residuals.
- 7d39669: Report the serving revision on every deployed service.

  Each service now answers with an `x-caisson-revision` response header naming the commit its
  running image was built from, so "which code is actually live" is one request instead of an
  inference from how a route behaves.

  The kernel gains `servingRevision()` and the constants behind it on the `@caisson/kernel/node`
  entry. It reads a `.caisson-revision` carrier written into the uploaded tree at deploy time; a
  build that did not come through that path reports `unknown` rather than guessing.

  The header is deliberately not gated behind origin verification: it has to stay readable exactly
  when that gate is the thing misbehaving, which is the case it exists to diagnose.

- ac1a1a4: The signed-in session hint cookie used to skip an ownership check for signed-out visitors is now
  HttpOnly, so page scripts can no longer read a visitor's authentication state from it. The
  ownership check itself always fires now; the server route short-circuits internally when the
  cookie is absent, so the same signed-out fast path is preserved without exposing a readable
  auth signal.
- f6282dc: Site crawl hygiene and a corrected identity claim.

  The root JSON-LD advertised the development repository as a `sameAs` identity surface. That
  repository is private, so the URL returns 404 to any anonymous crawler and the claim was broken
  rather than merely weak. It now points at the public organization page, which resolves, and a
  pinning test keeps it from drifting back.

  Crawl rules keep robots off the authenticated walls, and the orphaned demo route is now reachable
  from the sitemap instead of being published with no inbound path.

- 4087f8e: The root Organization now carries two entity-association edges to the associated company's public hub: a
  shared `founder` Person and `subjectOf` pointing at the hub's Caisson case study, each by `@id`
  only. No subsidiary predicate is published in either direction — the two companies are separate
  LLCs with common ownership at the individual level — and a test over the serialized graph keeps
  `parentOrganization` / `subOrganization` from ever appearing. Both target IRIs are pinned verbatim.
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

- Updated dependencies [ac1a1a4]
- Updated dependencies [e211684]
- Updated dependencies [045b21e]
- Updated dependencies [6604844]
- Updated dependencies [ac1a1a4]
- Updated dependencies [1e2f79a]
- Updated dependencies [ac1a1a4]
- Updated dependencies [498b279]
- Updated dependencies [7e11672]
- Updated dependencies [f02b193]
- Updated dependencies [cd694f1]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [9cb7681]
- Updated dependencies [7d39669]
- Updated dependencies [69b3ba3]
- Updated dependencies [498b279]
  - @caisson/ai-kit@0.6.5
  - @caisson/cli@0.8.1
  - @caisson/email@0.5.8
  - @caisson/local-store@1.1.2
  - @caisson/audit-worm@2.2.4
  - @caisson/service-license@0.1.5
  - @caisson/tenancy-rls@0.6.1
  - @caisson/registry-schema@0.5.12
  - @caisson/ui@0.6.7
  - @caisson/observability@0.3.9
  - @caisson/kernel@0.10.0
  - @caisson/demo-registry@0.2.16
  - @caisson/platform-migrations@0.3.5
  - @caisson/platform-reads@0.3.1
  - @caisson/ai-meter@1.1.3
  - @caisson/auth@0.4.5
  - @caisson/credits@0.6.3
  - @caisson/field-crypto@1.1.2
  - @caisson/org-controls@0.4.2
  - @caisson/prompt-registry@1.1.2
  - @caisson/rate-limit@0.2.1
  - @caisson/pricebook@0.8.5
  - @caisson/brand@0.1.6
  - @caisson/ui-pro@0.3.8
  - @caisson/billing@0.6.9
  - @caisson/compliance-core@0.7.2
  - @caisson/migrate@0.2.14

## 0.4.0

### Minor Changes

- 0f3f5e2: The interactive module demos now ship as their own application instead of being compiled into the
  marketing site. They are served from the same address as before — a module page still shows its
  demo inline, and nothing about the page's address or analytics changes — but the demos are now
  built and deployed independently of the site.

  The response headers pick up one narrow change to allow this. Pages may now embed a frame from
  caisson.sh itself, and the demo surface may be framed by caisson.sh itself. Every other page is
  still refused to every framer, including this one, and no third-party origin was added anywhere.

  The practical effect is that changing a module no longer rebuilds and redeploys the storefront: the
  site's internal dependency list drops from 46 workspace packages to 27, and the packages that exist
  purely to power a demo move with the demos. A page whose demo is temporarily unavailable now says
  so in place of the demo, rather than failing the surrounding page.

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

- f669d4a: The guardrails and local-inference interactive demos now execute the shipped browser-safe package
  surfaces instead of maintaining site-local copies. PII handling, moderation decisions, deterministic
  embeddings, model-host policy, and egress checks therefore stay pinned to the same code buyers run.
  The local-inference demo also stops claiming a metered egress request it never makes — it now reports
  zero requests and no recorded usage — and both demos surface a bounded error state instead of an
  indefinite spinner when the in-browser guard or embedding computation fails.

  Note: this code already shipped in the packages published with v2026.08.06.1 — the version cut was
  taken from a base that predated the merge, so this changeset records the bump only.

- e190797: Routine non-major dependency refresh. `better-auth` and its Kysely adapter move
  `1.6.25` to `1.6.26` in the site; Storybook `10.5.0` to `10.5.6` and Vite `8.1.4`
  to `8.2.0` in the UI kit; `wrangler` `4.106.0` to `4.119.0` in the registry
  worker. Everything but the better-auth pair is a devDependency. No API or
  behaviour change in any of the three packages.
- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- c10e3b6: Correct the next.config.ts CSP note: the builder emits the pre-split policy plus frame-src 'self', not a byte-identical policy.
- 581cb2d: Message-match copy pass on the marketing surface. The homepage hero now names ISO 27001 and NIST 800-53 alongside SOC 2 and HIPAA, so buyers searching for the framework they actually have to satisfy see it on the first screen. The after-year-one question is answered where the buying decision happens — beside the price on the Compliance page and in the cart and its drawer, next to checkout — instead of only on the plans tab. The price footnotes now state the Compliance figure as the committed one-time price and make clear the interviewed-buyer estimate is of the in-house build, not of the price. Design-partner application links fire a cookieless click event while remaining plain `mailto:` links that work with JavaScript disabled. Two comparison pages join the set, Probo and Sentrik, with every competitor claim read from the vendor's live site and stamped with the date it was read.
- c577330: Deployment documentation now matches the deployed reality. The `apps/site` service
  env block is regenerated from the live variable list — names only, verified for exact
  parity in both directions — and the stale scaffold comments that described live
  infrastructure as not-yet-created are removed from the demos service config, the
  registry Worker config, and the Railway deploy workflow. No runtime behaviour changes
  in these packages.
- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
- Updated dependencies [2405d9e]
- Updated dependencies [c10e3b6]
- Updated dependencies [b0e66b6]
- Updated dependencies [b0e66b6]
  - @caisson/kernel@0.9.0
  - @caisson/field-crypto@1.1.1
  - @caisson/billing@0.6.8
  - @caisson/cli@0.8.0
  - @caisson/demo-registry@0.2.15
  - @caisson/local-store@1.1.1
  - @caisson/pricebook@0.8.4
  - @caisson/ui@0.6.6
  - @caisson/ui-pro@0.3.7
  - @caisson/ai-meter@1.1.2
  - @caisson/tenancy-rls@0.6.0
  - @caisson/registry-schema@0.5.11
  - @caisson/service-license@0.1.4
  - @caisson/ai-kit@0.6.4
  - @caisson/audit-worm@2.2.3
  - @caisson/auth@0.4.4
  - @caisson/brand@0.1.6
  - @caisson/compliance-core@0.7.1
  - @caisson/credits@0.6.2
  - @caisson/email@0.5.7
  - @caisson/migrate@0.2.13
  - @caisson/observability@0.3.8
  - @caisson/org-controls@0.4.1
  - @caisson/platform-migrations@0.3.4
  - @caisson/platform-reads@0.3.0
  - @caisson/prompt-registry@1.1.1
  - @caisson/rate-limit@0.2.0

## 0.3.3

### Patch Changes

- Updated dependencies
  - @caisson/registry-schema@0.5.10
  - @caisson/ai-kit@0.6.3
  - @caisson/cli@0.7.9
  - @caisson/credits@0.6.1
  - @caisson/pricebook@0.8.3
  - @caisson/service-license@0.1.3
  - @caisson/ai-meter@1.1.1
  - @caisson/platform-migrations@0.3.3
  - @caisson/platform-reads@0.2.11
  - @caisson/demo-registry@0.2.14

## 0.3.2

### Patch Changes

- 74f0756: Both packages gain a browser-safe `./browser` entry point: the contracts and vocabulary, the
  crosswalk model, the catalog pin, the control model with all three framework packs, and the pure
  catalog and assessment-plan exporters can now be imported inside a client bundle. The main entry
  is unchanged and keeps the full node-capable surface; every browser-entry export is also
  available there. As part of this, the catalog and assessment-plan exporters' default id generator
  now uses the runtime's built-in WebCrypto `crypto.randomUUID()` instead of the Node crypto
  module — the same UUID format, and any injected `newId` seam behaves exactly as before — and
  both packages now declare a Node 20.12 minimum. Consumers of the compliance-core re-export
  receive the same default-id change.
- 8d77377: The site now generates its content and route types before running the TypeScript gate, and app
  directory unit tests run as part of the normal test suite. Existing test fixtures were repaired so
  the stricter gate checks the complete site surface without widening its browser API baseline.
- 98bf1f3: Routine non-major dependency refresh: the OpenTelemetry SDK/instrumentation line moves to its
  current minor, Playwright takes a patch, and the Storybook, Vite, wrangler, noble-curves, and
  better-auth pins stay at their prior versions because the newer releases have not yet cleared the
  seven-day release-age floor. No API or behavior changes in any package.
- 42d9710: The eval package gains a browser-safe `./browser` entry point: the regression gate's rules with no
  file access at all — the baseline boundary schema, `compareToBaseline`, the pre-bless eligibility
  check, the new `mergeIntoBaseline`, and `wilsonLowerBound` — can now be imported inside a client
  bundle to show or check a comparison. `gateAgainstBaseline` and `loadBaseline` stay on the main
  entry, because they read and write the committed baseline file. The main entry is unchanged and
  keeps the full surface; every browser-entry export is also available there. Internally the rules
  moved into their own module and the file transport now delegates to them, so the bless merge has
  exactly one implementation instead of two. The site's eval interactive demo now runs that real
  code end to end instead of a hand-maintained copy.
- 649be32: The local-privacy interactive demo on the site now runs the shipped egress guard itself — the
  policy parse, the https-scheme check, the exact-host allowlist lookup, and the sanctioned sink
  kind on every verdict come from the real package instead of a hand-maintained copy kept in the
  site. The demo's blocked verdicts are the guard's own fail-closed errors, so what a visitor sees
  is exactly what the module does. No package behavior changed.
- 49f26a4: Both packages gain a browser-safe `./browser` entry point. For alerting that is the event contract,
  dedup, rate-cap, quiet hours, the delivery port with its isolation wrapper and capture driver, the
  audit port with its in-memory driver, and `processAlert` itself — everything except the five
  network delivery drivers, which stay on the main entry because a browser cannot hold a webhook
  signing secret. For retention runner it is the request contract, the erasure-target port with all
  three reference drivers, the audit-sink port with its in-memory driver, and `runErasure` itself —
  everything except the recurring-sweep scheduling helpers. The main entry of each package is
  unchanged and keeps the full surface, and every browser-entry export is also available there.

  Internally, alerting's delivery port, its per-channel isolation wrapper, and the capture driver move
  into their own module so the orchestrator no longer pulls the network drivers in behind it. Every
  public export keeps its name and shape.

  The alerting and retention-runner interactive demos on the site now run the shipped packages end to
  end instead of hand-maintained copies, so what the demo does is what the code does — including the
  erasure request validation the copy left out.

- e1226f6: agent-trajectory gains a browser-safe `./browser` entry point: the strict event schema, the
  in-memory append-only store, the run-state port with its in-memory implementation, both
  deterministic projections, and the Claude transcript adapter can now be imported inside a client
  bundle, so a dashboard can replay and validate a trajectory in the browser. The main entry is
  unchanged and keeps the full surface, including the two Postgres-backed stores, and every
  browser-entry export is also available there. The site's replay interactive demo now runs that
  real code end to end instead of a hand-maintained copy.
- 8875592: Both crypto packages gain a browser-safe `./browser` entry point, so the same primitives the server
  runs can now run inside a client bundle, a Cloudflare Worker, or any other WebCrypto-only runtime.

  field-crypto's browser entry carries per-tenant HKDF key derivation, AES-256-GCM seal and open, the
  row-bound additional-authenticated-data tuple, and the self-describing envelope codec, working over
  `Uint8Array` and WebCrypto instead of Buffer and the Node crypto module. It is the same wire format,
  not a parallel one: a value sealed in a browser opens under the server's `decryptField`, a value
  written by `encryptField` opens in a browser, and both directions are pinned byte-for-byte against
  the shipped fixtures. The new names sit alongside the existing ones rather than replacing them —
  `deriveTenantKeyAsync`, `aesGcmSealAsync`, `aesGcmOpenAsync`, `buildAadBytes`,
  `serializeEnvelopeBytes`, `parseEnvelopeBytes`, plus `nextKeyVersion` and `MAX_KEY_VERSION` for the
  rotation bound the key-version registry already enforced. One behavior note: parsing an envelope
  accepts both standard and URL-safe base64, preserving values the previous Node decoder could read;
  whitespace is still tolerated and malformed values fail closed. The public seal operation always
  generates its own fresh nonce, matching the Node cipher without exposing a caller override.

  signing-primitive's browser entry carries the verify half: the signable-payload construction,
  `verifyEvidenceSignature`, and the RFC-3161 test-double authority, so a relying party can check an
  evidence pack's provenance entirely in their own browser. Nothing about the signature scheme
  changed — the browser path runs the very same Ed25519 primitive the signer does, because that
  primitive never needed Node in the first place. The signing identity stays off the browser entry
  deliberately: a tenant seed does not belong in a bundle end users download. Two additions on both
  entries: `hexToBytes` for decoding a signature or key, and
  `timestampCountersignsSignatureAsync`, the WebCrypto twin of the existing timestamp check, which
  keeps its synchronous form and uses a fixed-work digest comparison without importing Node crypto.

  Both packages now declare a Node 20.12 minimum, and every export the main entry offered before is
  still there with the same name and shape. The site's field-crypto and signing-primitive interactive
  demos now run those shipped packages directly instead of hand-maintained copies of them, and the
  shared test harness gained a scan for Node-only globals to go with its existing module-graph walk.

- b2c8c24: Billing orchestration gains a browser-safe `./browser` entry point carrying the pure claim-key half
  of the webhook idempotency layer: the fail-closed source event id guard and the per-effect composite
  key derivation, which now live in their own module with no database or Node dependencies. The claim
  itself is unchanged and stays on the main entry, since it runs as an insert inside your tenant
  transaction. Both guards are also exported from the main entry, which keeps the complete surface, and
  `processEvent` and `withIdempotentSideEffect` delegate to them, so the key rules have exactly one
  implementation and every thrown message is what it always was. The site's billing-orchestration
  interactive demo now runs those shipped guards instead of a hand-maintained copy.
- 03ca530: Both packages gain a browser-safe `./browser` entry point, so the parts of each that are pure
  validation can now be imported inside a client bundle.

  `@caisson/agent-runner/browser` carries the provider profile model, `CLAUDE_CLI_PROFILE`,
  `PASSTHROUGH_KEYS`, and `buildEngineEnv` — the env scrub, exactly as the runner itself runs it.
  `buildEngineEnv`'s first parameter is now typed structurally instead of as Node's process-env type,
  so it no longer requires Node's ambient types; `process.env` still satisfies it and existing callers
  are unchanged.

  `@caisson/tool-exec/browser` carries `createToolProposer`, the default-deny allowlist lookup plus
  Zod argv validation with no spawn seam attached — the same gate `createToolExec` runs, now also
  available on the main entry, so a UI can show whether a call is permitted without a process
  boundary anywhere near it.

  The main entry of each package is unchanged and keeps the full Node-capable surface, and every
  browser-entry export is also available there. The site's agent-runner and tool-exec interactive
  demos now run that real logic instead of a hand-maintained copy.

- 5d1f295: The prompt registry gains a browser-safe `./browser` entry point: `name@version` and `name@alias`
  addressing plus the injection-safe render boundary and its strict variable schemas can now be
  imported inside a client bundle. The registry functions and the schema stay off that entry
  deliberately, each one takes a tenant executor and runs SQL, so fail-closed tenant isolation stays
  on the server. The main entry is unchanged and keeps the full surface; every browser-entry export
  is also available there. The site's prompt-registry interactive demo now runs that real addressing
  and versioning logic instead of a hand-maintained copy.
- dff76d9: The package gains a browser-safe `./browser` entry point carrying `assertCanManageMembers`, so a
  client bundle can render the owner-only gate using the exact function the server enforces instead
  of a second copy of the rule. The gate now lives in its own internal module with no database, SSO,
  or Node dependencies; the main entry is unchanged and keeps the full surface, every public export
  keeps its name and shape, and every browser-entry export is also available on the main entry. The
  site's org-controls interactive demo now runs that real gate instead of a hand-maintained copy.
- e1fbaf5: The site's page-speed measurement now runs on the current major release of the Web Vitals
  library, including reliable reporting while the page is busy and a compatibility fix for browsers
  that disable PerformanceObserver. What the site collects is unchanged — the same five anonymous
  speed metrics, still loaded after the page has finished rendering so measurement never slows the
  page down, and still cookieless with no visitor profile created. Per-route soft-navigation
  reporting remains off so each document still produces at most one batch.
- 74f0756: The risk-register interactive demo on the site now drives the real risk-register package end to
  end — authoring, residual computation, treatment-plan assembly, and the audited override flow all
  run the shipped code instead of a hand-maintained copy. The shared test harness gains a
  module-graph walker that statically proves a browser entry never reaches a Node builtin, so this
  class of demo is verified by source analysis rather than trusting a bundler.
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
- f368318: Agent kernel gains a browser-safe `./browser` entry point: the agent/skill/rule schema and its
  authoring helpers, the seven-act lifecycle FSM, the allow/deny/mutate governance algebra, and the
  redacting logger can now be imported inside a client bundle. The main entry is unchanged and keeps
  the full surface, including the shell-command hook handler and the audited hash-chain lifecycle;
  every browser-entry export is also available there.

  Local sync needs no second entry point, because its single entry is now browser-safe end to end:
  the changeset types, the hybrid logical clock, and the tombstone-aware merge all import cleanly
  into a client bundle. As part of that, the replica id minted when a change log is first opened now
  uses the runtime's built-in WebCrypto `crypto.randomUUID()` instead of the Node crypto module —
  the same UUID format, and the id is still persisted and reused on every later open — and the
  package now declares a Node 20.12 minimum.

  The site's agent-kernel and local-sync interactive demos run the shipped packages end to end
  instead of hand-maintained copies of their logic.

- 2caec56: `@caisson/compliance-core` gains a browser-safe `./browser` entry point: the evidence-collector
  contract with its pass, flagged, and unresolved result constructors, four pure collectors (FORCE
  row-level security, WORM retention, risk register, and the impersonation dual trail), the pack
  format, the cross-framework crosswalk rollup, and the newly exported `assembleEvidenceManifest` can
  now be imported inside a client bundle. The main entry is unchanged and keeps the full surface;
  every browser-entry export is also available there.

  `assembleEvidenceManifest` is the flag-never-guess refusal plus the derived, schema-validated
  canonical manifest body, lifted out of `generateEvidencePack` so there is one implementation for
  both callers — `generateEvidencePack` now composes it and keeps sole ownership of the deterministic
  archive and its digest. Behaviour, the blocked-pack error type, and the output bytes are unchanged.
  The archive phase, the audit-chain-integrity collector, and the PHI-encryption collector each need
  Node and remain on the main entry only.

  The site's compliance interactive demo now runs that real assembly and those real collectors end to
  end instead of a hand-maintained copy.

- 0497277: The internal evidence proxy now accepts only time-bounded service credentials. The older unbounded credential form, kept temporarily so the two halves could roll out one after the other, is no longer honored.
- e19da1d: ai-meter gains a browser-safe `./browser` entry point: the versioned price book with its integer
  cost normalizer, the pre-call token estimator, and the spend vocabulary — the default scope, the
  breaker's state shape, and the `SpendCapError` a capped tenant raises — can now be imported inside
  a client bundle. The database-bound half is deliberately absent from it: `reserve()`,
  `reconcile()`, the stored circuit breaker and the schema all stay on the main entry, which is
  otherwise unchanged and still carries the complete surface. Every name on the browser entry is also
  available there, and no existing import moves or changes behavior. The site's ai-meter interactive
  demo now prices its sample calls through that real code instead of a hand-maintained copy.
- 04cf1ff: The anti-slop static-HTML detector's CSS-cascade engine now actually runs: css-select, css-tree,
  and domutils are declared dependencies instead of unresolved dynamic imports that silently fell
  back to the weaker text-only detector in CI. The gate output is unchanged — all existing findings
  remain allowlisted.
- 7d74f8f: The browser-safe `@caisson/kernel/audit-verify` entry point now covers whole-chain verification,
  not just single rows: `buildChainAsync`, `chainEntryAsync`, and `verifyChainAsync` are WebCrypto
  twins of the Node chain builders, and `anchorChain` is available there as the same function the
  Node side already calls. A client or an offline pack verifier can now check that a chain is the
  complete original one, which is the check a cut tail turns on, without pulling the Node crypto
  module. The main entry and the Node entry are unchanged in name, shape, and behaviour, and the
  twins are pinned byte for byte against the originals. The site's audit chain interactive demo now
  runs those real functions end to end instead of a hand-maintained copy.
- f3c62cc: Credits gains a browser-safe `./browser` entry point: the grant and debit event vocabulary and
  `planFifoDebit`, the FIFO waterfall the wallet's own `debit()` walks, can now be imported inside a
  client bundle. Given a list of grant remainders and an amount it returns which grant each credit
  comes off, plus how much the remainders cover and how much they fall short. It reads and writes no
  wallet, so nothing that touches a database or a tenant connection is on the new entry: `grant`,
  `debit`, `clawback`, the balance and ledger reads, the expiry sweeps, and the schema SQL all stay
  on the main entry, which is unchanged and still carries every browser-entry export. Credit amounts
  are integers as before and no wallet, ledger, or 402 behavior changes: the server now calls the
  same shared waterfall instead of its own copy, so a balance or a shortfall shown by a client is the
  one a real debit computes. The site's credits interactive demo runs that shared logic directly
  instead of a hand-maintained copy. The planner validates every supplied remainder before doing
  money arithmetic, so malformed or fractional values fail closed instead of poisoning the reported
  coverage, while drained and negative lines contribute no draw.
- 0d88328: The HTML parser behind the weekly regulatory-claim watch moves to its current major line. Because
  the new parser classifies iframe, xmp, plaintext, noembed, and noframes as raw text, the extractor
  neutralizes only those tag names before parsing and retains the previous open, text, and close event
  behavior for their bodies and following content. Exact fixtures cover those five elements, a
  self-closed iframe, entity decoding, hidden content, and implied closes. HTML with no visible anchor
  remains locator drift instead of becoming a generic manual-review result. The watch reads the same
  sources and stays advisory-only.
- 74f0756: The pure half of the access-review campaign kernel — the decision vocabulary, chain record kinds,
  the decision scan, and the close guard — now lives in its own internal module with no database or
  Node dependencies, and the campaign lifecycle delegates to it, so there is exactly one
  implementation of the close rules. Every public export keeps its name and shape. The site's
  access-review interactive demo now runs that real logic end to end instead of a hand-maintained
  copy.
- Updated dependencies [74f0756]
- Updated dependencies [98bf1f3]
- Updated dependencies [42d9710]
- Updated dependencies [49f26a4]
- Updated dependencies [e1226f6]
- Updated dependencies [8875592]
- Updated dependencies [b2c8c24]
- Updated dependencies [03ca530]
- Updated dependencies [5d1f295]
- Updated dependencies [dff76d9]
- Updated dependencies [42d9710]
- Updated dependencies [f368318]
- Updated dependencies [2caec56]
- Updated dependencies [e19da1d]
- Updated dependencies [68df709]
- Updated dependencies [7d74f8f]
- Updated dependencies [f3c62cc]
- Updated dependencies [74f0756]
  - @caisson/oscal-spine@0.2.0
  - @caisson/frameworks-pack@0.8.0
  - @caisson/compliance-core@0.7.0
  - @caisson/observability@0.3.7
  - @caisson/signing-primitive@0.4.0
  - @caisson/ui@0.6.5
  - @caisson/ai-evals@0.5.0
  - @caisson/alerting@0.3.0
  - @caisson/retention-runner@0.2.0
  - @caisson/agent-trajectory@0.5.0
  - @caisson/field-crypto@1.1.0
  - @caisson/billing-orchestration@0.4.0
  - @caisson/agent-runner@0.3.0
  - @caisson/tool-exec@0.3.0
  - @caisson/prompt-registry@1.1.0
  - @caisson/org-controls@0.4.0
  - @caisson/local-store@1.1.0
  - @caisson/agent-kernel@0.7.0
  - @caisson/local-sync@0.2.0
  - @caisson/ai-meter@1.1.0
  - @caisson/kernel@0.8.0
  - @caisson/credits@0.6.0
  - @caisson/access-review@0.3.3
  - @caisson/risk-register@0.3.3
  - @caisson/trust-page@0.3.3
  - @caisson/cli@0.7.8
  - @caisson/service-license@0.1.2
  - @caisson/audit-worm@2.2.2
  - @caisson/brand@0.1.5
  - @caisson/demo-registry@0.2.13
  - @caisson/ui-pro@0.3.6
  - @caisson/ai-kit@0.6.2
  - @caisson/guardrails@0.4.12
  - @caisson/artifact-render@0.2.3
  - @caisson/auth@0.4.3
  - @caisson/billing@0.6.7
  - @caisson/email@0.5.6
  - @caisson/local-inference@0.1.9
  - @caisson/local-privacy@0.1.9
  - @caisson/migrate@0.2.12
  - @caisson/platform-migrations@0.3.2
  - @caisson/platform-reads@0.2.11
  - @caisson/pricebook@0.8.2
  - @caisson/rate-limit@0.1.10
  - @caisson/registry-schema@0.5.9
  - @caisson/tenancy-rls@0.5.8

## 0.3.1

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- 488cbd4: The test covering the key-management request deadline now allows enough budget for the database preamble before the key unwrap begins. On a loaded machine the old budget could expire while the transaction was still setting up, so the request rejected for the right reason but never reached the key service — the test then failed on an assertion about the abort signal it never got to observe. The behavior under test is unchanged; only the test's own budget moved.
- a5f9ea8: The figure behind an upgrade credit can now be read net of refunds: a partial refund is subtracted from what the buyer was charged, a charge in another currency can no longer outrank a dollar one on its raw number alone, and the read is checked against the licensing service's own arithmetic so the two cannot drift apart. What buyers are credited today is unchanged.

  A refund notice that names the same purchased line twice is now rejected outright instead of being partly applied. Only the first mention was ever recorded, which quietly left the buyer holding more credit than their refund had left them; the provider is now asked to send the notice again rather than have it half-recorded.

- 0739131: The internal proof bearer now carries a signed timestamp and is rejected outside a five-minute
  acceptance window, so the credential expires instead of staying valid until the secret rotates.
  The verifier still accepts the legacy untimestamped form during the verifier-first rollout, and
  the internal-proof rate limiter no longer consumes an account token on a globally-denied request.
- dba957b: The site now declares `server-only` as a dependency instead of relying on the framework to
  substitute it at build time. The demo preview module imports it as a guard that fails the build if
  that server module is ever pulled into a browser bundle, but the package was in no manifest and on
  no lockfile — it resolved solely through an internal build alias. The guard therefore worked only
  inside a full framework build and would have failed to resolve anywhere else, including a plain
  test run. Nothing about the guard's behavior changes; it is now backed by a real installed package.
- 764b027: The dated-commentary registry now has a drafting lane that is separate from the published one. A drafted piece is held in its own list that the hub, the spoke routes, the lookup helper, the sitemap, and the source watch all ignore, so a draft cannot reach the live site because someone forgot a filter; publishing is moving the record into the published list. The first draft is a piece stating legal conclusions about a live regulation, which the operator publishes after reviewing those conclusions.
- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [a5f9ea8]
- Updated dependencies [894fc27]
- Updated dependencies [b5cd9d6]
  - @caisson/registry-schema@0.5.9
  - @caisson/kernel@0.7.0
  - @caisson/frameworks-pack@0.7.0
  - @caisson/agent-kernel@0.6.5
  - @caisson/ai-kit@0.6.1
  - @caisson/alerting@0.2.6
  - @caisson/audit-worm@2.2.1
  - @caisson/billing@0.6.6
  - @caisson/cli@0.7.7
  - @caisson/compliance-core@0.6.3
  - @caisson/field-crypto@1.0.1
  - @caisson/local-inference@0.1.8
  - @caisson/migrate@0.2.11
  - @caisson/platform-migrations@0.3.1
  - @caisson/risk-register@0.3.2
  - @caisson/signing-primitive@0.3.9
  - @caisson/platform-reads@0.2.10
  - @caisson/billing-orchestration@0.3.6
  - @caisson/service-license@0.1.1
  - @caisson/ui@0.6.4
  - @caisson/credits@0.5.11
  - @caisson/pricebook@0.8.1
  - @caisson/access-review@0.3.2
  - @caisson/agent-trajectory@0.4.1
  - @caisson/ai-meter@1.0.11
  - @caisson/artifact-render@0.2.2
  - @caisson/auth@0.4.2
  - @caisson/email@0.5.5
  - @caisson/guardrails@0.4.11
  - @caisson/local-privacy@0.1.8
  - @caisson/local-store@1.0.6
  - @caisson/local-sync@0.1.8
  - @caisson/observability@0.3.6
  - @caisson/org-controls@0.3.6
  - @caisson/prompt-registry@1.0.6
  - @caisson/rate-limit@0.1.9
  - @caisson/retention-runner@0.1.14
  - @caisson/tenancy-rls@0.5.7
  - @caisson/tool-exec@0.2.5
  - @caisson/trust-page@0.3.2
  - @caisson/ui-pro@0.3.5
  - @caisson/demo-registry@0.2.12
  - @caisson/brand@0.1.5
  - @caisson/ai-evals@0.4.6

## 0.3.0

### Minor Changes

- 108a358: The three new compliance modules — access reviews ($199), AI risk register ($279), and trust page ($149) — debut on the marketplace with mechanism diagrams, bundle-page listings, and checkout wiring; the Compliance bundle displays $1,649 with a $659 yearly updates renewal.
- 31bf5f1: Add the RLS-scoped tenant proof view and render persisted evidence-pack maps-to and implements edges separately.

### Patch Changes

- 45784c3: Media and marketplace program wave: an interactive poke slide for all twenty-one remaining modules (parity-pinned against the real packages), bespoke blueprint sheets for every module and bundle with the legacy shared mechanism diagrams retired, a sticky-toolbar marketplace catalog with bundle and module bands on the full container, the cart drawer widened with a true mobile bottom sheet and a marketplace-only summary strip replacing the stack rail and stack dock, and a homepage decision band replacing the stack builder.
- a00a9ef: Dependency baseline repair: the marketing site's motion library moves from the retired
  framer-motion package to its motion successor (same API, new import path — the Living Chain
  scroll sequence keeps its exact spring behavior), alongside a routine kysely and vite patch
  refresh across the site and UI packages. The auth, telemetry, storybook, and playwright
  version bumps from the original non-major batch were reverted pending their supply-chain
  release-age window clearing naturally; none of them fixed a known vulnerability.
- 96aa01d: Record what a buyer paid for each entitlement, and use it as the floor on an upgrade credit.

  An upgrade credit is the retail of each owned item the buyer is trading in. That understates the
  credit for anyone who bought before a price cut: they paid more than the item now lists for, and the
  old behaviour credited them the lower number. The credit now takes whichever is greater, the item's
  retail or what the buyer actually paid.

  Paying for that needs the buyer's own price, which was never stored. It has always been on the
  provider event, one charge per line, but only the whole transaction's total was persisted, and a
  total cannot be split across a multi-item cart afterwards. A new nullable column on the entitlement
  grant records the line's charge and currency at grant time.

  The amount is recorded only when the line's charge is genuinely one item's price. A line bought at
  quantity two charges twice for a single entitlement, and a provider that reports no per-line figure
  sends zero. Both leave the column empty, which reads as unknown and credits at retail, rather than
  inventing a per-item split.

  The quote function takes the paid amounts as an argument, so the pricebook stays free of database
  access and the tenant-scoped read stays with the caller. Each one is an amount together with its
  currency, never a bare integer: a charge of 29900 is $299 in one currency and roughly twice that in
  another, and the two cannot be told apart from the number alone. A charge in a currency the catalog
  does not price in credits at retail rather than being converted, because converting it would mean
  inventing an exchange rate.

- 13e814d: Add disposable request-scoped KMS contexts with append-only Postgres wrapped-key persistence,
  wire production BYOK to purge-protected Azure Key Vault keys, and let MCP run tools bind an async
  field-crypto context and its tenant executor in one atomic transaction without retaining plaintext
  keys between requests.

  BREAKING for direct API consumers, carried as a minor bump because these packages are pre-1.0:

  - `RunToolsDeps.keyProvider` (a `SyncFieldKeyProvider`) is REMOVED from `buildRunTools` and
    replaced by a required `fieldCryptoContext` runner. Callers passing a key provider no longer
    compile.
  - `WrappedKeyStore` gains a required `putWrappedIfAbsent` member, so any external implementation
    of that interface must add it.

  Also bounds request-context prefetch with a new `maxPrefetchVersions` option (default 64), so a
  tenant whose rotation depth exceeds what the request budget can serve fails with an error naming
  that depth instead of an anonymous deadline timeout; accepts AWS multi-Region `mrk-` key
  identifiers and reports replica-pending deletion without inventing a deletion date; requires an
  explicit Azure service principal rather than resolving an ambient credential chain; and erases key
  material returned by a provider call that completes after its deadline already elapsed.

- 45784c3: Interactive poke slides for field-crypto, audit-worm, ai-meter, and guardrails: real in-browser runs of each package mechanism (WebCrypto mirrors parity-pinned against package output and golden fixtures), a new poke slide kind in the media pipeline with sheet-then-poke ordering, and the carousel yielding arrow keys to interactive slides.
- 2cd4184: Complete the marketplace depth treatment for access reviews, the AI risk register, and the trust
  page with source-grounded records, poke-first media, bespoke token-following glyphs, and a 26/26
  sellable-module parity guard.
- 45784c3: The module-schematics pilot trio: a bespoke schematic vocabulary (blueprint linework
  sheets for module pages, cross-section strata for bundle pages) rendered as
  token-styled hairline SVG on a grid-paper ground, with three pilot sheets — the
  field-crypto derivation/gate/envelope blueprint, the audit-worm chain/anchor/truncation
  blueprint, and the Compliance bundle cross-section. The two module sheets replace the
  shared generic diagrams on their own pages; the strata joins the compliance bundle's
  carousel behind its composition slide.
- 6f44c60: Publish dedicated refund-policy and buyer-support routes for Paddle verification, align Terms
  support links on `support@caisson.sh`, and register both pages in the canonical sitemap/footer
  route surface.
- 96aa01d: Document the session-token HMAC key in the service env contract. The variable is required once the
  database and auth secret are configured, and a missing value crashes the boot rather than degrading
  sign-in, so it belongs in the same list as the other required service variables.
- 96aa01d: Generate the docs source module before running the site test suite. One test file reaches the docs
  source through the trust-signals helper, and that module is produced by the app build rather than
  checked in. Nothing ordered the build ahead of the tests, so the suite passed or failed on whether a
  previous build happened to leave the artifact behind. Generating it in the test script takes a few
  milliseconds and makes the run self-sufficient.
- ea2bee1: Truth-align two board-audit launch-blockers: the hero install block's chip states "private beta" (muted) instead of a success-tone "ready" while the CLI package is unpublished, and the compliance/provenance/home WORM copy states GOVERNANCE-mode Object Lock today with a typed, recorded escalation to COMPLIANCE at launch, dropping the COMPLIANCE-only leaked-root-key claim.
- af54102: Visual-remediation closeout: eyebrow variation pass across the bundle, security, procurement, marketplace, and legal page families; legal conspicuous clauses restyled from all-caps to bold sentence case on a set-off band (wording unchanged); clause-break dashes swept out of buyer-facing prose in comparisons, docs content, and legal pages; marketplace stack total docked as a mobile bottom bar with a live-region total; persistent header CTA demoted to secondary; docs search palette completes its tab semantics with a touch close control and suggested pages; admin top nav collapses behind a mobile disclosure panel.
- 5788b03: The marketplace hero artifact's label names the Everything bundle instead of silently
  omitting it: "one base, 5 composable bundles + Everything" no longer contradicts the
  page's own six-bundle lede and facet. The five-chip composition is unchanged;
  Everything is the whole-catalog purchase, not a sixth thing composing alongside the
  five it contains.
- 78a3b8f: Close the six open live-reaudit ledger rows: the docs heading-anchor and code-copy
  buttons (which ship without the size-token class hook) join the 44px invisible-catchment
  pass via their aria-labels; the field-crypto code-panel label tightens so label plus file
  path holds one line at desktop; the home lifecycle diagram's chain notation unifies on the
  double-vertical-bar glyph the adjacent evidence card uses; the shared footer gains
  dock-height clearance on the marketplace mobile cutover so the fixed stack dock never sits
  over its last rows at full scroll; and the AI-Production lede gains a sentence reconciling
  its call-path narration with the seven-module composition list.
- 2bfc60e: Post-deploy re-audit nits: the terms page's inline EULA link gains the underlined link
  treatment (it was color-alone), and the marketplace catalog section drops its duplicate
  accent eyebrow so the hero carries the page's single accent kicker.
- 56e46f1: Visual-remediation residual batch: legal pages gain a fixed "On this page" jump-nav rail
  occupying the flagged right-column dead space (62ch measure untouched); the footer
  newsletter Turnstile widget survives sibling mounts (script-dedup race fixed, widget
  cleanup on unmount); the visual harness drops third-party challenge-platform console
  noise by source origin; light-mode surface-1 steps to oklch L 0.965 so cards read as
  surfaces against the page background (contrast matrix re-verified); the admin
  foundations accent-fork panels render as an explicit three-up grid instead of orphaning
  Panel C in an empty quadrant.
- Updated dependencies [108a358]
- Updated dependencies [0d87855]
- Updated dependencies [6d1c805]
- Updated dependencies [31bf5f1]
- Updated dependencies [25fd03c]
- Updated dependencies [36dd6ed]
- Updated dependencies [108a358]
- Updated dependencies [a00a9ef]
- Updated dependencies [6d1c805]
- Updated dependencies [6d1c805]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [13e814d]
- Updated dependencies [0d87855]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
- Updated dependencies [2cd4184]
- Updated dependencies [a21c478]
- Updated dependencies [96aa01d]
- Updated dependencies [108a358]
- Updated dependencies [fe2dfac]
- Updated dependencies [6d1c805]
- Updated dependencies [56e46f1]
  - @caisson/access-review@0.3.1
  - @caisson/ai-kit@0.6.0
  - @caisson/ui@0.6.3
  - @caisson/audit-worm@2.2.0
  - @caisson/registry-schema@0.5.8
  - @caisson/local-inference@0.1.7
  - @caisson/pricebook@0.8.0
  - @caisson/observability@0.3.5
  - @caisson/email@0.5.4
  - @caisson/service-license@0.1.0
  - @caisson/platform-migrations@0.3.0
  - @caisson/field-crypto@1.0.0
  - @caisson/agent-trajectory@0.4.0
  - @caisson/kernel@0.6.0
  - @caisson/rate-limit@0.1.8
  - @caisson/brand@0.1.5
  - @caisson/compliance-core@0.6.2
  - @caisson/frameworks-pack@0.6.1
  - @caisson/agent-kernel@0.6.4
  - @caisson/ai-evals@0.4.5
  - @caisson/ai-meter@1.0.10
  - @caisson/alerting@0.2.5
  - @caisson/guardrails@0.4.10
  - @caisson/local-store@1.0.5
  - @caisson/prompt-registry@1.0.5
  - @caisson/retention-runner@0.1.13
  - @caisson/cli@0.7.6
  - @caisson/demo-registry@0.2.11
  - @caisson/ui-pro@0.3.4
  - @caisson/risk-register@0.3.1
  - @caisson/credits@0.5.10
  - @caisson/platform-reads@0.2.9
  - @caisson/artifact-render@0.2.1
  - @caisson/auth@0.4.1
  - @caisson/billing@0.6.5
  - @caisson/billing-orchestration@0.3.5
  - @caisson/local-privacy@0.1.7
  - @caisson/local-sync@0.1.7
  - @caisson/migrate@0.2.10
  - @caisson/org-controls@0.3.5
  - @caisson/signing-primitive@0.3.8
  - @caisson/tenancy-rls@0.5.6
  - @caisson/tool-exec@0.2.4
  - @caisson/trust-page@0.3.1

## 0.2.14

### Patch Changes

- 0f2215e: Module depth-page prose prices now derive from the canonical catalog instead of hand-typed
  literals, so a future price change can never silently desync the page copy. This also fixes
  three pages (governed tool execution, org controls, local sync) that rendered raw template
  source instead of the intended bundle price. A data-lint now pins both failure modes.
- Updated dependencies [0f2215e]
- Updated dependencies [d0e6b5c]
- Updated dependencies [31d59fd]
  - @caisson/cli@0.7.5
  - @caisson/platform-reads@0.2.8
  - @caisson/registry-schema@0.5.7
  - @caisson/ai-kit@0.5.5
  - @caisson/credits@0.5.9
  - @caisson/pricebook@0.7.2
  - @caisson/service-license@0.0.18
  - @caisson/ai-meter@1.0.9
  - @caisson/platform-migrations@0.2.11
  - @caisson/demo-registry@0.2.10

## 0.2.13

### Patch Changes

- cd48b89: Bespoke catalog marks for the twelve newest module pages replace the temporary generic icons: agent-trajectory, tool-exec, org-controls, compliance-core, billing-orchestration, ui-pro, local-inference, local-privacy, local-sync, frameworks-pack, signing-primitive, and credits now each carry a purpose-drawn domain glyph in the same line-icon family as the rest of the catalog, so every module reads as part of one designed set across the nav, cards, and depth-page heroes.
- 3caa1e7: Glossary: seven new mechanism terms — durable outbox, idempotency key, canonical JSON, additional authenticated data, PII redaction, prompt injection, and deterministic replay — each grounded in the shipped implementation with real code artifacts. The glossary now covers fifty terms.
- 8f07b01: Glossary: seven new terms covering the recently shipped compliance and agent surfaces — RFC 3161 timestamping, transparency log, evidence receipt, compliance crosswalk, signed audit anchor, agent trajectory, and token hashing at rest — plus an accuracy pass over all existing glossary pages: code artifacts regenerated from current shipped source and several claims scoped precisely to what ships (shipped KMS drivers, the admin-write package boundary, the encryptedColumn vs encryptField grade split, BYOK credit coverage, retention default vs floor).
- e07319f: Marketplace: twelve new module depth pages — agent-trajectory, tool-exec, org-controls, compliance-core, billing-orchestration, ui-pro, local-inference, local-privacy, local-sync, frameworks-pack, signing-primitive, and credits — each with real code artifacts, capability grids, and buyer FAQs; every sold standalone module now carries a full page. Also fixes the ai-evals page to state its real bundle membership (it is included in the AI-Production bundle) and adds catalog marks for the new pages.
- b8b14b4: Session tokens are now stored hashed at rest: buyer session cookies are looked up by an
  HMAC-SHA-256 lookup key instead of the raw bearer token, so a database export alone is no
  longer a usable session credential. This ships as a one-time hard cutover — every
  currently-signed-in buyer is signed out and simply signs back in.
- d6e9c14: The /updates page now explains how Compliance Updates coverage windows work: what each renewal cycle stamps, how the registry resolves your most favorable window across owned licenses and an active subscription, and what happens (and doesn't happen) to already-pulled code if you cancel.
- Updated dependencies [bd071c9]
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
- Updated dependencies [b8b14b4]
- Updated dependencies [16de8df]
  - @caisson/audit-worm@2.1.4
  - @caisson/ui@0.6.2
  - @caisson/brand@0.1.4
  - @caisson/ai-kit@0.5.4
  - @caisson/ai-meter@1.0.8
  - @caisson/auth@0.4.0
  - @caisson/billing@0.6.4
  - @caisson/cli@0.7.4
  - @caisson/credits@0.5.8
  - @caisson/demo-registry@0.2.9
  - @caisson/email@0.5.3
  - @caisson/field-crypto@0.3.5
  - @caisson/kernel@0.5.3
  - @caisson/local-store@1.0.4
  - @caisson/migrate@0.2.9
  - @caisson/observability@0.3.4
  - @caisson/org-controls@0.3.4
  - @caisson/platform-migrations@0.2.10
  - @caisson/platform-reads@0.2.7
  - @caisson/pricebook@0.7.1
  - @caisson/prompt-registry@1.0.4
  - @caisson/rate-limit@0.1.7
  - @caisson/registry-schema@0.5.6
  - @caisson/tenancy-rls@0.5.5
  - @caisson/ui-pro@0.3.3
  - @caisson/service-license@0.0.17

## 0.2.12

### Patch Changes

- 2bda239: The updates-renewal book can now carry a multi-year tenor per SKU: a renewal row may extend
  the updates window by two or three years in one purchase instead of a flat one-year
  extension, with every existing renewal row unchanged and still resolving to its one-year
  default. The site's renewal-pricing helpers gained a matching multi-year display
  calculation, floored to the same whole-dollar-ending-in-9 price points as the existing
  one-year renewal prices. No SKU is sold on a multi-year tenor yet and no new price appears
  anywhere in the product — this lands the machinery only.
- Updated dependencies [2bda239]
- Updated dependencies [098fe54]
  - @caisson/pricebook@0.7.0
  - @caisson/platform-reads@0.2.6
  - @caisson/service-license@0.0.16
  - @caisson/platform-migrations@0.2.9

## 0.2.11

### Patch Changes

- Updated dependencies [2229209]
- Updated dependencies [8ff4c62]
  - @caisson/ai-kit@0.5.3
  - @caisson/registry-schema@0.5.5
  - @caisson/platform-reads@0.2.5
  - @caisson/cli@0.7.3
  - @caisson/credits@0.5.7
  - @caisson/pricebook@0.6.1
  - @caisson/service-license@0.0.15
  - @caisson/ai-meter@1.0.7
  - @caisson/platform-migrations@0.2.8
  - @caisson/demo-registry@0.2.8

## 0.2.10

### Patch Changes

- 6f0af8a: The agent-trajectory module is now purchasable: priced at $49 a la carte, creditable
  toward an Agentic-Dev or Everything bundle upgrade, with its bundle membership recorded
  in the pricing timeline as of 18 July 2026. The purchase and renewal books route its
  checkout and updates-renewal to the module's entitlement, and the pricing page lists it
  alongside the other Agentic-Dev modules with its own mechanism diagram.
- Updated dependencies [6f0af8a]
- Updated dependencies [fc0bb99]
- Updated dependencies [fc0bb99]
  - @caisson/pricebook@0.6.0
  - @caisson/kernel@0.5.2
  - @caisson/platform-reads@0.2.4
  - @caisson/service-license@0.0.14
  - @caisson/ai-kit@0.5.2
  - @caisson/ai-meter@1.0.6
  - @caisson/audit-worm@2.1.3
  - @caisson/auth@0.3.5
  - @caisson/billing@0.6.3
  - @caisson/cli@0.7.2
  - @caisson/credits@0.5.6
  - @caisson/email@0.5.2
  - @caisson/field-crypto@0.3.4
  - @caisson/local-store@1.0.3
  - @caisson/migrate@0.2.8
  - @caisson/observability@0.3.3
  - @caisson/org-controls@0.3.3
  - @caisson/platform-migrations@0.2.7
  - @caisson/prompt-registry@1.0.3
  - @caisson/rate-limit@0.1.6
  - @caisson/tenancy-rls@0.5.4
  - @caisson/ui-pro@0.3.2
  - @caisson/demo-registry@0.2.7

## 0.2.9

### Patch Changes

- Updated dependencies [5d03808]
- Updated dependencies [7de6fa4]
- Updated dependencies [63e9fae]
  - @caisson/registry-schema@0.5.4
  - @caisson/kernel@0.5.1
  - @caisson/platform-reads@0.2.3
  - @caisson/ai-kit@0.5.1
  - @caisson/cli@0.7.1
  - @caisson/credits@0.5.5
  - @caisson/pricebook@0.5.6
  - @caisson/service-license@0.0.13
  - @caisson/ai-meter@1.0.5
  - @caisson/audit-worm@2.1.2
  - @caisson/auth@0.3.4
  - @caisson/billing@0.6.2
  - @caisson/email@0.5.1
  - @caisson/field-crypto@0.3.3
  - @caisson/local-store@1.0.2
  - @caisson/migrate@0.2.7
  - @caisson/observability@0.3.2
  - @caisson/org-controls@0.3.2
  - @caisson/platform-migrations@0.2.6
  - @caisson/prompt-registry@1.0.2
  - @caisson/rate-limit@0.1.5
  - @caisson/tenancy-rls@0.5.3
  - @caisson/ui-pro@0.3.1
  - @caisson/demo-registry@0.2.6

## 0.2.8

### Patch Changes

- Updated dependencies [c7476b9]
- Updated dependencies [f40653b]
- Updated dependencies [ba4f62d]
- Updated dependencies [9d50e7c]
- Updated dependencies [c3b0e41]
- Updated dependencies [4c6d3f7]
  - @caisson/ai-kit@0.5.0
  - @caisson/cli@0.7.0
  - @caisson/registry-schema@0.5.3
  - @caisson/ai-meter@1.0.4
  - @caisson/platform-reads@0.2.2
  - @caisson/credits@0.5.4
  - @caisson/pricebook@0.5.5
  - @caisson/service-license@0.0.12
  - @caisson/demo-registry@0.2.5
  - @caisson/platform-migrations@0.2.5
  - @caisson/audit-worm@2.1.1

## 0.2.7

### Patch Changes

- Updated dependencies [f844386]
  - @caisson/cli@0.6.3

## 0.2.6

### Patch Changes

- 8b01527: Sharpen the compliance and build-vs-buy copy: the compliance page now shows how the evidence
  format is proven — naming the OSCAL conformance check that runs on every push and stating exactly
  what it covers (a self-run schema check on Caisson's export format, not a third-party assessment).
  The build-vs-buy FAQ answers two questions buyers actually ask — why an AI coding assistant is not
  a substitute on the money and crypto seams, and what support and updates come with owned source
  (email and Discord support, 12 months of updates, and the perpetual license and vendor-continuity
  guarantees). The homepage compliance door claim reads segment-neutral so any audited team sees
  itself.
  - @caisson/cli@0.6.2

## 0.2.5

### Patch Changes

- d5ae100: Ask-AI: emit a PostHog `$ai_generation` LLM-observability event per model call

  The public Ask-AI route calls OpenRouter directly (it bypasses the sold `@caisson/ai-kit`
  package, which must never carry a hardcoded vendor sink), so its generations were invisible in
  PostHog — the M4 audit finding of zero `$ai_*` events in caisson-prod. The route now surfaces the
  OpenRouter usage token counts it previously discarded and, after each real model call, fires one
  fire-and-forget, fail-soft `$ai_generation` capture carrying model, provider, input/output tokens,
  total USD cost, latency, and HTTP/error status. No prompt or completion text ever leaves the box —
  `$ai_input` and `$ai_output_choices` are never sent. Config-gated on `POSTHOG_CAPTURE_KEY`; when it is
  unset there is no capture and zero behavior change.

- 12182a5: Renumber the three demo-run site-local migrations 0023-0025 → 0027-0029: the shared
  platform chain had itself grown 0023_order_record_subscription_link…0026_affiliate_code, so the
  demo entries sorted mid-chain, renumbered prod's applied positional ledger, and failed the
  caisson-license predeploy closed on checksum drift (nothing applied). The migrations have never
  been applied anywhere persistent, so the rename is safe. Adds an append-only assembled-ledger
  golden test pinning the merged chain, and updates the claimed-prefix registry note (next free:
  0030).
- d3a889a: Ship the /demo sandbox surface: a capped, Turnstile-gated demo-run that generates a visitor's own
  scaffold in-process behind atomic daily and concurrency budgets with per-IP rate limits, a shared
  prebuilt preview pane rendering a real passing install, build, and test transcript of the demo app,
  and a read-only commercial-excerpt section backed by an append-only, secret-scanned, drift-guarded
  manifest. Request bodies across the demo-run and ask-ai routes now read through a shared streaming
  size cap that a chunked or garbage content-length request cannot bypass.
- Updated dependencies [12182a5]
- Updated dependencies [1de88d7]
  - @caisson/platform-migrations@0.2.4
  - @caisson/audit-worm@2.1.0
  - @caisson/cli@0.6.2
  - @caisson/demo-registry@0.2.4
  - @caisson/service-license@0.0.11
  - @caisson/platform-reads@0.2.1

## 0.2.4

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2
  - @caisson/credits@0.5.3
  - @caisson/pricebook@0.5.4
  - @caisson/service-license@0.0.10
  - @caisson/ai-kit@0.4.4
  - @caisson/ai-meter@1.0.3
  - @caisson/platform-migrations@0.2.3
  - @caisson/platform-reads@0.2.1
  - @caisson/demo-registry@0.2.3

## 0.2.3

### Patch Changes

- Updated dependencies [3f05e1e]
- Updated dependencies [3f05e1e]
  - @caisson/ai-kit@0.4.3
  - @caisson/registry-schema@0.5.1
  - @caisson/credits@0.5.2
  - @caisson/pricebook@0.5.3
  - @caisson/service-license@0.0.9
  - @caisson/ai-meter@1.0.2
  - @caisson/platform-migrations@0.2.2
  - @caisson/platform-reads@0.2.1
  - @caisson/demo-registry@0.2.2

## 0.2.2

### Patch Changes

- 7e823a9: Renovate dependency pins (exact versions) across the app and service workspaces; no code change.
- a8d8f5e: Add a Trust page that links the public status page, gives the security contact, points to the shipped security and evidence documentation, and lists the third-party services that process data for the Caisson service. Link it from the site footer.
- Updated dependencies [93c0a78]
- Updated dependencies [ca44db5]
- Updated dependencies [baaa4fc]
- Updated dependencies [a8696cf]
- Updated dependencies [1867fa3]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [a0fd9b1]
- Updated dependencies [d1b4afa]
- Updated dependencies [7e823a9]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/ai-kit@0.4.2
  - @caisson/audit-worm@2.0.0
  - @caisson/org-controls@0.3.1
  - @caisson/auth@0.3.3
  - @caisson/kernel@0.5.0
  - @caisson/ui-pro@0.3.0
  - @caisson/email@0.5.0
  - @caisson/service-license@0.0.8
  - @caisson/brand@0.1.3
  - @caisson/demo-registry@0.2.1
  - @caisson/observability@0.3.1
  - @caisson/ui@0.6.1
  - @caisson/prompt-registry@1.0.1
  - @caisson/platform-migrations@0.2.1
  - @caisson/ai-meter@1.0.1
  - @caisson/billing@0.6.1
  - @caisson/credits@0.5.1
  - @caisson/field-crypto@0.3.2
  - @caisson/local-store@1.0.1
  - @caisson/migrate@0.2.6
  - @caisson/pricebook@0.5.2
  - @caisson/tenancy-rls@0.5.2
  - @caisson/platform-reads@0.2.1
  - @caisson/registry-schema@0.5.0

## 0.2.1

### Patch Changes

- 3ae944a: AEO program: AI-crawler robots allow group, agentic-dev FAQPage JSON-LD, three glossary explainers, and the 20-page Caisson-vs-X comparison family with hub, sitemap, and FAQ schema.
- d357ec3: The affiliate page's payout copy is now accurate: referred sales are billed and collected by
  Paddle as merchant of record, and Caisson pays commissions to affiliates directly once a sale
  clears its 14-day refund window (the page previously said commissions were paid out through
  Paddle, which isn't how a merchant of record works). Private app; no publishable release.
- e02aedd: The Ask AI widget's "Talk to the team" link now opens a direct email to the team instead of
  routing to the security/procurement page, and a question the assistant couldn't answer now
  files a support ticket automatically from the question text so a human can follow up —
  previously the widget captured the question for product analytics only, with no ticket and
  no direct contact path. A capacity-limit escalation (the daily usage cap) does not file a
  ticket, since it isn't a question a human needs to answer.
- 08fd857: Fixes all 7 findings from the July 2026 production browser audit of the public site:

  - The homepage "Real paths. Real code." code viewer was invisible at every breakpoint: CSS Modules
    was silently scoping the `#repo-artifact-tab-*` id selectors that drive the pure-CSS `:has()`
    reveal, so they never matched the real DOM ids and every card stayed `display: none`. The ids are
    now wrapped in `:global()`.
  - `/docs` had no `<main>` landmark, so the "Skip to content" link had no target to scroll or focus
    to; fumadocs' `DocsLayout` now wraps its children in one `<main id="main-content" tabIndex={-1}>`.
  - The marketplace compare checkbox's safe click target was 13x13px, well under the WCAG 2.2 2.5.8
    minimum, and sat under the card's full-surface preview button. It now has an invisible 44x44
    hit area lifted above the stretched action.
  - The docs search dialog dropped focus to `<body>` on every dismissal path (Escape, close button,
    backdrop) because none of its triggers render Radix's own `<Dialog.Trigger>`, so Radix's built-in
    focus-restore never had a trigger to return to. It now tracks whichever element opened the dialog
    and restores focus there via `onCloseAutoFocus`.
  - The docs GitHub nav icon was an `<svg role="img">` with no accessible name. It now renders via a
    site-owned `links` icon item (`aria-hidden` on the glyph) instead of fumadocs' `githubUrl`
    shortcut, which hardcodes the unlabeled SVG; the link itself keeps its `aria-label="GitHub"`.
  - A sitewide 44px touch-target pass: the cart trigger, mobile-nav toggle, media-carousel arrows, the
    shared `Button` recipe, and fumadocs' own search/sidebar/GitHub icon-button trio now all carry an
    invisible centered hit-area expansion — visual sizes are unchanged.
  - The homepage depth-fog hero field now probes `canvas.getContext("webgl2")` before ever
    constructing `THREE.WebGLRenderer`, and silences three.js's own console hook for the renderer
    construction attempt, so an environment that can't allocate WebGL falls back to the poster without
    logging repeated renderer errors.

- 230f02a: Added a "Buy credits" button on the Credits dashboard page, so a 5,000-credit top-up pack can be
  purchased directly instead of needing to contact support. Also fixed the "Current balance" tile so
  it never overstates what you can actually spend: it now reflects your real spendable total right
  away, rather than briefly counting expired credits until the next daily cleanup runs.
- ff1d928: Add a deterministic browser end-to-end suite that runs against a local production build in CI:
  it pins the homepage code viewer's visibility and selection swap, the docs main landmark and
  skip-link focus behavior, the marketplace compare control's enlarged tap target and stacking
  above the card preview action, docs-search focus return on dismissal, and the 44px hit-area
  overlays on the docs chrome, nav cluster, and media-carousel arrows at mobile width.
- 230f02a: Add-to-cart buttons now recognize what your account already owns: an already-purchased bundle or
  module shows as "Owned" instead of letting you add and pay for it a second time. Also, if a stale
  item is ever silently dropped from your cart (for example, a retired SKU left over from an earlier
  visit), you now see a one-line notice explaining what was removed instead of the item just
  disappearing with no explanation.
- 230f02a: Fixed two checkout reliability bugs. A failed Paddle checkout load (ad-blocker, flaky network,
  misconfigured token) used to silently break checkout for the rest of your session — reloading the
  page is no longer required, and the Pay button now shows a real error message instead of just
  reverting. Also, your cart is now cleared only after a payment actually completes, not the instant
  the checkout window opens — if you open checkout to review the total and then cancel, your cart
  lines are no longer lost.
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

- 4036574: The Resend email driver gains an optional `replyTo` config field, sent as the `reply_to` field
  on the wire so replies to a transactional send land in a real inbox instead of bouncing off a
  no-reply sender. The three product senders (site magic links, license lifecycle notices, the
  admin test-send) opt in with the support inbox, and user-facing contact copy on the refunds,
  procurement, partners, and affiliates pages plus the ask-AI panel now points at the support
  address; legal pages keep the accounts contact.
- 0137008: Buyer-surface remediation (Kickoff G): fixes the /dashboard/ai-keys P0 crash by
  unifying the apps/site-local migration list (`deploy-migrate.ts` and the dev PGlite double now
  apply the SAME list, closing a prod/dev migration drift that left `byok_key_meta` never created in
  production); adds a fail-closed AI-Production entitlement gate to /dashboard/ai-keys (page load +
  every `/api/byok` action); fixes the dashboard topbar account pill clipping and adds Sign-out to
  the mobile nav drawer; fixes the login form so an invalid-submit error renders visually distinct
  from a success message; corrects purchase-row labels to the canonical bundle names and the plan
  page's "Bundles & modules" heading; and adds the EULA's Credits clause (expiry, FIFO burn order,
  rollover) — pending operator sign-off on the exact wording.
- f0ab087: The getting-started guide now covers the post-purchase flow: where the license key comes from
  (`/dashboard/license`), the `CAISSON_LICENSE_TOKEN` a generated project's `.npmrc` needs before
  `bun install`, and two ways an AI coding agent can drive Caisson — shelling out to `create-caisson`
  directly, or wiring the auth-gated `@caisson/mcp-server` for tool-native access. The stale
  positional-argument install example is replaced with the CLI's real interactive and flagged forms.
- 3da56f0: Fixes a flaky e2e test: two header-control and carousel-arrow hit-area assertions in
  `browser-audit-p1.e2e.test.ts` occasionally read `getBoundingClientRect()` as 0x0 on a slow
  CI runner, because `page.goto`'s "load" event resolves before the browser guarantees the
  next paint — an evaluate that runs immediately after can see every rect collapsed and drop
  every result (`controls.length === 0` on two consecutive main-branch runs on 2026-07-11).
  Both evaluates now go through a small bounded-retry helper that reruns the same evaluate up
  to four times with a 500ms backoff whenever it detects it read pre-paint geometry, and
  otherwise returns immediately; a genuine post-paint failure still fails loudly after the cap.
  Test-only change, no product behavior touched.
- 9a81dd7: Platform migration 0017 (renewal_extension ledger) added to the deploy assembler; members-gate denies undrained legacy edition rows after the edition-trace purge.
- 74df6fe: The production route sweep now attributes console errors to their source frame: noise the
  Cloudflare challenge platform emits by design (its token probe's expected 401 and its styled
  log lines) is dropped by origin URL, while everything from the site's own frames — and every
  page error — stays zero-tolerance. The sweep passes 18/18 against production with the
  challenge widget armed.
- e0b000b: Fixed four marketing-surface honesty gaps. The Compliance, Local-first, and Agentic-Dev bundle pages, plus the AI-Production page, no longer link a composed member module to a depth page that doesn't exist yet — a module card is only clickable once its `/marketplace/modules/<slug>` page is live, closing a set of dead links that hit the flagship Compliance page mid-evaluation. The marketplace's structured data no longer advertises purchase URLs for modules that have no page. The AI-Production bundle page now lists its full, real set of composed modules instead of an undercount. And a Discord invite link now appears in the site footer and the dashboard's Community section once the operator sets one — closing the gap where a purchase granted a Discord role in a server nobody could find a way to join.
- 20fa0dc: The marketplace media standard has arrived: every one of the 28 catalog items (22 modules + 6 bundles)
  now renders real media in the marketplace card viewer and module depth pages — closing the prior
  8/28 media gap to 28/28 on one standardized framed-slide template (a chrome bar + body mirroring the
  homepage-terminal aesthetic). Content preference per item: the actual live `@caisson/ui-pro`
  component the item ships (ui-pro's data grid + audit timeline, rendered presentationally — no slide
  pulls interactive state); the item's real depth-page code artifact (the eight modules that already
  carry one — alerting, ai-meter, ai-evals, guardrails, prompt-registry, local-store, agent-kernel,
  agent-runner — rendered through the same framed `CodeBlock` the homepage uses); or an authored
  mechanism/composition diagram for everything else. Every bundle now leads with a composition slide
  naming its own real member modules composing onto the Apache-2.0 audited base (the Everything bundle
  reuses the whole-catalog hero artifact), and eight new authored diagrams close the gap for the
  remaining concept-only modules (credits, local-sync, local-inference, local-privacy, tool-exec,
  org-controls, billing-orchestration, frameworks-pack). The single existing audit-worm Remotion video
  slide is replaced by a static code-artifact slide for uniformity — the Remotion pipeline itself is
  untouched and stays available, just unused by the marketplace launch set. A `code-artifact` slide now
  counts toward the MEDIA facet on the same footing as a diagram or a live component.
- c78123d: Rework the marketplace into a single surface. Every bundle and module now lives in one filterable grid — filter by type, category, or price, search by name, and preview each card in a unified viewer with a media carousel (authored diagrams for the top modules, the audit-worm render, and the live UI Pro demo). The former Modules and Build tabs fold in: a cart-aware "Your stack" rail shows the running total and points at the bundle that covers your picks for less, and the compare tray now spans bundles and modules together. The homepage honest-artifact section becomes an interactive, color-coded source tree that reveals the real code on click, and the evidence and dual-door proof chips get a cleaner, bolder treatment.
- ef14a65: Marketplace browsing now completes a purchase without leaving the page. The module preview grew
  into a full purchase card — media slot, definition, what-ships, code artifact, stack and bundle
  badges, a collapsed FAQ, and add-to-cart — and a matching bundle pop-out reads a new shared bundle
  content record (the five standalone bundle pages now render their hero, members, and FAQ from it,
  with the same SEO output). The ui-pro module's pop-out shows a live demo of real premium components.
  Hub bundle cards open the pop-out instead of navigating, both pop-outs are deep-linkable via a query
  param, and the standalone pages stay as spokes linked from inside each pop-out.

  The bundles nav dropdown is now a two-column panel: all six bundles on the left, the marketplace
  pages (hub, modules, build, plans, compare, and the UI Pro showcase) on the right. The cart gains a
  bundle upsell — when the modules in your cart cover most of a bundle's price, it offers the whole
  bundle in one click. The module grid adds text search, a has-a-demo filter, and a compare tray for
  viewing up to three modules side by side.

- 230f02a: Teammates invited to an Org Controls account can now actually reach it: the dashboard has a new
  account switcher for anyone who belongs to more than one account, so an invited seat is no longer
  stuck on their own personal account with no way to find the org they were added to. The Members
  page also gains a self-serve "Remove" control for the account owner — offboarding a departed
  teammate no longer requires contacting support. An owner can never accidentally remove themselves
  or another owner through this control.
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
- ba04bc1: A shared platform migration chain, so the marketing/dashboard app and the operator admin app
  apply the exact same ordered database schema.

  `@caisson/platform-migrations` is a new, private, unpublished package: the ordered chain of
  platform schema migrations (credits, entitlements, licenses, usage metering, and their
  follow-on columns), plus a small helper that assembles and applies the chain against either a
  real Postgres or an in-memory PGlite double. It is the one place this chain is defined now.

  The marketing/dashboard app's deploy-time migration runner reads the chain from this new
  package instead of declaring it locally. The admin app's local development database bootstrap
  now applies the SAME chain instead of hand-copying individual schema pieces — closing off a
  class of drift where the admin app's local database could silently fall behind the real one. A
  new automated check boots the admin app's local database and confirms every cross-tenant read
  table exists with the correct row-level security in place.

- fb72fdd: Added the priority-support subscription SKU as a catalog entry, price-agnostic: no dollar amount and no response-time commitment are set yet, so it carries no buy button and no checkout path anywhere on the site. The response-time line reads from a single config value so it can never show two different numbers once the terms are set.
- 6d0a5c5: Research-response site wave: a new evidence-pack page presenting the already-shipped proof artifacts (OSCAL conformance in CI, the standards gate, registry provenance, test suites, WORM live proofs, threat registers) for a security reviewer; a "does it fit my stack?" adapter matrix covering ORM bridges, auth, database posture per module, WORM storage backends, AI providers, and MCP transports; a "prove fit in week one" trial path surfaced on every bundle page and in the module and bundle pop-outs; a founder-transparency block on the homepage (open Apache-2.0 base, public changelog, design partners); a pricing-page terms rework answering "what happens after 12 months?" with support-responsiveness and licensing clarity near checkout; and a quiet design-partner application page.
- 230f02a: Signing out now revokes your session on the server, not just the cookie in your browser, so a
  previously captured session token can no longer be reused after you've signed out. The sign-out
  request is also now checked to make sure it actually came from the site itself, closing off a way
  another website could have forced a visitor's browser to sign out. Separately, the Compliance
  dashboard page and its evidence-record download now correctly require the Compliance core
  entitlement (or an equivalent bundle) — previously any signed-in account could open it regardless
  of purchase status.
- e4e52e2: Both test-side mocks of `lib/auth-server.ts` now spread the real module and override only
  `getAuth`, instead of returning a partial export object. Bun's `mock.module` is process-wide and
  never torn down, so a partial factory gutted `createAuth` and `SESSION_HINT_COOKIE_NAME` for every
  later-loaded test file — `auth-server.test.ts`'s static import then failed with "Export named not
  found" on runners whose file discovery order differs from local (the first main-branch `check`
  failure after the runner migration). Test-only change; no product behavior is affected.
- 2ddcc2d: Make `lib/auth.test.ts` deterministic under any test-file load order. It now declares its own
  `./auth-server.ts` mock so `getAuth()` returns null (the "sign-in runtime unavailable" state it
  asserts), instead of relying on the real `getAuth()` reading unset env. Bun's `mock.module` is
  process-wide and never torn down, so the sibling `auth-account.test.ts` (which mocks the same
  module to a fixed signed-in session) leaked into this file whenever Bun loaded it first, and file
  discovery order is not stable across machines. That surfaced as a `check`-job failure when the CI
  runner changed. Test-only change; no product behavior is affected.
- cebc7f0: The Turnstile challenge widget and dashboard product analytics now actually arm in
  production: their public configuration values are baked into the client bundle at image
  build time (they were previously set on the service but never reached the build, so both
  features silently no-opped). The production route sweep also drops its tolerance for the
  Cloudflare-injected analytics beacon — the zone-level injection is disabled at the source,
  so any beacon reappearing is flagged as a regression.
- 5e9996e: Add the verified multi-tenant build-cost fact to the build-in-house comparison page and extend the
  visual harness to a categorized, prod-capable sweep (pages, emails, interactions) with viewport ×
  theme coverage.
- b9a56df: Marketing copy: a buyer-research ROI frame beside the price (home how-to-buy footnote and the compliance pricing-card footnote) and a reactive "war-room" cost card on the compliance page. Content only, no behavior change.
- 74a82de: Site/copy wave: /compare/delve reworked to the
  own-vs-verify frame with the dated 2026 fabricated-reports allegations (the "often paired"
  recommendation removed) and a sourced ownership-line paragraph added to the Compliance page;
  a new /compare/auditkit page built from the AuditKit parity research (per-record `accessed`
  date override added to the comparison registry); /partners now publishes the locked design-partner
  terms (5 partners, 40% off, 12-month reverting, case-study contingent on conversion); an EU AI
  Act Article 50 set — enforcement-date section on the frameworks page, a standalone
  /frameworks/eu-ai-act/article-50 explainer, and a 36th glossary term — plus stale "Compliance
  edition" vocabulary fixed to bundle; the MCP-server copy reframed from "we have one" to the
  governed-surface story (base-substrate tile, Agentic-Dev lede); and the per-org
  license advantage line landed across the plans FAQ, cart trust note, and the two mid-tier
  bundle FAQs. Private app; no publishable release.
- add7b4c: Marketplace: the retention-runner media slot now shows a bespoke erasure diagram — one
  validated request fanning out to every registered target with per-target error isolation,
  then exactly one reason-tagged audit row — instead of borrowing the audit-worm evidence
  lifecycle. Docs: the `vec0` table name and the guardrails timeout default move into inline
  code so the zero glyph renders unambiguously. The visual harness's login and carousel
  interactions now genuinely exercise the invalid-submit error state and a multi-slide
  carousel.
- 70607f6: Dual-door hero, honest-artifact bento, diagram pair, homepage calculator embed, public affiliates page, Paddle verification readiness copy (refund policy, MoR disclosure, Caisson Software LLC entity, EU VAT-ID field).
- 9e34e86: The EULA gains a vendor-continuity and self-maintenance section: a defined Continuity Event
  (discontinuation, a 12-month unremediated-vulnerability patch lapse, insolvency, or an
  unassumed acquisition) that never diminishes the perpetual license and grants self-help rights —
  self-maintenance on the software as delivered, internal continuity copies, and self-hosting of
  delivery — with U.S. Bankruptcy Code §365(n) licensee protection, prospective-only cure
  semantics, and a new Affiliate definition; Last-updated bumped to 10 July 2026. Docs pages now
  emit full canonical/OG/Twitter metadata like every marketing page. The visual-regression harness
  stubs the session probe on signed-out screenshots so a full sweep no longer trips the auth-route
  rate limit. Private app; no publishable release.
- 7df836a: The Ask-AI grounding probes (insufficient-context sentinel, injection leak-guard, and
  citation-fidelity checks across both answer lanes) now also run in the dedicated `eval`
  task, so the AI-regression lane covers the site's grounded-answer pipeline directly.
- acf3ce0: Login and dashboard pages no longer throw hydration errors caused by edge-injected
  analytics scripts: the web-analytics site is now managed declaratively with auto-injection
  disabled, so the rendered page matches what the server sent. Module pages gain annotated
  walkthroughs of their real source snippets, the agentic-dev page documents the MCP tool
  discovery sequence, and the /ui gallery renders from the shared component demo registry
  instead of a hand-maintained copy.
- 7a52027: Marketplace and hero visual fixes. Marketplace cards no longer clip their kind pill into the neighbouring card when a demo badge is present — the header row splits into a lead cluster (kind + demo) and a right-aligned controls cluster that wraps instead of overflowing. The marketplace hero's blank right half now carries a self-contained, brand-styled diagram of the six bundles composing onto one Apache-2.0 audited base. On the homepage the install column is balanced against the cross-tenant psql terminal with a filled proof panel (fixing a proof chip that stretched full-width), and the honest-artifact code card header reads as a clean file path instead of a long label-plus-path string. The primary-nav disclosure now renders identical markup on the server and client — removing a hydration mismatch — and the immutable static-asset cache is scoped to production so development always serves fresh chunks.
- 6731e06: Marketplace media full-depth: every catalog module's media carousel now carries all applicable slide kinds. Live-component slides are added for the modules that genuinely ship a showable @caisson/ui surface: audit-worm (ChainViewer), ai-meter (UsageChart), prompt-registry (PromptBrowser), and local-store (StoreSearch) render their own embeddable /ui component, and credits renders the buyer-dashboard ledger surface (LedgerList/MetricStat). The component slide leads each carousel, ahead of the existing code-artifact and mechanism-diagram slides. Every slide depicts shipped behaviour under the honest-artifact floor - concept-only modules stay diagram-only, and ui-pro (the 22nd module) stays component-only. Private package only; no publishable release.
- 8db39db: Added a Playwright-based production verification harness: a real browser drives every major
  site route (home, marketplace, pricing, updates, docs, legal pages, sign-in, a sample of module
  pages) and the signed-in buyer dashboard, checking that each page renders cleanly with no
  console errors. It runs on demand against the live site to catch a deploy-time regression before
  a buyer hits it — no product code changed, no runtime behavior change for buyers.
- afd0294: Site catalog and copy remainder: an "open base" tile grid on the marketplace, placed under the
  bundle prices, showing the six batteries-included capabilities of the free Apache-2.0 foundation
  every bundle sits on. Plus a copy sweep that moves every remaining hardcoded price into the pricing
  source of truth (the plans, AI-Production, and modules pages), and corrects a stale base-package
  list — the plans and modules pages described the paid credits module as part of the free base and
  omitted rate limiting; a single shared package list now feeds every surface that names the base.
- a259db3: Trust and copy wave: a qualitative weeks-saved ROI framing and a
  sum-of-parts "why the price looks low" trust note on the plans page, a one-clear-surface
  distinction between what renewal buys (the updates window) and what support is (Discord +
  docs bot, included), perpetual-ownership anti-lock-in foregrounded in the hero proof chips
  and a new EULA continuity-clause deep link on the homepage and plans page, and a new
  theme-aware architecture-fit integration diagram on the homepage showing how the module
  layer lands on a Postgres instance you already run, with offline license verification and
  OTLP observability export.
- 4c8daa9: New /ui component gallery: live, interactive demos of every @caisson/ui-pro component, driven by realistic ops and compliance sample data. Each demo pairs with its ships-in-the-registry framing and an add-to-cart CTA, and the page carries the workspace dependency on the pro kit plus its transpile wiring.
- 47e04fd: Typography: every sans-serif zero now renders as a plain oval — a single-glyph companion
  face (Mona Sans, subset to the one character) sits in front of the body font, whose only
  zero is barred and read ambiguously in prose. Docs: the eleven pages that hedged "this
  reference is still expanding" now carry complete API references documenting each package's
  real exported surface, with two stale auth claims corrected along the way. Marketplace:
  diagram slides drop the duplicated chrome-bar sentence in favor of a short artifact label;
  the carousel caption remains the single visible narration. Compare pages: the two value
  columns no longer squeeze the Detail column to a sliver on phones.
- b5a3690: Repoint hand-rolled inline controls at the new kit interactive primitives: the marketplace
  facet Type/Category/Price/Media filters now use `Radio`/`Checkbox` instead of raw
  `<input>` elements, the primary-nav Editions/Marketplace/Resources disclosures now build on
  the new `Popover` primitive (removing duplicated Escape/outside-click/focus-return
  handling), the mobile hamburger nav now builds on the open `Dialog` primitive's drawer
  variant (native `<dialog>` + `showModal()`, top-edge sheet — scrim-close, focus trap, inert
  background, and focus-return are the primitive's job now), and the admin
  business-mutation panel's checkbox uses the same kit `Checkbox`.
  `@caisson/testing` gains a shared axe-core + JSDOM harness (`renderIntoJsdom`,
  `expectNoA11yViolations`/`expectNoA11yViolationsIn`) backing the new primitives' a11y
  regression tests. Private packages only; no publishable release.
- 97b0341: A shared component-demo registry, a live operator catalog, and two migrated growth-email
  templates.

  `@caisson/demo-registry` is a new, private, unpublished package: one typed catalog of every
  base-kit, UI Pro, and per-package embeddable component, each entry carrying its owning
  package, license tier, prop variants, and a live demo renderer built from sample data. It
  is the one data source the buyer-facing component gallery and the operator catalog both
  read from, so what ships is what gets demoed — never a second, drifting copy.

  `@caisson/email` gains two more registered templates: `waitlist-welcome` and
  `nurture-follow-up`, migrated from a standalone plain-HTML implementation into the shared
  branded layout used by every other transactional email. Every email the product sends —
  transactional and growth — now renders through one template registry.

  The admin app's design-system section is now the catalog: every component and every email
  template render live with sample data, grouped and filterable by license tier and owning
  package, with a send-test-to-operator action on each email. The marketing site's two
  standalone growth-email builders (never wired to a live sender) are removed in favor of
  the two templates now living in `@caisson/email`; the dev-only email preview page is
  removed too, superseded by the operator catalog.

- d50a052: Compliance copy wave: PCI DSS and GDPR named alongside SOC 2/HIPAA in the hero
  door claim and the compliance page (true-to-built via the frameworks-pack crosswalks; ISO
  27001 deliberately not claimed), support-included language surfaced at the offer level, a
  one-time cadence marker on the hero price chip, a renewal-justification line on the plans
  renewal card, and marketplace live-component emphasis in the built-in-the-open section.
- Updated dependencies [81223a7]
- Updated dependencies [5d60969]
- Updated dependencies [1bc677a]
- Updated dependencies [1bc677a]
- Updated dependencies [51e3ed0]
- Updated dependencies [08fd857]
- Updated dependencies [3d23da7]
- Updated dependencies [230f02a]
- Updated dependencies [b8fe873]
- Updated dependencies [11cb4c3]
- Updated dependencies [a79acb4]
- Updated dependencies [0137008]
- Updated dependencies [51e3ed0]
- Updated dependencies [9a81dd7]
- Updated dependencies [9a81dd7]
- Updated dependencies [114e2a0]
- Updated dependencies [4036574]
- Updated dependencies [5e9996e]
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [a931095]
- Updated dependencies [a931095]
- Updated dependencies [b3c5b0b]
- Updated dependencies [d5cef92]
- Updated dependencies [d9154da]
- Updated dependencies [329150a]
- Updated dependencies [679cce6]
- Updated dependencies [1bc677a]
- Updated dependencies [5a8b317]
- Updated dependencies [0dd715a]
- Updated dependencies [230f02a]
- Updated dependencies [a0aa9a3]
- Updated dependencies [8253e76]
- Updated dependencies [ba04bc1]
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [9a81dd7]
- Updated dependencies [2b65cf3]
- Updated dependencies [99d665a]
- Updated dependencies [99d665a]
- Updated dependencies [99d665a]
- Updated dependencies [1bc677a]
- Updated dependencies [ab352ab]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [4c141b0]
- Updated dependencies [a79acb4]
- Updated dependencies [47e04fd]
- Updated dependencies [9a81dd7]
- Updated dependencies [3758b3c]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b5a3690]
- Updated dependencies [b43959c]
- Updated dependencies [4d85f28]
- Updated dependencies [4d85f28]
- Updated dependencies [4c8daa9]
- Updated dependencies [97b0341]
- Updated dependencies [317bad5]
  - @caisson/email@0.4.0
  - @caisson/billing@0.6.0
  - @caisson/platform-migrations@0.2.0
  - @caisson/platform-reads@0.2.0
  - @caisson/ai-meter@1.0.0
  - @caisson/audit-worm@1.0.0
  - @caisson/brand@0.1.2
  - @caisson/ui@0.6.0
  - @caisson/registry-schema@0.5.0
  - @caisson/credits@0.5.0
  - @caisson/service-license@0.0.7
  - @caisson/demo-registry@0.2.0
  - @caisson/pricebook@0.5.1
  - @caisson/kernel@0.4.3
  - @caisson/local-store@1.0.0
  - @caisson/observability@0.3.0
  - @caisson/org-controls@0.3.0
  - @caisson/auth@0.3.2
  - @caisson/migrate@0.2.5
  - @caisson/tenancy-rls@0.5.1
  - @caisson/ui-pro@0.2.0
  - @caisson/prompt-registry@1.0.0
  - @caisson/ai-kit@0.4.1
  - @caisson/field-crypto@0.3.1

## 0.2.0

### Minor Changes

- 9ca1282: Glossary batches 2 and 3: all 32 locked terms are now live (20 new pages across the
  security, licensing, and AI-infrastructure clusters), with curated cross-links backfilled
  on the batch-1 pilot terms and a glossary section added to llms.txt.

### Patch Changes

- 783110d: Transactional emails now render as branded HTML with a plain-text fallback instead of plain text,
  and a new dev-only preview route shows every template with sample data. The buyer sign-in page
  also gains an email-and-password option alongside the existing magic link, with account
  verification and a forgot/reset password flow.
- 783110d: Cleaned up site copy flagged in a visual audit: dashes used as sentence connectors are now
  commas, colons, semicolons, or periods, matching how the rest of the site already reads.
  Rewrote a cluster of module and pricing descriptions that had fallen into the same "it does
  X, not Y" rhythm on every line, so the marketplace, module, and AI Production Kit pages read
  like they were written section by section instead of from one template. Also thinned out a
  few repeated section labels that were adding a small uppercase tag above nearly every block on
  the module and glossary pages, kept where they carry real information, dropped where the
  heading right below already said the same thing.

  No prices, claims, or page structure changed. This is a copy and typography pass only.

- 783110d: Gave the buyer dashboard's post-purchase pages (license, credits, AI keys, compliance,
  members, activity, plan, overview) a visual polish pass. Forms now share one consistent
  label-and-field look across the dashboard, empty and owner-only states read calmly instead
  of as a stray line of text, the compliance page's three frameworks are now visually
  separated instead of running together, the members "add a seat" field explains that
  invite-by-email isn't available yet, and the activity page now says when it's showing
  credit-ledger history instead of per-call usage detail. No data, permissions, or purchase
  flows changed — this is a presentation-only update.
- 783110d: Fixed two glossary page issues found in a visual audit. The "Related terms" links at the
  bottom of each glossary term page now render in the site's accent link color instead of
  plain body text, so they read as clickable. And the "Definition" section no longer repeats
  the term name a second time right under the page title — it was showing the exact same
  heading twice with no new information.
- 783110d: Added a persistent price and purchase bar pinned to the bottom of the screen on mobile for module
  pages. Previously, on a phone the price and "Add to cart" button could end up far down the page,
  past the full feature list and FAQ, before a visitor found them. Now the price and purchase button
  stay visible at every scroll position on small screens, while the full purchase card — with edition
  bundling and related reading — still appears in its usual place further down the page. Desktop
  layouts are unchanged.
- 3a6f5f1: Platform migration 0013 re-creates every platform tenant-isolation policy with an
  empty-string guard on the session GUC read: a pooled connection whose tenant setting was
  reset to an empty string now always denies instead of coincidentally matching rows. The
  platform migration package is also exported for read-only ledger drift audits.
- 8ab8ccc: Follow-up visual pass after a partial re-audit: the module comparison table now shows the same
  right-edge scroll fade as code samples when a column runs off narrow screens, and its 4th edition
  column is reachable on mobile. Terminal cards no longer clip their status badge when the label is
  long. Placeholder text is readable in light mode on every form across the site (sign-in,
  password-reset, newsletter), not just the ones fixed last time. The docs code samples now match the
  same scroll-fade treatment as the rest of the site. Several hero code/terminal panels (home,
  compliance, agentic-dev, local-first, the EU AI Act page) had their sample text re-wrapped so it no
  longer clips at the card edge. The EULA now keeps a readable line length on desktop, the footer no
  longer overflows the viewport on mobile, and a few small copy/layout bugs (a missing hyphen, an
  orphaned card in a 4-item grid, a monospace numeral style bleeding onto the word "from") are fixed.
- 783110d: Scrollable code samples and terminal output now show a soft fade at the right edge on narrow
  screens, so it's clear there's more to see instead of the content looking cut off. The
  marketplace tab row gets the same treatment when it doesn't fit the screen width. The email
  placeholder text in the product-updates signup now reads clearly in light mode.
- 783110d: Fixed five small display bugs found in a visual audit of the marketing site:

  - The Agent runner module card showed a broken glyph instead of its icon on the modules page.
  - The Alerting module's pricing description had an awkward, hard-to-read sentence.
  - On mobile, three-digit module prices in the stack builder's example (like $199) were cut off to
    two digits (like $19) — a real trust problem on a pricing surface.
  - The glossary's "AI & agent infrastructure" heading rendered with the word gap almost invisible
    on wide screens.
  - The docs sidebar's "Base substrate" section repeated its own name as its only link's label
    instead of a distinct label.

- Updated dependencies [b791198]
- Updated dependencies [b674ed3]
- Updated dependencies [783110d]
- Updated dependencies [dec93f3]
- Updated dependencies [d06a9b8]
- Updated dependencies [defb22e]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [4d7eb71]
- Updated dependencies [4d7eb71]
- Updated dependencies [4d7eb71]
- Updated dependencies [783110d]
- Updated dependencies [ad66801]
- Updated dependencies [850b844]
- Updated dependencies [aec9f1c]
- Updated dependencies [783110d]
- Updated dependencies [8ab8ccc]
- Updated dependencies [e784af1]
- Updated dependencies [4d7eb71]
- Updated dependencies [783110d]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [783110d]
  - @caisson/ai-kit@0.3.1
  - @caisson/ai-meter@0.3.3
  - @caisson/auth@0.3.0
  - @caisson/billing@0.5.0
  - @caisson/credits@0.4.0
  - @caisson/email@0.3.0
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/migrate@0.2.4
  - @caisson/observability@0.2.4
  - @caisson/platform-reads@0.1.5
  - @caisson/pricebook@0.4.0
  - @caisson/tenancy-rls@0.4.0
  - @caisson/ui@0.4.0
  - @caisson/billing-orchestration@0.2.0
  - @caisson/brand@0.1.0
  - @caisson/org-controls@0.2.0
  - @caisson/service-license@0.0.5

## 0.1.3

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/ai-kit@0.3.0
  - @caisson/tenancy-rls@0.3.2
  - @caisson/service-license@0.0.4
  - @caisson/ai-meter@0.3.2
  - @caisson/auth@0.2.3
  - @caisson/billing@0.4.1
  - @caisson/credits@0.3.2
  - @caisson/email@0.2.3
  - @caisson/migrate@0.2.3
  - @caisson/observability@0.2.3
  - @caisson/pricebook@0.3.2
  - @caisson/platform-reads@0.1.4

## 0.1.2

### Patch Changes

- Updated dependencies [4fc006c]
- Updated dependencies [3a7a4fd]
- Updated dependencies [cc7cb8b]
- Updated dependencies [bd9a005]
- Updated dependencies [fb8d966]
- Updated dependencies [fb8d966]
  - @caisson/service-license@0.0.3
  - @caisson/pricebook@0.3.1
  - @caisson/billing@0.4.0
  - @caisson/ui@0.3.0
  - @caisson/kernel@0.4.0
  - @caisson/platform-reads@0.1.3
  - @caisson/ai-kit@0.2.2
  - @caisson/ai-meter@0.3.1
  - @caisson/auth@0.2.2
  - @caisson/credits@0.3.1
  - @caisson/email@0.2.2
  - @caisson/field-crypto@0.2.2
  - @caisson/migrate@0.2.2
  - @caisson/observability@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.1.1

### Patch Changes

- 4287ce5: Legal pages carry the Paddle MoR reseller sentence and refund copy grounded in shipped billing behavior.
- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [b5915e0]
- Updated dependencies [5fd31fe]
- Updated dependencies [44a6414]
- Updated dependencies [959e555]
- Updated dependencies [20d5ab0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [081a1d8]
- Updated dependencies [52c6738]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [904b15b]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
- Updated dependencies [6e08cc6]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/ai-kit@0.2.1
  - @caisson/ai-meter@0.3.0
  - @caisson/billing@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/pricebook@0.3.0
  - @caisson/field-crypto@0.2.1
  - @caisson/service-license@0.0.2
  - @caisson/ui@0.2.1
  - @caisson/observability@0.2.1
  - @caisson/auth@0.2.1
  - @caisson/platform-reads@0.1.2
  - @caisson/email@0.2.1
  - @caisson/migrate@0.2.1

## 0.1.0

### Minor Changes

- 16526fa: Site marketplace rework (ADR-0189–0196): split the overloaded `/pricing` into three rooms
  — `/pricing` (editions + bundle), `/modules` (faceted à-la-carte catalog), and `/build`
  (compose-a-stack configurator with an honest upgrade nudge). Fold the four editions behind
  a WAI-ARIA Disclosure in the nav and fix the "Get started" label→destination. Differentiate
  the cart drawer (glance) from the rich `/cart` (review), sharing one line-item + one bundle
  -math function, with the drawer rebuilt on a native `<dialog>` for a real focus contract.
  Single "Add to cart" buy verb sitewide; Martian Mono as the sole monospace; a sitewide ⌘K
  search trigger; module `ItemList` structured data; and flat edition prices (drop the
  misleading "from" prefix — the only purchasable price is exactly the number shown).

### Patch Changes

- 84052aa: Backlog P3 defense-in-depth (all private apps, no publish):

  - `@caisson/site`: `AddMemberInput` gains `.strict()` for boundary-schema floor consistency (behavior
    unchanged — the parse object is hand-built, owner-gated, RLS-scoped, parameterized).
  - `@caisson/local-ai-app` + `@caisson/app-compliance`: the demo field-crypto paths (`demoProvider` /
    `createLegHarness`) now **fail closed under `NODE_ENV=production`** instead of silently using the fixed
    demo key vector. Neither app is a deployed service and both handle only synthetic data, so this never
    fires today (tests run under `NODE_ENV=test`; the compliance leg is golden-deterministic so `fromEnv`
    is deliberately NOT used) — pure defense-in-depth against a future deploy routing real data through.

- Updated dependencies [22077d1]
- Updated dependencies [33bee35]
- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [57170c5]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [5b57c78]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/auth@0.2.0
  - @caisson/ai-meter@0.2.0
  - @caisson/ai-kit@0.2.0
  - @caisson/billing@0.2.0
  - @caisson/pricebook@0.2.0
  - @caisson/field-crypto@0.2.0
  - @caisson/observability@0.2.0
  - @caisson/platform-reads@0.1.1
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/email@0.2.0
  - @caisson/migrate@0.2.0
  - @caisson/tenancy-rls@0.2.0
  - @caisson/ui@0.2.0
  - @caisson/service-license@0.0.1
