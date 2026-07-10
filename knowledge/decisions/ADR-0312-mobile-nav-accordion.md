# ADR-0312 — Mobile nav: accordion dropdown + the search-stacking defect fix

- **Status:** locked (operator pick, 2026-07-10 perf/mobile picker; extends ADR-0296, executes
  ADR-0307 on the drawer)
- **Context:** live mobile repro (`outputs/research/perf-mobile-research-2026-07-10.md` §3)
  root-caused the operator's report. (1) Search is DEAD on mobile: the drawer is a native
  `<dialog>.showModal()` in the browser top layer; fumadocs' SearchDialog is a plain
  `position:fixed` div that opens BEHIND it — the input is unreachable
  (`elementFromPoint` returns `<html>`). (2) The drawer has zero enter/exit animation.
  (3) The link list is flat, icon-less, and group-less — `MOBILE_LINKS` was hand-flattened
  separately from the desktop panel spec. (4) The bottom piles a full-width CTA, a tiny
  centered "Sign in" pill, and a bare theme toggle in three alignments; no account icon exists
  anywhere in the codebase.

## Decision

Rebuild the drawer contents as the **Accordion Dropdown** (research direction C), keeping the
ADR-0296 native-`<dialog>` top-drawer shell:

1. **Search defect fix (rides regardless of direction):** opening search closes the drawer —
   the search-open signal dismisses the top-layer `<dialog>` before/as the fumadocs dialog
   mounts. Verified fix criterion: at 390px, tap Search in the drawer → a focusable, typeable
   search input is on screen.
2. **Pinned top block, never scrolled away:** account row (user icon + "Account"/"Sign in" —
   add the missing icon, one-line lucide `circle-user` or reuse `dashboard`), cart row, and
   the "Get started" CTA.
3. **Three collapsed sections** via native `<details>/<summary>` (zero JS, keyboard-free):
   **Bundles / Marketplace / Resources**, each summary carrying its icon + chevron; the
   current section defaults open. Rows inside are icon + label, sourced from the same grouped
   spec as the desktop panels (`MOBILE_LINKS` becomes `{group, href, label, icon}` derived
   from one source so mobile cannot drift).
4. **Authored motion (the ADR-0307 gap):** drawer enter/exit gets the tokenized slide-down
   (`@starting-style` + `transition-behavior: allow-discrete`, `--cs-duration-base` in /
   `--cs-duration-fast` out); section expand animates `grid-template-rows 0fr→1fr`;
   `prefers-reduced-motion` collapses to opacity/instant.
5. Theme toggle moves into the footer utility row of the panel — one aligned block, not a
   stray bottom-left button.

## Consequences

Shortest panel of the three directions and the strongest account/cart visibility; costs one
extra tap to reach a link (mitigated by the current-section-open default). Precedents:
1Password dev-docs collapsible categories, Tailwind/Supabase mobile menus (refero-cited in the
research doc). The rejected directions (Sectioned Sheet, Card-Row) are recorded there.
