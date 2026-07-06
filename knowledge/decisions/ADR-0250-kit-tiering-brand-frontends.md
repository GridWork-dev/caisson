# ADR-0250 — Kit tiering (ui floor · ui-pro commercial · brand private), staged buildout, per-package frontend shape

**Status:** accepted · 2026-07-05 (G2 picker, third structured round of the catalog-rework
session, grounded by the frontend investigation). Closes the G2 redirect ADR-0249 recorded.
**Extends** ADR-0246/0248/0249; respects ADR-0044 (Next-standard untouched — kit packages are
libraries, not apps) and ADR-0078/0099–0104 (the brand system moves home, its locks unchanged).
**G2a is an operator override** of the written P1 recommendation. Append-only; supersede with a
later ADR, never edit. **Tags:** none at lock; the builds inherit the standards-gate critical
path (license boundary edits) and `ui`/`frontend`.

## Decision

1. **G2a = P3 tiering (override of the P1 rec):** three surfaces —
   - **`@caisson/ui`** stays Apache-2.0: the generic floor (tokens + the generic component set,
     stripped of brand defaults).
   - **`@caisson/ui-pro`** (new, `LicenseRef-Caisson-Commercial`): the full-surface kit tier —
     a genuinely NEW product surface (richer/deeper components beyond the floor) that requires
     **its own SPEC** (component list, docs surface, price) before any build; priced at the
     pricing-revalidation pass; registry-gated like every commercial module.
   - **`@caisson/brand`** (new, private/unpublished): `Glyph`/`Wordmark`, the 22 bespoke domain
     glyphs (via the Icon extension-point pattern), the caisson palette as one preset, the two
     baked defaults removed from the floor (`app-shell` wordmark slot, `credential-strip`
     aria-label).
2. **G2b = staged buildout:** (1) brand extraction rides the catalog-rework SPEC (mechanical,
   ~9 real call sites); (2) the runtime theme API + preset registry is the next kit build item
   (today's 3 OKLCH candidates become registrable presets instead of build-time discards);
   (3) the public docs/gallery lands when the kit is marketed or the frontend wave needs it.
3. **G2c = per-package frontend delivery shape:** default = a **`./ui` subpath export inside
   the owning package**, built on the `@caisson/ui` floor (license auto-inherits through the
   existing gate; down-only composition per ADR-0003). Exception = a companion
   `@caisson/<pkg>-ui` package ONLY where the core is deliberately framework-free
   (agent-dev/tool-exec class). A shared cross-package frontends package is **forbidden**
   (license-mixing bug class).
4. **G2d = wave-1 frontends, sequenced after the catalog-rework SPEC:** the six S-effort
   surfaces whose read APIs already exist — audit-worm chain viewer · license-issue issuance
   log (admin-side) · local-store search · prompt-registry browser · ai-meter usage chart ·
   audit-harness matrix viewer. Sink-first surfaces (guardrails verdict feed, alerting history,
   ai-evals scoreboard) queue behind their data stores as separate items.

## Consequences

- The **ui-pro SPEC** is a new tracker row (own session; defines the pro component list +
  docs surface; feeds the pricing pass). Until it locks, nothing is built for the pro tier.
- The brand extraction changes no `OPEN_BASE_NAMES` entry (`ui` stays open; `brand` is
  unpublished; `ui-pro` lands as a normal commercial module row when its SPEC locks).
- Wave-1 per-package frontends consume the post-extraction floor — sequencing is binding:
  brand cut → theme API → frontends (each frontend also needs its package's read API only,
  which exists for all six wave-1 rows).
- The centralized buyer dashboard (`apps/site/app/dashboard`) remains the buyer's home
  surface; per-package `./ui` components are the reusable building blocks it (and buyer apps)
  compose — not a replacement for it.
