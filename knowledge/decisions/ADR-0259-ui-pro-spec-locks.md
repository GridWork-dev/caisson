# ADR-0259 — ui-pro SPEC locks: market-line component split, caisson.sh/ui gallery, v1 = full 7, $129–199 standalone band

**Status:** accepted · 2026-07-06 (Kickoff D Stage 1 picker, four forks in one round).
Drafted as ADR-0251 on `feat/catalog-program`; renumbered 0259 at the Kickoff-E merge
(ADR-0088 second-merger-renumbers — E's 0251-0256 reached `main` first).
**Extends** ADR-0250 (G2a mandated this SPEC before any ui-pro build); respects ADR-0248 (the
ratchet — every line move below lands pre-first-publish), ADR-0237 (V1-live posture),
ADR-0244 (purchase model), ADR-0137/0227/0247 (below-sum edition math left untouched).
**v1 = full 7 is an operator override** of the written 5-core recommendation. Append-only;
supersede with a later ADR, never edit. **Tags:** none at lock; the build inherits
`ui`/`frontend` + the standards-gate critical path where it touches the license boundary.
Scope detail: `outputs/specs/ui-pro/SPEC.md` (locked same session).

## Decision

1. **Component line = market-line split.** `@caisson/ui-pro` gates only advanced data-ops (the
   MUI-X-Pro/AG-Grid-Enterprise line) + domain-composed compliance/ops surfaces: DataTable-Pro ·
   Tree-Pro · Ops Matrix (absorbs `sku-matrix`, the one DEEP component moving commercial) ·
   Audit Timeline · Payload Viewer · Type-to-Confirm · Adv Date-Range Picker. Every table-stakes
   basic stays/returns/backfills into the Apache floor (app-shell, basic DataTable **with**
   single sort/filter/pagination, drawer/modal, toast, select/combobox, pagination, copy-field,
   basic confirm, link-row/detail-list, charts as themed Recharts wrappers). Charting is
   commodity — never a paid differentiator.
2. **Leaf law:** nothing under `packages/` may depend on `@caisson/ui-pro` — open packages by
   the license boundary, commercial packages because the entitlement resolver never walks code
   deps (a ui-pro dep inside a purchased module breaks buyer installs — the ADR-0238 class in
   reverse). Consumers: first-party apps + buyers. Wave-1 `./ui` surfaces build on the floor
   (ADR-0250 G2c, unchanged). Audit Timeline / Payload Viewer / Type-to-Confirm are
   props-contract only — no `@caisson/audit-worm` runtime dependency.
3. **Docs surface = `caisson.sh/ui` gallery route** in `apps/site`: public live demos + prop
   tables, gated at the registry/license layer only (no docs-side code blur, no Storybook, no
   Fumadocs section). Build timing stays ADR-0250 G2b ("marketed or frontend-wave need").
4. **v1 = full 7** (override): all seven components ship at first marketing; internal backlog
   starts empty; the site shows only what exists (ADR-0237).
5. **Price-band input to Stage 2 = $129–199, anchor $149; placement = standalone-only** (the
   `ai-evals` pattern — no edition membership, no bundle membership at v1, keeping the locked
   below-sum math closed). Stage 2 owns the exact cents. Purchase model = ADR-0244 unchanged.

## Consequences

- The floor backfill + DEEP-return set is an intentional, permanent widening of the open line
  (one-way at first publish per ADR-0248) — locked here, executed as open-line build work
  scheduled by the catalog-rework PLAN (Kickoff D Stage 3), which also owns ui-pro's
  marketplace display placement against the ADR-0246 every-package-displayed lock.
- Stage 2 (pricing pass) prices ui-pro inside the locked band and inherits two rider notes:
  MUI's decaying-discount renewal shape (contrast to the flat ~40%) and MUI's published LTS
  security floor, which ADR-0244's language currently lacks.
- Accessibility (keyboard nav, ARIA, focus management) is a binding per-component launch gate
  in the SPEC — the #1 unprompted buy-trigger across all three demand-study personas.
- Research follow-ups routed: PostHog instrumentation gap (no `$pageview` autocapture, no SKU
  property on `purchase`) → Linear; `create-caisson` floor wiring (the funnel move) →
  catalog-rework SPEC candidate.
