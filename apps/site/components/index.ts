// Barrel for the marketing surface's component set. Kit-first (ADR-0097): the shared primitives
// are the SINGLE implementation in `@caisson/ui/components` — re-exported here, never re-inlined.
// The only site-local wrappers are the framework seams: `Button` injects `next/link`, and
// Icon/Glyph/Wordmark/Reveal/MobileNav carry app-specific glyph sets / client behavior.
export {
  Card,
  CodeBlock,
  CredentialStrip,
  EditionCard,
  Hero,
  Section,
  SkuMatrix,
  StatusChip,
  Terminal,
} from "@caisson/ui/components";
export type {
  CardProps,
  CodeBlockProps,
  CredentialStripProps,
  EditionCardProps,
  HeroProps,
  SectionProps,
  SkuMatrixProps,
  StatusChipProps,
  TerminalProps,
} from "@caisson/ui/components";

// Framework-seam wrapper over the kit Button (next/link injection).
export { Button } from "./button";
export type { ButtonProps } from "./button";

// Site-local components (app-specific glyph set + client behavior).
export { Icon, type IconName } from "./icon";
export { Glyph, Wordmark } from "./brand";
export { Reveal } from "./reveal";
export { MobileNav } from "./mobile-nav";
