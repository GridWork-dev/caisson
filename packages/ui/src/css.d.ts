// Co-located component CSS is a side-effect import (the recipe, ADR-0099). tsc doesn't resolve
// `.css` modules; the consuming bundler (Next via transpilePackages) handles the actual emission.
declare module "*.css";
