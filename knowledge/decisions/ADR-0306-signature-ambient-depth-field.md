# ADR-0306 — Homepage signature piece: ambient depth-fog lattice field (three.js core, poster-first)

**Status:** accepted · 2026-07-09 (operator-locked, Kickoff-I scope-lock fork round, question 1
of 7 — concept + fallback + budget locked in the same sitting). **Tags:** `ui`, `frontend`.
Amends ADR-0104 (fills the reserved blank slot); executes ADR-0078 §6 for the hero; bounded by
the ADR-0079 CWV/a11y gate.

## Context

The homepage signature-visual slot has been blank since ADR-0104 shipped the static
code-as-proof hero. ADR-0104 deferred three.js with two conditions: an authored
caisson-metaphor scene (it sketched object-scenes — pressure vessel, audit-chain,
field-crypto seal) and "never a generic particle hero"; no heavy dep entered the repo. ADR-0299
handed the decision to Kickoff-I as a scope-first item. At the sitting the operator redirected
the concept class itself: **not an authored object/diagram/artifact scene — an ambient,
reactive background field** behind the hero. Refero research grounded four ambient directions
(waterline depth shader · pressure particle field · depth-fog lattice · caustic shafts) against
three.tools / HashiCorp / Max Yinger / Trunk / Active Theory references.

## Decision

1. **Concept — the depth-fog lattice field.** A barely-there instanced structural grid receding
   into depth fog behind the hero — an environment, not an object. A slow scan-line light sweep
   travels through the lattice periodically (the health-check pulse); pointer movement shifts
   the depth layers in gentle parallax. Rendered strictly from the ADR-0078 §4 vocabulary
   (blueprint structure + the waterline/depth-darkening motif, single accent ≤10% budget,
   near-black wet-steel neutrals) — the on-vocabulary construction is what keeps "ambient" from
   reading as the generic devtool field ADR-0104 warned against. This amends ADR-0104's
   authored-object-scene preference: the ambient-background class is the locked direction.
2. **Fallback posture — poster-first, idle hydrate.** The hero always SSRs a static rendition
   of the field (CSS/SVG depth gradient + waterline hairline + faint lattice suggestion — not
   an LCP candidate). The canvas chunk loads only when **all** hold: viewport ≥1024px · no
   `prefers-reduced-motion` · browser idle after LCP. It fades in over the poster; mobile never
   downloads the chunk; WebGL unavailability or context loss keeps/restores the poster. The
   gating mirrors the established `reveal.tsx` matchMedia idiom. The `h1` remains the LCP
   element; the canvas is `aria-hidden`, `pointer-events: none`, paused when offscreen.
3. **Budget — ≤130KB gzip, three.js core only.** `three` (tree-shaken core imports, MIT) is
   admitted to `apps/site` — **no** `@react-three/fiber`, **no** `drei`. One imperative client
   component behind `next/dynamic` `ssr:false`, emitted as a home-route-only lazy chunk;
   non-home routes must not grow. The ceiling is asserted from `next build` output in the wave
   verify (no CI bundle gate exists — see ADR-0309 for the evidence posture).

## Consequences

- The last blank brand surface fills without touching the hero's HTML/LCP contract; ADR-0104's
  static code-as-proof hero stays intact underneath — the field is purely additive layering.
- `three` becomes a direct dependency of `apps/site` — the first heavy visual dep in the repo,
  contained to one lazy chunk with a locked ceiling; R3F/drei stay out, so removal is one
  component + one dep.
- Reduced-motion, mobile, and no-WebGL users get a designed poster, not a degraded scene — the
  poster is the authored rest-frame of the same field, so every visitor sees the motif.
