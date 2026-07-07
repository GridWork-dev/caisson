# ADR-0284 — Unified component catalog + email consolidation

**Status:** accepted · 2026-07-07 (operator-locked, sixth-sitting picker). Extends
ADR-0250 (kit program) and ADR-0259 (ui-pro leaf law). Append-only; supersede with a
later ADR, never edit. **Tags:** `frontend`.

## Context

Three demo/preview silos have accreted: the public site `/ui` page shows only ui-pro
(11 components), admin `/design` shows only the base kit (34 components), and the 7
react-email commerce templates render only on a dev-only site preview page. A fourth
pile — two plain-HTML growth emails (`apps/site/emails/`) — never joined `packages/email`.
The packages themselves are already unified structurally (ui-pro depends on @caisson/ui,
composes its primitives, inherits the token layer; the ADR-0259 leaf law holds).

## Decision

1. **Shared catalog registry.** One component-demo registry (per entry: name, variants,
   sample data, license tier) consumed by BOTH the site `/ui` page and the new admin
   catalog. The two-package split (ui / ui-pro) is unchanged — this unifies the DEMO
   layer, not the packages.
2. **Admin catalog surface.** A full catalog in `apps/admin`: all base-kit + ui-pro
   components with live demos, plus every email template rendered with sample data and a
   send-test-to-operator action. Absorbs the existing `/design` gallery pages.
3. **Email consolidation.** The two plain-HTML growth emails (waitlist-welcome,
   nurture-follow-up) migrate into `packages/email` as react-email templates — every
   email in the product lives in one pile, previewable together.
4. Aggressive graduation of site compositions (module-catalog, stack-builder, preview
   dialogs) into ui-pro is REJECTED for this wave — entangled with pricing/cart wiring;
   revisit demand-driven.

## Consequences

- The registry entry carries the license tier, so the site page can keep its buy-CTA
  framing while admin renders everything — one data source, two renderings.
- Builds sequence AFTER the current merge queue (kit stage-2 theming + ui-pro surfaces
  land first; the catalog reads them).
- `packages/email` gains two templates + the site's senders repoint; the dev-only site
  preview page is superseded by the admin surface (site page may be removed in the build).
