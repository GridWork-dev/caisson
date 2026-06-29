# ADR-0097 — Component recipe + framework-agnostic kit packaging

**Status:** accepted · 2026-06-29 (design-system-harden track — operator lock, picker round F1·F2·F7·F8).
**Relates:** ADR-0078 (brand foundation — the recipe renders its tokens/icons; **Lucide lock cited from
DESIGN.md §4**), ADR-0042 (token center, kept), ADR-0003 (composable packages — a package never depends
"up" on a consumer), ADR-0044 (edition reference apps standardize on Next.js), ADR-0084 (`apps/site`
stack). **Adopts the mechanism of** `outputs/research/wardfile-frontend-playbook.md` (the transplantable
recipe; the brand/token VALUES are Caisson's, not Wardfile's). Evidence: the 2026-06-29 3-agent grounding
(`outputs/kickoffs/design-marketing-rebuild.md` F1/F2/F7/F8).

## Context

Caisson already owns the playbook's foundation layer: tokens authored as typed TS → codegen `--cs-*` CSS
vars (`packages/ui`), a token-consuming `apps/studio`, DESIGN.md doctrine. The gap is the **component
layer**. Today all 10 shared primitives live **inline** in `apps/site/components/ui.tsx`
(Section/Hero/Button/Card/Terminal/CodeBlock/StatusChip/CredentialStrip/EditionCard/SkuMatrix), styled by
an 815-line global-BEM `app/global.css` plus pervasive inline `style={{…}}` props — **no Radix, no
`data-*` variants, no co-located CSS**. `packages/ui` carries **zero React components** (token floor only:
exports `.`, `./tokens`, `./styles/tokens.css`). `apps/studio` consumes _tokens_, not _components_, so the
gallery can drift from the product. `apps/studio` is on Next 15; `apps/site` on Next 16. This violates the
kit-first, drift-proof discipline the playbook's value rests on. (`apps/site/components/ui.tsx:11-374`;
`apps/site/app/global.css:1-815`; `packages/ui/package.json` exports.)

## Decision

### F1 — Adopt the Wardfile component recipe

Every kit component is built with the five-part recipe, replacing global-BEM + inline-style:

1. **Radix behavior-only primitives** (`radix-ui` unified package) for disclosure/dialog/toggle/etc. — we
   own all styling; Radix supplies behavior + a11y only.
2. **Co-located per-component plain CSS** (one `.css` next to each `.tsx`) reading only `var(--cs-*)`.
   **No** Tailwind, cva, CSS-modules, vanilla-extract, or any class-string library.
3. **Variants as `data-*` attributes** (`data-variant` / `data-size` / `data-status` / `data-surface`)
   styled by attribute selectors — variant logic stays out of JS.
4. **Local-indirection vars** for multi-token components: `[data-status="x"]` sets `--chip-color` /
   `--chip-tint` / `--chip-glyph` from the matching `--cs-*`; one base rule consumes them, so light/dark
   "just works" by cascade and the component never branches on theme.
5. **`forwardRef`, `"use client"` only where needed, `asChild` via Radix `Slot`, BEM names** (block
   `cs-button`, element `cs-button__icon`).

### F2 — Move the primitives into `@caisson/ui`, **framework-agnostic** (operator lock)

The primitive set moves into `packages/ui` as **raw `.tsx`** with a `./components/*` exports map (no
bundler/dist; consumers set `transpilePackages` + import `@caisson/ui/styles/tokens.css` once at the root
layout). The kit stays **portable** (it is a sold library):

- **No `next/link` hard dependency.** Components that navigate accept a Link via `asChild` / a `render`/`as`
  prop; the consumer injects `next/link`. `@caisson/ui` never imports a framework.
- **`lucide-react` as a `peerDependency`**, not a hard dep.
- **`apps/studio` consumes the SAME kit components** (gallery == product, drift impossible).
- **Kit-first rule (a hard standard, ADR-0003-aligned):** new reusable UI lands in `packages/ui`, **never**
  inlined on a screen; build order is always **tokens → primitives → domain components**; a package never
  depends "up" on an app.

### F7 — Align consumers to Next 16

`apps/studio` moves Next 15 → **Next 16** to match `apps/site`, so both kit consumers run one toolchain.

### F8 — Keep Lucide (cite DESIGN.md §4)

The icon workhorse stays **Lucide** (2px stroke / 24px grid, monochrome, accent only on active/status) plus
the bespoke domain glyphs (rls · worm · audit-chain · fail-closed · field-crypto · evidence-pack · caisson
cross-section), one `<Icon name=… />` surface. The playbook's Phosphor recommendation is **consciously
overridden**. The operative lock is **DESIGN.md §4** (ADR-0078 §3 wrote "Lucide or Phosphor" as an open
choice; DESIGN.md resolved it to Lucide — cite DESIGN.md to avoid reopening the Phosphor option).

## Rejected

- **Ratify the current global-BEM + inline-style approach** (F1 alt) — keeps the pervasive inline styles and
  the theme-branching the recipe eliminates; forfeits the playbook's core value (pure-cascade theming).
- **Next-coupled kit** (F2 alt) — hard-dep `next` + `lucide-react` in `@caisson/ui`. Simpler move, but the
  kit would then **require Next.js for any consumer**; rejected because `@caisson/ui` is a sold library and
  portability is load-bearing (operator chose framework-agnostic).
- **Swap to Phosphor** (F8 alt) — the playbook prescribes it, but Lucide is the locked brand choice.

## Binding

- Kit components use the five-part recipe (Radix behavior + co-located CSS + `data-*` + local-indirection +
  BEM/forwardRef). Global-BEM + inline-style is retired for the primitive set.
- The primitive inventory moves from `apps/site/components/ui.tsx` into `@caisson/ui` as raw-`.tsx`
  `./components/*` exports; **`@caisson/ui` imports no framework** (Link injected via `asChild`; `lucide-react`
  is a peer-dep).
- `apps/studio` consumes the same kit components and runs **Next 16**.
- Lucide stays the icon workhorse (cite **DESIGN.md §4**); Phosphor rejected.
- Token VALUES, the `--cs-*` prefix, palette A, and Structural type are **unchanged** (ADR-0042/0078) — this
  ADR is the component-layer mechanism, not a brand change.

Implementation lands in Phase 1 of the design-system-harden track (the build). The dark-mode/icon-toggle
_behavior_ the ThemeToggle component encodes is decided in **ADR-0098**; the gates that enforce the recipe
(anti-slop AST guard, co-located-CSS, no-inline-style) are decided in **ADR-0099**.
