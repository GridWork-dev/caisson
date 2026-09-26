// Populate the @caisson-sh/ui icon registry with the private @caisson-sh/brand glyphs. The registry is
// per-bundle-graph mutable state, so this side-effect module is imported into BOTH graphs: the root
// layout (server) and the `@/components` barrel every client component pulls in (client). It runs
// once per graph at module scope, before any `<Icon name="worm" />` renders.
import { registerIcons } from "@caisson-sh/ui/components";
import { brandGlyphs } from "@caisson-sh/brand";

registerIcons(brandGlyphs);
