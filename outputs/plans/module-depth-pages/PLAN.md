# LANE-B PLAN — Module-depth pages for the three compliance-gap SKUs

- **SPEC:** `/home/gw/lab/caisson/outputs/specs/module-depth-pages/SPEC.md`
- **Decision:** ADR-0380 locks 6–8
- **Branch:** `feature/module-depth-pages`, based on `feature/full-state-completion`
- **Worktree:** `/home/gw/lab/caisson-lane-b`
- **Engine:** codex `gpt-5.6-sol`, `model_reasoning_effort=ultra`, two parallel sub-lanes
- **Roles:** `gw-frontend-designer` authors; `gw-persona-walkthrough` critiques before ship
- **Output:** one PR, pushed not merged (ADR-0328)

## Sub-lane split

| Sub-lane   | Tree                                    | Tasks        |
| ---------- | --------------------------------------- | ------------ |
| **B-mark** | `packages/ui/`                          | B1 → B2      |
| **B-copy** | `apps/site/lib`, `apps/site/components` | B3 · B4 · B5 |

B1 lands the glyphs before B2 maps them; B-copy runs concurrently and only depends on B1/B2 at the
final wiring check. B6 reconciles.

## Tasks

### B1 — Three bespoke glyphs

Add `access-review`, `risk-register`, and `trust-page` glyphs to the `@caisson/ui` icon registry in
the established bespoke-domain style (ADR-0237 F6). Theme-following, token-driven — no baked colors.

- **Evidence:** icon-registry test coverage, render snapshots in both modes, contrast gate on any
  new token pair.

### B2 — Mark mapping

Add the three ids to `MODULE_MARKS` in `/home/gw/lab/caisson/apps/site/lib/marks.ts` so none falls
through to the `boxes` fallback.

- **Evidence:** a test asserting every sellable module id resolves to a non-fallback mark.

### B3 — Three `ModulePageRecord`s

Author the records in `/home/gw/lab/caisson/apps/site/lib/module-pages.ts` following the 23 shipped
examples: `metaTitle`, `metaDescription`, `heroOneLiner`, a 40–70 word `definition`, 4–6 `included`
capabilities, one `artifact` (real repo path, verbatim code, 2–3 annotations each naming a real
identifier and never a line number), `faq`, `relatedGlossary`, and an entitlement-honest `sells`.

Source material — read the package before writing the claim:

| Slug            | Package surface                                                                |
| --------------- | ------------------------------------------------------------------------------ |
| `access-review` | `packages/access-review/src/{campaign,schedule,snapshot,schema}.ts`            |
| `risk-register` | `packages/risk-register/src/{model,override,treatment-plan}.ts` + `__golden__` |
| `trust-page`    | `packages/trust-page/src/{facts,render}.ts` + `__golden__`                     |

- **Evidence:** the data-lint suite in `module-pages.test.ts`; a claim-trace check that every
  capability body and annotation names an identifier exported by the named package.

### B4 — Live component slides

Wire each page's carousel to lead with its existing poke as the live slide (ADR-0290 preference
order, ADR-0308 full-depth), with an honest one-line caption doubling as the a11y label, followed by
the shipped schematic.

- **Evidence:** `marketplace-surface.test.ts` slide-composition tests for the three pages; the
  existing "depth-page slides still carry real media" assertion passes for all 26.

### B5 — Parity guard

Tighten the depth-record data-lint from "no orphan record" to full parity: every sellable module has
a depth record (26/26). A future SKU cannot ship a card without a depth page.

- **Evidence:** red/green on the guard — remove one record, the test fails.

### B6 — Reconcile and gates

Regenerate the design manifest (the three new glyphs trip the `b037b878` drift guard), re-snapshot
goldens, run e2e on the three new routes, then the persona critique and the SHIP audit lane.

## Order

```text
B1 -> B2
B3 -> B4 -> B5
{B2, B5} -> B6
```

## Gates before the PR

`bun run check` · `bun run format:check` · `bun run sot` · design-manifest drift clean · contrast
gate · changeset for `@caisson/ui` and any other touched package · `gw-persona-walkthrough`
critique addressed · in-session SHIP audit lane.

## Out of scope

No pricing, bundle-membership, route-file, or other-page copy change. Lane A's app work
(admin proof viewer, tenant proof proxy, buyer crosswalk) belongs to the other worktree — do not
touch `apps/admin`, `apps/site/lib/dashboard-reads.ts`, or any proof/crosswalk file.
