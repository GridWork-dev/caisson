# Lane B goal prompt — module-depth pages for the three compliance-gap SKUs

You are executing lane B of the ADR-0380 completion wave in an isolated worktree at
`/home/gw/lab/caisson-lane-b` on branch `feature/module-depth-pages`. This is a **design slice** —
you author real buyer-facing copy for three new pages.

## Read first (absolute paths)

- `/home/gw/lab/caisson/CLAUDE.md` — repo working rules and engineering invariants
- `/home/gw/lab/caisson/outputs/specs/module-depth-pages/SPEC.md` — the goal and the reuse table
- `/home/gw/lab/caisson/outputs/plans/module-depth-pages/PLAN.md` — your task list
- `/home/gw/lab/caisson/knowledge/decisions/ADR-0380-completion-fork-locks-and-module-depth-slice.md` — locks 6 and 7
- `/home/gw/lab/caisson/apps/site/lib/module-pages.ts` — 23 worked examples of the record you are writing

## Goal

Give `access-review` ($199), `risk-register` ($279), and `trust-page` ($149) the same full depth
treatment every other sellable module has: three bespoke glyphs, three `ModulePageRecord`s, live
poke-based component slides, and a 26/26 parity guard. Tasks B1–B6 in the PLAN.

Run two parallel sub-lanes: **B-mark** (`packages/ui/`, B1 → B2) and **B-copy** (`apps/site/`,
B3 · B4 · B5). B6 reconciles.

## Method

Read the package before you write the claim. Every capability body and every artifact annotation
must name a real exported identifier from the package it describes — a diagram or a claim you
cannot trace to code does not ship. Match the voice, density, and structure of the 23 existing
records exactly; this is not a new copy system.

## Hard constraints

- New copy is authorized for **these three pages only**. No other buyer-facing copy changes.
- No pricing, bundle-membership, or route-file change. The three are records on the existing spoke
  pattern.
- Do not re-author the shipped schematics or pokes — consume them.
- Glyphs are theme-following and token-driven; no baked colors. Contrast gate on any new token pair.
- Regenerate the design manifest — three new glyphs trip the drift guard.
- Do not touch `apps/admin/**`, or any proof, crosswalk, or dashboard-reads file — lane A owns those
  in a concurrent worktree.
- Changeset for `@caisson/ui` and any other touched package.

## Done means

`bun run check`, `bun run format:check`, `bun run sot`, the design-manifest drift check, and the
contrast gate are green in the worktree; the three routes render with a live Offer URL; the parity
guard fails red when a record is removed; and one PR is **pushed, not merged**. Report the PR URL
and anything you could not finish with the reason.
