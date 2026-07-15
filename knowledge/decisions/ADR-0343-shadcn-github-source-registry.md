# ADR-0343 — shadcn GitHub-source registry on the public mirror (Apache base tier funnel)

Status: accepted · 2026-07-13 (Kickoff T platform session, task 13; install-path facts re-derived
per the kickoff banner's WR-04 correction)

## Decision

The public mirror repo (caisson-sh/caisson-oss) doubles as a **shadcn GitHub-source registry**:
`scripts/export-public-mirror.ts` writes a generated `registry.json` at the mirror root
(via `scripts/gen-shadcn-registry.ts`) so any shadcn consumer can copy Apache-2.0 kit components
straight into their app:

```
bunx shadcn@latest add caisson-sh/caisson-oss/button
```

- **Generated, never committed** — same drift-proof posture as MIRROR-MANIFEST.json; the source
  tree is the only truth and the exporter run is the check (loud failure on a missing file,
  unresolvable sibling import, or an implausibly small barrel).
- **Item derivation:** the packages/ui components barrel is the authoritative set (40 items
  today); each item carries its sibling-import closure (non-barrel helpers fold into the item's
  files, barrel siblings become registryDependencies) + co-located CSS; npm deps versioned from
  packages/ui's own manifest. Every item depends on the `caisson-tokens` theme item
  (packages/ui/styles/tokens.css → styles/caisson-tokens.css) — components read only `--cs-*`
  custom properties, so the tokens sheet is the styling floor.
- **Install syntax is plain `bunx shadcn@latest`** — NOT `bunx --bun` (the kickoff banner's
  suggestion): the `--bun` runtime flag has documented breakage against the shadcn CLI. The bare
  `owner/repo/item` GitHub-address form is the doc-sanctioned zero-infra route; a branded
  `@caisson` namespace alias (components.json `registries` map) needs a served JSON endpoint and
  is NOT part of this decision — revisit only if the funnel data says the alias matters.
- **Boundaries:** the ADR-0097 license-gated registry service and the create-caisson generator
  are separate distribution channels, untouched. packages/ui itself is untouched (frozen this
  wave and not needed — the generator only reads it).

## Verification gate

The end-to-end proof (`shadcn add` against the LIVE mirror) is impossible until the next
release-train mirror sync ships a registry.json — recorded as a post-sync verification row:
run the add against a scratch app, confirm files + tokens land and the component renders. If
shadcn's schema validation rejects an item shape at add-time, the fix is a generator tweak +
re-export, not an architecture change.
