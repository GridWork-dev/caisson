# ADR-0196 — Extend ⌘K search sitewide

**Status:** accepted · 2026-07-01 (site-marketplace-rework track — operator lock, picker round 2026-07-01).
**Relates:** ADR-0096 (services/docs — the Fumadocs/orama surface this fork lifts from), ADR-0190 (nav —
⌘K is sequenced as the secondary trigger behind the Editions disclosure panel), and sibling
site-marketplace ADRs 0189-0195.

## Context

⌘K is reachable only under `/docs` — the visible trigger and `Cmd+K` keybinding come solely from fumadocs'
`DocsLayout` (`app/docs/layout.tsx`), but `RootProvider` already wraps the **whole app** with the
`SearchDialog` + orama static client (`app/layout.tsx:60`), so the dialog itself is usable anywhere; only the
trigger and listener are docs-scoped.

## Decision

Lift the search trigger and `Cmd+K` key listener into the marketing shell (a visible trigger in `site-nav` +
a mobile-nav entry) via fumadocs' `useSearchContext`, so ⌘K fires regardless of route — the index and dialog
already exist, so this is trigger + listener only. Sequenced **after** D-2: since D-2 = A (the Editions
disclosure panel carries the umbrella model), ⌘K is a **secondary** trigger in the nav row, not the primary
explore mechanism.

## Rejected

- **A separate marketing search index** — duplicates the existing orama client.
- **Leaving ⌘K docs-only** — ⌘K muscle memory dies the moment you leave `/docs`.
