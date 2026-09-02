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

Four bumps prepared alongside these are deliberately **not** here. Each one
independently breaks `apps/site`'s typecheck, and none is fixable by choosing a
different version:

- **`fumadocs-core` / `fumadocs-mdx` / `fumadocs-ui`.** The two versions declare
  identical peer dependencies, so this is not a resolution problem: the static search
  client's types moved to `@orama/core` while `components/search.tsx` passes an
  `@orama/orama` instance. Adopting it needs a code change in the search dialog.
- **`kysely` `0.29.4` to `0.29.5`.** Only `apps/site` declares kysely, as a single exact
  pin, so there are never two copies of it. Moving it perturbs the peer-hash of
  `@better-auth/core`, and the site imports `better-auth` and
  `@better-auth/kysely-adapter` side by side; they then land on differently-hashed
  copies of the shared core whose `BetterAuthOptions` are nominally distinct under
  `exactOptionalPropertyTypes`. An override forcing one `@better-auth/core` version does
  not help — an override pins a version, not a peer-hash.
- **A repo-wide `jose` pin.** On its own, from a clean baseline, it reproduces exactly
  the same three errors in the same file by the same mechanism.

An earlier draft of this note argued the reverse: that the `jose` pin was load-bearing,
and that dropping it would split the auth core and stop the site typechecking. That is
backwards. Measured from `main`'s manifests as a green baseline, adding one group at a
time: the pin alone produces the split, and `main` itself carries two `jose` versions
and exactly one `@better-auth/core` while typechecking clean.
