// Barrel for the marketing surface's component set. Kit-first (ADR-0099): every shared primitive is
// the SINGLE implementation in `@caisson-sh/ui/components` — re-exported here, never re-inlined. The
// Icon/Reveal/ThemeToggle primitives live in the kit; the brand mark (`Glyph`/`Wordmark`) is private
// IP re-exported from `@caisson-sh/brand`. The only site-local components are the framework seams:
// `Button` injects `next/link`, and `MobileNav` owns app-specific client nav behavior.
//
// Side-effect: registering the brand glyphs into the kit icon surface happens here so it runs in the
// CLIENT bundle graph — every client component that renders a bespoke `<Icon>` pulls this barrel in.
// The server graph is covered by the same import in the root layout.
import "@/lib/register-brand-icons";

export {
  Card,
  Checkbox,
  CodeBlock,
  CredentialStrip,
  BundleCard,
  Faq,
  FeatureGrid,
  Hero,
  Icon,
  Radio,
  Reveal,
  Section,
  SkuMatrix,
  StatusChip,
  Terminal,
  ThemeToggle,
} from "@caisson-sh/ui/components";
export type {
  CardProps,
  CheckboxProps,
  CodeBlockProps,
  CredentialStripProps,
  BundleCardProps,
  FaqItem,
  FaqProps,
  FeatureGridProps,
  HeroProps,
  IconName,
  IconProps,
  RadioProps,
  RevealProps,
  SectionProps,
  SkuMatrixProps,
  StatusChipProps,
  TerminalProps,
  ThemeToggleProps,
} from "@caisson-sh/ui/components";

// Brand mark — private IP, consumed directly from @caisson-sh/brand (apps are exempt from the
// open-core gates; the Apache-2.0 kit no longer ships the mark).
export { Glyph, Wordmark } from "@caisson-sh/brand";
export type { WordmarkProps } from "@caisson-sh/brand";

// Framework-seam wrapper over the kit Button (next/link injection).
export { Button } from "./button";
export type { ButtonProps } from "./button";

// Site-local component (app-specific client nav behavior).
export { MobileNav } from "./mobile-nav";
