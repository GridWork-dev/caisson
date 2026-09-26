# @caisson-sh/brand

The private Caisson brand layer: the `Wordmark` + `Glyph` lockup and the 37 bespoke domain glyphs
(RLS, WORM, audit-chain, field-crypto, …), kept out of the Apache-2.0 `@caisson-sh/ui` floor so that
kit stays brand-neutral for reuse. `private: true` — **never published**; an app consumes this
package directly and registers the glyphs into the kit's icon surface at startup.

## What it gives you

- **`Wordmark` / `Glyph`** — the lowercase mono `caisson` wordmark with the "pressure vessel" mark
  riding beside it; monochrome (`currentColor`) always, so the accent color never enters the mark.
  Both `forwardRef` a single SVG/DOM root, server-safe (no `"use client"`).
- **`brandGlyphs`** — the 37 bespoke domain glyphs, keyed by `@caisson-sh/ui`'s `RegisteredIconName`
  contract, ready to hand to that package's `registerIcons`.

## Install

Never published — this package is a workspace-only dependency of the apps that render the brand:

```json
"@caisson-sh/brand": "workspace:*"
```

## Use

```tsx
import { registerIcons } from "@caisson-sh/ui/components";
import { brandGlyphs, Wordmark } from "@caisson-sh/brand";

// once, at app startup: wire the bespoke glyphs into the kit's icon surface
registerIcons(brandGlyphs);

function Header() {
  return <Wordmark descriptor />;
}
```

## Tests

`bun test packages/brand/src` — every glyph in `brandGlyphs` renders and its key set matches
`@caisson-sh/ui`'s `RegisteredIconName` contract exactly (no missing or stray key).

License: Apache-2.0.
