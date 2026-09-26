// Co-located component CSS is a side-effect import (the recipe, ADR-0099). tsc doesn't resolve
// `.css` modules; the consuming bundler handles the actual emission. TS 6.0 checks side-effect
// imports (TS2882) — this ambient declaration covers the `@caisson-sh/ui` and `@caisson-sh/ui-pro`
// component sources this package's program pulls in.
declare module "*.css";
