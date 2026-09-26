// @caisson-sh/brand — the private Caisson brand layer. The wordmark + glyph lockup and the bespoke
// domain glyph set, kept out of the Apache-2.0 `@caisson-sh/ui` floor so the kit stays brand-neutral
// for reuse. `private: true` — never published. Apps consume this package directly and register the
// glyphs into the kit icon surface at startup via `registerIcons(brandGlyphs)`.
export { Glyph, Wordmark } from "./brand.tsx";
export type { WordmarkProps } from "./brand.tsx";
export { brandGlyphs } from "./glyphs.tsx";
