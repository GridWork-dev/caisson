---
"@caisson/ui": minor
---

Reveal gains an authored-motion variant API. Two new optional props extend the scroll
reveal without changing any existing call site: `direction` (`"up" | "down" | "left" |
"right" | "none"`, default `"up"`) picks the axis the element travels in along, and
`distance` (px, default 12) sets the pre-reveal offset. The offset is driven through the
`--cs-reveal-x` / `--cs-reveal-y` custom properties the co-located `reveal.css`
hidden-state rule reads, with fallbacks that reproduce the legacy fade-up-12 exactly — so
existing `<Reveal>` and `<Reveal delay={...}>` usages are unchanged. Pair `delay` across
siblings (`delay={i * 70}`) for a staggered grid cascade. `prefers-reduced-motion` still
forces the pre-reveal state visible (never stuck at `opacity: 0`), and the primitive stays
gated on `.cs-js` so no-JS / pre-hydration renders content fully visible (ADR-0078 §6).
