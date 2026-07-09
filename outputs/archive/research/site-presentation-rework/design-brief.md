# Design Brief — Site Presentation Rework (ADR-0237)

_Refero-grounded research → consumed by the wave-1/2 build agents. Produced 2026-07-03 by the
gw-frontend-designer research lane (read-only pass; no code changes)._

## Brand grounding (recap, so build agents don't re-derive it)

- **Palette:** locked Palette A "cold-steel teal" (hue ~205), OKLCH, dark-first, one light theme. Neutrals tinted toward accent hue (chroma 0.008–0.014) — never pure gray, never `#000`/`#fff` in the rendered DOM.
- **Type:** Hubot Sans (display/body, weight 400 floor). **Martian Mono is the single mono font** — labels, eyebrows, control-IDs, all numerals (tabular), **and now code blocks too** (ADR-0195 supersedes ADR-0078 §1's JetBrains-for-code carve-out; JetBrains was dropped repo-wide). Build agents should NOT reintroduce JetBrains.
- **Accent discipline ≤10%** (ADR-0189, reaffirmed): `--cs-accent` only on primary CTA, eyebrow, focus ring, active status glyph, load-bearing code tokens. No second brand hue, no proof/evidence color beyond the existing status tier.
- **Elevation:** tonal surface + hairline is default; `--cs-shadow-{sm,md,lg}` + `--cs-glow-accent` is the deliberate step (cards, overlays, hero focal point), not baseline.
- **Motion:** tokenized `--cs-duration-{fast,base,slow}` 120/180/240ms, authored `--cs-ease-{out,reveal}` curves, transform/opacity-first, `prefers-reduced-motion` honored, no gimmick loops.
- **Icons:** Lucide line workhorse, 2px stroke / 24px grid, monochrome + accent-on-active only, plus bespoke domain glyphs for concepts stock libraries lack.
- **ADR-0237 rider 1 (binding for this rework):** the brand system is **tweakable, not a frame** — token/elevation/motion/icon evolution is authorized where the presentation earns it, as long as it lands as an explicit, reviewable design-system diff and the contrast/a11y gates stay green. This gives the build agents room to extend `foundation.ts`/`theme.ts` for the new nav/marketplace/depth-page/icon needs below, rather than working strictly inside today's token set.
- **Existing primitives to reuse, not reinvent:** `Wordmark`, `ThemeToggle`, `CartTrigger`, `EditionsMenu` (disclosure pattern from ADR-0190), `NavLinks`, `MobileNav`, `Icon`, `Reveal`, `Card`, `StatusChip`, `SkuMatrix`, `Terminal`/`CodeBlock` — all in `packages/ui` / `apps/site/components`.

---

## 1. Nav rebuild — logo → centered link row (3 card-panel dropdowns) → utility cluster

**Locked shape (ADR-0237 F3/F4):** Logo left → centered row with **Editions ▾ / Marketplace ▾ / Resources ▾** (each a rich card-panel dropdown, generalizing the ADR-0190 disclosure pattern) → right utility cluster: search (⌘K) · cart · Get-started CTA · theme toggle. This replaces the current shape in `site-nav.tsx` (logo → `EditionsMenu` disclosure + flat `NavLinks` row → cart → search/CTA/toggle), which has only ONE panel (Editions) and flat links beside it, not three panels in a centered row.

### Reference patterns

1. **1Password `/` global nav — Product dropdown flyout** (screen `3940eb83`). Text-forward flyout under a top link, not an icon-mega-menu: compare/plan copy, clean two-column content, closes on outside click/Esc. **Adopt:** the restraint — text + one-liners, not a Stripe/Adidas icon-grid mega-menu (explicitly rejected by ADR-0190 as "the exact cliché the brand exists to avoid"). **Reject:** 1Password's light corporate palette and dense multi-column comparison grid — too busy for the ≤10%-accent floor.

2. **Linear `/changelog` restrained dark nav** (style `11d3e58a`, "midnight command center behind frosted glass"). Slim, low-prominence top bar: small text links, a **9999px-pill search field and pill nav-tabs**, a ghost-outline primary button (not a filled CTA blob), 1px `Line Graphite`-style borders instead of shadows for separation. **Adopt directly:** the capsule/pill treatment for the search trigger and the Editions/Marketplace/Resources triggers themselves — Caisson's `.cs-btn` variants already lock 2-variant + 1 tertiary (ADR-0195); a pill-shaped ghost trigger for each of the three dropdown triggers reads as "restrained instrument," not "marketing mega-menu." **Reject:** Linear's near-transparent CTA — Caisson's primary "Get started" must stay `--cs-accent` filled per the accent-slot list.

3. **Vercel `/dashboard` + `/account` nested-tab shell** (screens `6d76a703`, `13d7321d`). Demonstrates how a dev-tool nav degrades gracefully with a secondary tab row and how account/settings-style dropdowns anchor left-aligned under a trigger, not centered as a mega-panel. **Adopt:** left-anchored panel alignment under each trigger (not full-width mega-menu) — keeps the panel card-sized (fits "icon + label + one-liner + price" per module/edition, per F6) rather than spanning the viewport.

4. **Vercel `/integrations` directory nav-adjacent pattern** (screen `010c7da2`) — a slim category rail beside a card grid. Not directly a nav pattern, but establishes the **card unit** that should populate the Marketplace panel: logo/icon + name + one-line description, no price on the _directory_ card (price shows on the _nav panel_ card per F4, but the same visual card-atom should be shared between nav-panel cards and marketplace-hub cards for consistency).

### Dropdown panel grammar (concrete spec for build agents)

- **Card unit** (per F4: "icon + label + one-liner + price"): `Icon` (bespoke, 24px) + label (Hubot Sans medium) + one-line Martian Mono descriptor (reuse the existing `EditionMenuItem.note` shape) + price in tabular Martian Mono, right- or bottom-aligned. This is exactly the shape `EDITION_MENU` already builds in `site-nav.tsx:22-30` — extend that pattern to Modules/Build/Pricing-Plans cards (Marketplace panel) and Docs/Glossary/Changelog/Security cards (Resources panel, no price).
- **Panel width:** card-sized, not full-bleed — 2–4 cards per panel (Editions=4, Marketplace=3, Resources=4), so no viewport-spanning mega-menu is needed; this stays true to ADR-0190's anti-cliché rejection.
- **Interaction:** WAI-ARIA APG **Disclosure** pattern (not `role=menu`), per ADR-0190 — this generalizes cleanly to three disclosures instead of one. Trigger is a real focusable button (`aria-expanded`, `aria-controls`); `Esc` closes and returns focus to trigger; clicking outside closes; top-level items inside the panel stay real `<a>` links (never JS-only). Hover MAY open on desktop as a progressive enhancement but click/Enter/Space is the accessible baseline — don't build hover-only (fails touch + keyboard-only nav).
- **<900px collapse:** each panel becomes an accordion section inside `MobileNav`'s existing drawer (the current `MOBILE_LINKS` flat list already lists editions/pricing/modules/build/docs flat — restructure into three named accordion groups mirroring the desktop panels, so mobile and desktop share one taxonomy, not two).
- **Type-chip disambiguation (F5):** every price-bearing card in the Editions and Marketplace panels carries a small Module/Edition/Plan chip (reuse `StatusChip`-style token, monochrome + one accent dot at most) so the post-rename catalog (compliance/ai-kit collisions resolved) never reads ambiguous in a dense panel.

**Brand-floor mapping:** panel surface = `--cs-surface-1`/`--cs-surface-2` on the elevation ladder with a `--cs-shadow-md` step (this is exactly the "deliberate elevation" ADR-0078 §7 describes — dropdown panels are a textbook case, unlike flat content). Trigger active/open state gets the accent focus-ring only, never an accent background fill (protects the accent-slot list). Panel `border` = `--cs-border` hairline, following the Linear-changelog reference's border-not-shadow depth language for the _inside_ of the panel (cards separated by hairlines) with the shadow reserved for the panel-vs-page separation.

---

## 2. Marketplace hub — unified `/marketplace` with Editions · Modules · Build · Plans tabs

**Locked shape (ADR-0237 F1, overriding ADR-0191's three-route split):** one hub route, four tabs; `/pricing` 301s in; `/modules` and `/build` fold in as tabs/deep-links. The prior three-route research (ADR-0191) still describes the _content_ of each surface (facet grammar for Modules, configurator shape for Build) — only the _routing_ changed to tabs-under-one-hub.

### Reference patterns

1. **Vercel `/integrations` directory** (screen `010c7da2`) — "Find an Integration" with a left category sidebar + grouped card sections in a wide content area, dark theme, logo+description cards. **Adopt:** the card density and the grouped-section-under-heading structure for the **Modules** tab (group by category, e.g. compliance-controls / observability / auth, mirroring the sidebar categories here as in-page section headers instead, since Caisson's tab bar already claims the top real estate a sidebar would fight with). **Reject:** the sidebar-as-primary-nav — ADR-0191 already specified **left facets** for `/modules` (category / edition-included-in / price-band / license-type with per-value counts, AND-across/OR-within), which is richer than Vercel's plain category rail; keep the facet sidebar, but visually treat it like Vercel's (thin rail, not a competing nav).

2. **Raycast `/store`** (screen `9e4bfde0`) — dark premium catalog: centered hero + search, a 3-column **featured** row, filter pills, then a denser 2-column listing grid with pagination, dark card surfaces, install-from-card CTA. **Adopt directly** as the closest single reference for the whole hub's _tone_: featured/spotlight row for Editions tab (4 edition cards get the "featured" treatment — bigger, richer), then the denser Modules grid below or in its own tab. The filter-pill row above the grid maps directly onto ADR-0191's "active-filter chips." **Reject:** Raycast's pagination — one scrollable filtered grid with a visible result count (live region, per ADR-0194) beats click-through pages for a due-diligence buyer.

3. **Doppler `/integrations` set-up grid** (screen `c150dbb4`) — search bar + integration card grid + a **separate smaller "Documentation" card grid** below the main grid, breadcrumb heading, sidebar nav. **Adopt:** the pattern of a secondary, visually distinct card row beneath the primary grid — useful for surfacing "Plans" or "Build your stack" as a related-but-distinct block if the Plans tab needs a lighter-weight teaser inside the Modules tab (cross-promotion without leaving the tab).

4. **shadcn/ui-style component-registry browsing** (style `c14c0a94`, "Ui") — monochrome, architectural-blueprint feel; large confident headings over a dense grid of neatly aligned component cards, pill-shaped buttons/badges as the _only_ rounded softness against an otherwise geometric system, tiny semantic-only color accents. **Adopt as the tonal north star for card density + restraint** — closer to Caisson's "engineered, exact" personality than Raycast's glossier dark-premium feel. Use Raycast for _layout mechanics_ (hero+search+filter+grid), use this shadcn-adjacent style for _restraint calibration_ (accent used only for semantic/status, everything else monochrome+hairline).

### Tab vs. filter grammar (concrete spec)

- **Tabs = product type** (Editions / Modules / Build / Plans) — a structural switch, URL-addressable (path segments or `?tab=`, SEO-friendly per the F1 redirect-equity requirement), NOT a client-only state toggle. Each tab is effectively the old route's content, now composed under one shell.
- **Filters = within-tab refinement** (facets in Modules, module-picker state in Build) — client-side, debounced, never changes the URL's tab segment.
- **Card density:** Editions tab = 4 large "featured" cards (icon + one-liner + price + CTA, richer than nav-panel cards — room for a short feature list). Modules tab = dense grid, one card unit shared visually with the nav-panel card atom (consistency). Plans tab = the existing `SkuMatrix`/subscription comparison, not a card grid (tabular data reads better tabular).
- **Type chips (F5):** every card in every tab carries the Module/Edition/Plan chip — the primary collision-resolution UI post-rename.
- **Price display:** tabular Martian Mono numerals, right-aligned on cards, always visible (never hidden behind a hover/click — compliance buyers price-compare fast).
- **Build coexisting as a tab:** the ADR-0191 two-column configurator (module picker left, sticky running-total rail right, `role=status aria-live=polite`) drops in as the Build tab's content wholesale — no redesign needed, just re-parenting under the tab shell. Bottom-sheet fallback under 768px stays.

**Brand-floor mapping:** hub shell background `--cs-bg`, tab bar uses the pill/capsule treatment from the Linear-changelog reference (rounded-full active-tab indicator, muted-text inactive tabs) — this reuses the same pill language recommended for the nav dropdown triggers, giving the whole site one consistent "capsule = navigational/filtering control" grammar vs. "card = content" grammar.

---

## 3. Product depth pages — module/edition detail routes

**Locked shape (ADR-0237 F2):** real routes (`/marketplace/modules/[slug]` or equivalent) for all 11 standalone modules (ADR-0238 — the four edition cores present through their edition pages) on the section-union renderer (ADR-0232/0235) + a new `media` section kind; edition pages get the same media slot + card grammar; Product/Offer JSON-LD on every page; **placeholder brand art now, real media later.**

### Reference patterns

1. **Raycast extension detail pages** (`the-browser-company/arc`, `mattisssa/spotify-player` — screens `f719e83c`, `2c1536ff`, `3f2b087c`, `a743844b`, `dc210d1a`). The single best structural match: **hero (icon + title + one-liner + Install CTA right-aligned)** → **pill tabs (Overview / Commands / Version History)** → **left content column** (screenshot gallery, long-form docs, changelog) + **right sidebar** (metadata, actions, related items) → **footer**. **Adopt near-wholesale**, remapped to Caisson's real content:
   - Hero: bespoke module icon + module name + one-liner + type chip → buy CTA (see buy-rail decision below).
   - Section order → **Definition / What's included / [Real code artifact] / FAQ** (Raycast's Overview≈Definition, Commands≈What's-included, Version-History≈optional changelog).
   - Right sidebar → metadata block (license type, category, "included in" edition badges, related modules).
   - **Reject:** Raycast's install-count/contributor-avatar social-proof furniture — wrong register for a compliance buyer; the anti-boilerplate law already bans "revenue-screenshot/metric-flex energy." Keep the _structure_, drop the _social-proof decoration_.

2. **GitHub repo page (`facebook/Ax`)** (screen `b5e83c68`) — three-column: file browser / README (center, the real artifact) / metadata sidebar, badges inline. **Adopt:** the principle that the **README/artifact IS the center column**, not a decorative aside — the real-code-artifact section on each module page gets README-page-level typographic priority, not one card among many.

3. **Instacart product-detail sticky purchase rail** (screens `1ec23620`, `c5d37b07`) — three-column desktop with a **sticky right purchase panel** (price, quantity, Add-to-cart) persisting through scroll; stacked single-column on mobile. **Adopt for the buy decision:** **sticky rail on desktop ≥900px, inline CTA (hero + bottom-of-page repeat) below it** — matches the `/build` `position: sticky` running-total rail precedent already proven in this codebase.

4. **Vercel `/docs` three-column doc layout** (screen `f7724275`) — left nav, center content, right sticky "On this page" anchor nav. **Adopt for wayfinding:** a lightweight sticky in-page anchor nav (Definition → Included → Artifact → Media → FAQ) doubles as breadcrumb _and_ scroll-progress indicator, cheap to build off the renderer's section list. **Reject:** a full left docs-nav sidebar on a commerce page — a simple breadcrumb (`Marketplace / Modules / audit-worm`) above the hero is enough.

### Placeholder media slot (OPERATOR DIRECTIVE 2026-07-03 — minimal effort)

Real media is being produced before launch, so the placeholder is deliberately throwaway: **the
module's own bespoke icon scaled large at low opacity/tint on a `--cs-surface-2` field, over a
plain `--cs-border`-hairline grid.** One dumb component, no seeding, no generative system — the
only contract that matters is the aspect-ratio container the real media will later drop into.
(The earlier waterline-strata / seeded-schematic options were explicitly cut by the operator:
"just use the icon or a blank grid bc media is being made before launch anyway.")

**Do not** use photography, 3D glass blobs, or stock illustration for the placeholder — banned by the design system, and a "placeholder" excuse doesn't suspend that rule.

---

## 4. Bespoke icon set — ~17 marks (11 modules + 4 editions + bundle + plans)

> **Count amendment (2026-07-03, ADR-0238):** the four edition-core à-la-carte rows were dropped —
> the standalone-module catalog is 11, so the set sizes at ~17 marks, not ~21. Each edition mark
> doubles as its core package's glyph where one is needed. "21" below is pre-0238 sizing; the
> grammar and families are unchanged.

### Reference patterns for icon-language direction

1. **Axiom style-token export** (`6e9baa82`) — line-based, monochromatic icons inside a near-black/orange-accent industrial system, 2px radius discipline, mono-driven precision. **Adopt the discipline:** icons are functional glyphs in a muted tone by default; accent is reserved for the _active/status_ state only — never a rainbow of per-module colors (reinforces ADR-0078 §5: "domain icon + label only, under one accent — never a per-edition rainbow").

2. **Trunk style** (`09af2984`) — "digital engineering blueprint... circuit-like line art... consistent stroke weight." **Adopt the construction grammar:** icons built from a small set of primitive strokes (lines, right-angle joins, occasional filled dot for a node/terminus) rather than pictorial icons — matches the existing bespoke-glyph precedent (`rls`, `worm`, `audit-chain`, `fail-closed`, `field-crypto`, `evidence-pack`, `caisson`).

3. **1Password Product-dropdown icon row** (screen `3940eb83`) and **GitHub package-registry cards** (screen `ccececfa`) — heterogeneous icon sets reading as one family through **shared stroke weight + shared canvas + shared corner logic**. **Adopt:** lock the _external_ constraints hard (grid, stroke, corner radius, accent budget) and let internal geometry vary per concept — the only way 21 genuinely different concepts read as one coherent set.

### The grammar (recommended, buildable by an SVG-authoring agent)

- **Canvas:** 24×24px grid (matches the existing Lucide workhorse grid — icons interleave in nav panels/cards without scale mismatch).
- **Stroke:** 2px, round joins/caps by default; ONE sanctioned exception — a filled 2px-radius square/dot for a single "terminus/node" mark per icon (a data point, lock, or state) — never more than one filled element per glyph.
- **Corner logic:** sharp/near-sharp corners (2–4px radius, tracking `foundation.radius.sm`) on structural strokes — icons feel "engineered instrument," not "friendly app icon."
- **Accent usage (binding, ADR-0189):** every icon ships in one monochrome (`--cs-fg`/`--cs-fg-muted`) variant for default/inactive contexts; the SAME icon gets exactly one element re-colored `--cs-accent` (never a second color) for the active/selected/status state. This extends the existing `<Icon name=… />` monochrome-plus-accent-on-active contract from ~7 to 21 bespoke marks.
- **Composition families** (so 21 marks don't feel like 21 unrelated inventions):
  - **Layered/strata family** (compliance-adjacent: audit-worm, retention-runner, oscal/hipaa-flavored): stacked horizontal bars/rectangles, varying only in count/gap/accent-seam position.
  - **Node/graph family** (infra/orchestration: agent-runner, jobs, mcp-server, tool-exec): dots connected by right-angle or diagonal strokes, varying node count/topology.
  - **Enclosure/seal family** (security/crypto: field-crypto, auth, tenancy-rls, license): a bounding shape (square/hex) with one interior mark, varying the interior glyph.
  - **Editions (4):** each edition icon is a **composite** — the base umbrella glyph (waterline-over-chamber, already locked) plus ONE small domain accent-mark drawn from whichever family dominates that edition's module set — "same rigor, adjacent problem" legible without inventing 4 unrelated hero icons.
  - **Plans:** a simple tier-glyph (concentric/stacked chevrons or stepped-bar primitive) distinct from the module/edition families — a Plan card is instantly not-confused with a Module/Edition card even before the type chip renders.

### 3 example constructions (precise enough for an SVG-authoring agent)

1. **`audit-worm`** (layered/strata): three horizontal rectangles (heights 4/4/4px, 2px gaps) stacked in the 24px canvas, sharp 2px corners, `--cs-fg-muted` stroke-only on the bottom two, the TOP rectangle gets one accent seam — a single 2px vertical accent line crossing only its left edge — "one sealed/locked layer atop immutable layers below." No terminus dot (three strata already read as "layered").

2. **`agent-runner`** (node/graph): three nodes (2px-radius filled squares, `--cs-fg` monochrome) in an L-path (top-left, bottom-left, bottom-right) connected by two right-angle 2px strokes; the bottom-right terminal node alone switches to `--cs-accent` fill in the active state ("the running/current step") — everything else stays monochrome even when active.

3. **`field-crypto`** (enclosure/seal): a 16×16px square outline (2px stroke, 2px corner radius) centered in the 24px canvas, one small filled dot at center ("the sealed field") — default `--cs-fg-muted`; active state the dot alone becomes `--cs-accent`; the enclosing square stays monochrome always (the boundary is never the emphasis — only the sealed contents earn the instrument light).

---

## Cross-cutting notes for build agents

- **Token additions likely needed** (per rider 1, land as reviewable diffs): a `pill`/capsule button-trigger variant if one doesn't already exist cleanly for nav triggers + tab bars (check `foundation.radius.pill` — 999px exists, may already be wired; verify before adding); the `media` section-kind schema for the section-union renderer (F2); possibly a small `--cs-tile-seed-*` token set if the waterline-strata generative tile needs named band-opacity/offset tokens rather than fully runtime-computed values (deterministic and auditable rather than a black-box hash).
- **A11y (ADR-0194, non-negotiable):** all three nav dropdowns share the Disclosure contract already proven for Editions — Marketplace/Resources must not regress to `role=menu` or hover-only. Marketplace hub tabs need `role=tablist`/`tab`/`tabpanel` with URL sync (browser back/forward moves between tabs). Depth-page sticky buy rail must not trap focus or overlap the skip-link.
- **SEO (F1 rider):** `/pricing` → `/marketplace` redirect must be a real 301, sitemap + canonical + internal links updated same-change.
- **Type-chip + rename dependency (F5):** nav-panel cards, hub cards, and depth-page heroes all display module/edition names and prices — none of this visual work hardcodes `compliance`/`ai-kit` as bare strings; source names from the (post-rename) route/pricing registries the same way `site-nav.tsx` already does (`priceById`, `EDITION_ROUTES`), so the F5 rename ripple never needs a second copy-paste pass through the new UI.
