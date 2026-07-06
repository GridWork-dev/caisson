// Populate the @caisson/ui icon registry with the private @caisson/brand glyphs. Imported by the
// root layout so it runs at module scope in the SERVER bundle graph — the only graph admin renders
// bespoke icons in (the design/components gallery is a server component; admin's client components
// use only the Lucide floor). Side-effect import — keep it.
import { registerIcons } from "@caisson/ui/components";
import { brandGlyphs } from "@caisson/brand";

registerIcons(brandGlyphs);
