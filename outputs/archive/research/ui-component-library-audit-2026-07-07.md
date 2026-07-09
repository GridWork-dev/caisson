# `@caisson/ui` component library — audit + recommendations (track 7)

**Date:** 2026-07-07 · **Status:** research + report only (no code) · **Method:** kit source read (`packages/ui/src/components`, `packages/ui-pro`, `apps/admin/src/app/catalog/*`, `apps/site/app/(marketing)/ui`) + Refero reference research (component-library / devtool design systems).

## Scope audited

- **`@caisson/ui`** — the Apache-2.0 open component base: **34 components** (app-shell, button, card, code-block, confirm-dialog, copy-field, credential-strip, data-table, detail-list, dialog, edition-card, empty-state, error-state, faq, feature-grid, form-field, hero, icon, ledger-list, loading-state, metric-stat, mobile-buy-bar, money-cell, pagination, reveal, section, select, sku-matrix, status-chip, status-pill, terminal, theme-init, theme-toggle, toast).
- **`@caisson/ui-pro`** — the commercial premium layer (raw `.tsx` + co-located `.css`, same delivery model), rendered live on the site `/ui` showcase.
- **admin `/catalog/*`** — brand catalog pages (typography, wordmark, signature, emails) — a brand/design-token reference, not a component gallery.
- **site `/ui`** — the public showcase page (246 lines), the seed of the planned public `caisson.sh/ui` showcase (Kit stage 3).

## Reference set (Refero, dated 2026-07-07)

| Reference                           | Why it matters to Caisson                                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **shadcn/ui** (`ui.shadcn.com`)     | The category benchmark: monochrome, dense grid of component cards, pill buttons/badges, "own the code" copy-paste model — **directly resonant with Caisson's "own the source, no forced renewal" positioning**. |
| **PlanetScale**                     | Monospace-technical, table-driven, disciplined — Caisson's `--cs-font-mono` chrome is the same family of choice.                                                                                                |
| **Sauce Labs**                      | Dark teal canvas + mint activation accent — the closest palette cousin to Caisson's teal accent; proof the aesthetic reads "premium enterprise".                                                                |
| **Raster** (`raster.app/design`)    | Dark design-system site: slim left sidebar + stacked sections + grid component displays (buttons, swatches, forms, cards, icons) — a concrete `/ui` layout to steal.                                            |
| **Relume** (`relume.io/components`) | Component **browser**: sidebar + search + filter row + grid of component cards with copy/bookmark — the interaction model for a large gallery.                                                                  |
| **Fourthwall** styling editor       | Split-screen live preview + branding controls (logo, palette, fonts) — the model for a **live theming playground**.                                                                                             |

## Findings

### F1 — Craft floor is strong and consistent (keep)

Every component follows the ADR-0099 "recipe": co-located plain CSS reading only `--cs-*` tokens, `forwardRef` onto a single root, BEM naming, presentational + server-safe (no `"use client"` unless it owns state). This is a **more disciplined, lower-dependency base than shadcn** (no Radix pulled into every primitive) and is the kit's real differentiator. OKLCH-free hardcoded color is absent (token-only), matching the brand floor.

### F2 — Coverage gap vs the field (the biggest opportunity)

Against shadcn/ui + Radix primitives, the kit is strong on **marketing + data + status** primitives (hero, section, feature-grid, data-table, pagination, metric-stat, money-cell, status-chip/pill, terminal, code-block) but **missing standard interactive primitives** that consumers of a paid kit will expect:

- **Missing:** Tabs (the marketplace hand-rolls `marketplace-tabs`), Tooltip, Popover, Dropdown/Menu, Accordion (only a purpose-built `faq`), Checkbox, Radio, Switch/Toggle, Slider, Progress, Avatar, Breadcrumb, Sheet/Drawer (nav hand-rolls it), Combobox, Tag/Badge (only partly covered by status chips).
- **Consequence:** app surfaces (marketplace facets, nav, forms) repeatedly **hand-roll native controls inline** (raw `<input type=checkbox>`, bespoke tab bars). That is exactly the drift the kit exists to prevent, and it shows up as the class of bug this session fixed (the marketplace card meta row).

### F3 — Accessibility posture is good but unverified

Strong hand-written a11y is visible: WAI-ARIA Disclosure in the nav, `focus-visible` outlines, `aria-label`/`aria-current`, an `.srOnly` live-region host, ≥24px hit targets (WCAG 2.5.8 cited), `forced-colors` handling (terminal), and the "never colour alone" rule (status pill = dot **and** text). **Gap:** no automated a11y regression (axe / jest-axe) in the kit's test suite, so this discipline is not enforced — it will erode as the kit grows.

### F4 — Theming exists but has no consumer-facing contract

The token system (`--cs-*`, theme-aware by cascade, `theme-toggle` + `theme-init`, light/dark with no JS branching) is genuinely good. But a **buyer who licenses the kit has no documented way to re-theme it**: the token contract (`DESIGN.md §2`) is internal, there is no published "override these N tokens to rebrand" guide, no per-package theming story, and no live theme preview. Competitors (shadcn theming, Fourthwall's live editor) make re-theming a first-class, visible feature.

### F5 — The `/ui` showcase under-sells the kit

The public showcase is a single 246-line page. Against shadcn.com / Raster it lacks: a dense per-component **card grid**, **copyable code** per component, a **prop/variant playground**, and a **theme toggle applied to the gallery**. For a _commercial_ component layer (`ui-pro`), the showcase is the storefront — it should demo, not just list.

## Recommendations (prioritized)

1. **[High] Fill the interactive-primitive gap.** Add Tabs, Tooltip, Popover, Dropdown/Menu, Checkbox, Radio, Switch, Accordion, Badge as recipe-compliant components, then **repoint the hand-rolled inline controls** (marketplace facets/tabs, nav) at them. Removes a whole bug class (this session's card-overflow was one instance). Sequence Tabs + Checkbox + Badge first (most-duplicated today).
2. **[High] Publish a theming contract + live preview.** Document the minimal token set to override for a rebrand, ship a "bring your own tokens" guide, and add a theme switcher to the `/ui` gallery (Fourthwall/shadcn model). This is a **sales feature** for `ui-pro`, not just docs.
3. **[Medium] Rebuild `/ui` as a real showcase** (Raster + shadcn model): left-nav + component-card grid + per-component live demo, copyable code, and the gallery-wide theme toggle. This is the storefront for the commercial layer.
4. **[Medium] Enforce a11y.** Add jest-axe (or Playwright + axe) to the kit test suite so the strong hand-written a11y is regression-guarded; add visible focus-state and keyboard-nav notes per component in the showcase.
5. **[Low] Lean into "own the source" in the showcase copy.** shadcn's whole draw is code ownership; Caisson _sells_ perpetual source ownership. Make that explicit on `/ui` ("copy it, own it, no lock-in") — it is a differentiator the current page does not voice.

## Open decisions for the kickoff

- Do new interactive primitives go in Apache-2.0 `@caisson/ui` (open base) or commercial `@caisson/ui-pro`? Recommend the **standard primitives in the open base** (they are table stakes; the open base drives adoption) and reserve **composed/premium** patterns for `ui-pro`.
- Radix vs hand-rolled for the interactive primitives: the recipe rule is "no Radix for presentational primitives," but Tooltip/Popover/Menu need focus management + positioning. Decide per-component (hand-roll simple, consider a headless dep for the hard three) — a real ADR-worthy fork.
