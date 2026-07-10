# Perf + mobile research — 2026-07-10 (Kickoff-I follow-on)

Four-agent research round (opus×3 + sonnet live-repro) driven by the first error-level
lighthouse runs (29071930623 red → fixes → 29072745113: one residual red, `/` perf 0.57
desktop) and the operator's mobile defect report. Feeds the fork picker; locks become ADRs.

## 1. Homepage hydration breakdown (the 684ms self-bootup)

The homepage body is **already ~95% server components** — Section/Card/BundleCard/SkuMatrix/
Terminal/CodeBlock/diagrams are all RSC. Convert-to-RSC has little left; the cost is:

- **Two below-fold body islands:** `StackBuilder` (drags pricing + catalog + cart into initial
  JS; hydration wasted at t0) and `RepoArtifact` (pure click-to-reveal toggle shipping 4 static
  code strings as client JS — CSS radio/`:checked` does the same server-side).
- **The always-on shared-chrome tax on EVERY marketing page:** better-auth/react (`NavAccount`
  session hook), fumadocs `RootProvider` + search context, ui-pro Popover (`NavPanels`),
  CartProvider/CartDrawer, and `OwnedItemsProvider` firing a **wasted `/api/cart/owned` fetch
  on every signed-out view**.
- **13 Reveal instances** — children stay server-rendered (props.children passthrough); cost is
  13 wrapper hydrations + 13 separate IntersectionObservers (collapsible to one shared observer,
  zero visual change).
- three.js chunk: already optimally deferred (ADR-0306 gates + SwiftShader bail) — leave.

**Approaches (honest TBT estimates):**

| #   | Approach                                                                                                                                                                                                                    | Effort     | Win                              | Risk                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------- | ------------------------------------------ |
| A1  | RepoArtifact → pure-CSS radio reveal (drop the island)                                                                                                                                                                      | S (2-4h)   | ~40-90ms                         | LOW                                        |
| A2  | Defer-hydrate StackBuilder via the in-repo `next/dynamic ssr:false` poster pattern                                                                                                                                          | S-M (4-6h) | ~100-180ms                       | LOW-MED (poster must match height, no CLS) |
| A3  | Shared-chrome trim, 4 slices: (a) NavAccount server-default + idle session swap · (b) owned-fetch gated on session cookie · (c) fumadocs search lazy-mount on first trigger/⌘K · (d) NavPanels popover defer to hover/focus | L (8-14h)  | ~150-300ms, amortized every page | MED-HIGH on (c)/(d); ship (a)(b) first     |
| A4  | Shared IntersectionObserver (13→1) + defer footer form + mobile drawer JS                                                                                                                                                   | S (3-5h)   | ~30-80ms                         | LOW                                        |

## 2. Site-wide perf sweep (config/route level, evidence-verified)

| Rank | Opportunity                                                                                                                                                | Effort | Impact                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------- |
| 1    | `compress: false` in next.config → CF brotli-compresses static JS/CSS (today origin pre-gzips ~1.7MB of assets and CF caches gzip; HTML already serves br) | S      | ~15-18% smaller JS+CSS on all cold loads          |
| 2    | Inline the 727B render-blocking `/theme-init.js` into `<head>` (its CSP justification is void — `unsafe-inline` is still in the policy)                    | S      | one blocking request off the FCP path, all routes |
| 3    | NFT whole-project-trace fix (`next.config.ts → services/license/dist` dynamic require) — standalone is 181MB                                               | M      | image size / Railway cold-start, ops win          |
| 4    | Delete the redundant `/_next/static` Cache-Control header (source of the build warning; Next 16 sets it natively)                                          | S      | hygiene only                                      |
| 5    | `optimizePackageImports` for `@caisson/ui` + `@caisson/demo-registry` — measure first                                                                      | S      | uncertain/modest                                  |
| 6    | `prefetch={false}` on ~20 footer links (54 links prefetch on / today)                                                                                      | S      | modest                                            |
| 7    | 94KB shared design-system CSS audit                                                                                                                        | L      | FCP all routes; design-owned, not the score lever |

Verified non-issues: fonts already self-hosted/subset/swap/preloaded; PostHog correctly
dashboard-only; three.js correctly gated. `/marketplace` carries MORE CSS+links yet scores
0.90 — CSS volume and prefetch are not the homepage differentiator; hydration is.

## 3. Mobile defects (live repro at 390×844, screenshots in the repro dir)

- **Search is dead on mobile — root-caused.** The only mobile search entry is inside the
  hamburger drawer. The drawer is a native `<dialog>.showModal()` (top layer); fumadocs'
  SearchDialog is a plain `position:fixed` div — it opens BEHIND the still-open top-layer
  drawer. `elementFromPoint` at the search input returns `<html>`: the input is unreachable.
  Fix classes: close the drawer when search opens (1-line signal) and/or render search above.
  This is a defect, not a fork — rides any nav direction.
- **Drawer has zero enter/exit animation** (no `@starting-style`/transition anywhere in
  dialog.css) — snaps open/closed; the main "not clean" driver. (An ADR-0307 gap.)
- **Flat, icon-less, group-less link list** (15 bare links, hairline-only separation) vs the
  desktop panels' icon+grouped cards; `MOBILE_LINKS` was hand-flattened separately from the
  panel spec (drift by construction).
- **Bottom pile-up:** full-width CTA → tiny centered "Sign in" pill → bare theme toggle, three
  alignments, no grouping; **no account icon exists anywhere in the codebase** (either state).
- Tap-outside technically works but the drawer fills the viewport below the header — no visible
  backdrop to tap; perception gap compounding the no-animation snap.
- Marketplace filter search works fine — the report is specifically the drawer search.

## 4. Mobile-nav design directions (gw-frontend-designer, refero-backed)

- **A · Sectioned Sheet (S, recommended):** keep the ADR-0296 Dialog top-drawer shell; contents
  become 3 labelled groups (Bundles / Marketplace / Resources) of icon+label rows with hairline
  separators, account promoted to a full-width icon row, authored slide-down enter/exit
  (closes the ADR-0307 gap). `MOBILE_LINKS` → grouped `{group,href,label,icon}` sourced from
  the desktop panel spec. Precedents: Appwrite dropdown (refero 664), 1Password dev-docs (413),
  Vercel/Linear/Stripe mobile sheets.
- **B · Card-Row Dropdown (M):** desktop NavCard language (icon + label + note + price) carried
  into the drawer; richest, ~2× row height, pushes account down unless collapsed.
- **C · Accordion Dropdown (M):** native `<details>` collapsed sections + account/cart/CTA
  pinned at top; shortest panel, one extra tap on primary wayfinding.

## 5. Standing operator fork (from the lighthouse evidence)

CF `challenge-platform/jsd` (zone JS-detections): 676ms bootup on every page + best-practices
cap 0.78. Kill via terraform (same class as the CAISSON-50 beacon kill) recovers roughly half
the homepage TBT and most of best-practices; cost is the bot-management signal. Pre-launch,
commerce sits behind CF-Access and the edge rate-limits are terraformed.
