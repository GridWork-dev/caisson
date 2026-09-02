---
"@caisson/site": patch
"@caisson/cli": patch
"@caisson/email": patch
"@caisson/ai-kit": patch
---

Routine non-major dependency refresh.

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
