# @caisson-sh/ui

A typed OKLCH token floor plus a consistent component recipe: Radix behavior, co-located
CSS, and data-* attribute variants, shipped as framework-agnostic raw `.tsx`.

- **Layer:** base

## Install

```bash
bun add @caisson-sh/ui
```

## Use

```ts
import { foundation, darkTheme, lightTheme } from "@caisson-sh/ui/tokens";
import { Card, Faq, FeatureGrid } from "@caisson-sh/ui/components";
import "@caisson-sh/ui/styles/base.css";
import "@caisson-sh/ui/styles/tokens.css";
```

## Generated agent manifest

`bun run gen:manifest` derives the 39 primary components from the component barrel and writes the
strict `@caisson-sh/ds-manifest` artifact. `bun run check:manifest` is the non-writing CI drift guard.
Component prop types, literal variants, token dependencies, accessibility notes, and recipe rules
come from the source rather than a parallel hand-maintained inventory.
