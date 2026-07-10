---
"@caisson/ui": patch
---

Reveal now shares a single `IntersectionObserver` across every instance on the page
instead of constructing one per element. A page with a dozen or more `<Reveal>`s
(a typical landing page) used to spin up a dozen or more observers doing the same
scroll-tracking work; now there's exactly one, keyed to each element through a
`WeakMap` so every instance still reveals independently off its own intersection.
Visual behavior, timing, and the `prefers-reduced-motion` fallback are unchanged —
this is purely an internal cost reduction on page hydration.
