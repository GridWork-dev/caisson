# ADR-0307 — Sitewide authored-motion pass (hero field · card-viewer · sections · micro-interactions)

**Status:** accepted · 2026-07-09 (operator-locked, Kickoff-I scope-lock fork round, question 4
of 7 — the widest of the three offered scopes). **Tags:** `ui`, `frontend`. Executes ADR-0078 §6
across the marketing surface; extends the ADR-0290/0298 card-viewer without reopening either.

## Context

ADR-0078 §6 specifies an expressive motion language (tokenized `--cs-duration-*` /
`--cs-ease-*`, transform/opacity-first, reduced-motion honored, exits ~20% faster than enters)
but only the `Reveal` fade-up primitive ever shipped — it is the site's entire motion inventory.
The marketplace card-viewer is a native `<dialog>` with zero transitions (instant pop open/close
on the highest-traffic commerce surface); hero/section transitions and micro-interactions have
no authored motion. The kickoff offered hero-only, hero+card-viewer, or a sitewide pass; the
operator locked sitewide.

## Decision

One authored-motion pass across the marketing surface, CSS-first (no animation library — the
lockfile's transitive framer-motion stays unused):

1. **Card-viewer open/close** — authored enter/exit on the `<dialog>` and its `::backdrop`
   (scale/fade via `@starting-style` + `[open]` transitions), tokenized durations, exit faster
   than enter.
2. **Section/page transitions** — the `Reveal` primitive gains authored variants (stagger,
   direction) applied deliberately per section rather than one uniform fade-up.
3. **Micro-interactions** — hover/active/focus refinement on buttons, cards, nav, and the
   marketplace grid, within the ADR-0078 elevation+glow scale.
4. **The floor holds everywhere:** every addition is transform/opacity-only, tokenized, guarded
   by `prefers-reduced-motion` (content never stuck at `opacity: 0`), no animation on
   keyboard-initiated or high-frequency actions, no looping gimmicks.

## Consequences

- Motion stops being one primitive stretched sitewide; the ADR-0078 §6 language finally exists
  in shipped form on every marketing route.
- Largest regression surface of the offered scopes — accepted; the visual harness delta over
  all touched routes is the named verify artifact (ADR-0309).
- CSS-only keeps the pass dependency-free and individually revertible per surface.
