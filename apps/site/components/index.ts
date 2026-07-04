// Barrel for the marketing surface's component set. Kit-first (ADR-0099): every shared primitive is
// the SINGLE implementation in `@caisson/ui/components` — re-exported here, never re-inlined. The
// Icon/Glyph/Wordmark/Reveal/ThemeToggle primitives now live in the kit too (consolidated from the
// former site-local copies — drift-proofing the marketing surface against the gallery). The only
// site-local components are the framework seams: `Button` injects `next/link`, and `MobileNav` owns
// app-specific client nav behavior.
export {
  Card,
  CodeBlock,
  CredentialStrip,
  EditionCard,
  Faq,
  FeatureGrid,
  Glyph,
  Hero,
  Icon,
  MobileBuyBar,
  Reveal,
  Section,
  SkuMatrix,
  StatusChip,
  Terminal,
  ThemeToggle,
  Wordmark,
} from "@caisson/ui/components";
export type {
  CardProps,
  CodeBlockProps,
  CredentialStripProps,
  EditionCardProps,
  FaqItem,
  FaqProps,
  FeatureGridProps,
  HeroProps,
  IconName,
  IconProps,
  MobileBuyBarProps,
  RevealProps,
  SectionProps,
  SkuMatrixProps,
  StatusChipProps,
  TerminalProps,
  ThemeToggleProps,
  WordmarkProps,
} from "@caisson/ui/components";

// Framework-seam wrapper over the kit Button (next/link injection).
export { Button } from "./button";
export type { ButtonProps } from "./button";

// Site-local component (app-specific client nav behavior).
export { MobileNav } from "./mobile-nav";
