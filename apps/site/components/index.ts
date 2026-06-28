// Barrel for the shared design-system primitives (Phase F contract). Surface pages import from
// "@/components" — the client/server boundary is preserved per-file (Reveal / MobileNav carry
// their own "use client").
export {
  Button,
  Card,
  CodeBlock,
  CredentialStrip,
  EditionCard,
  Hero,
  Section,
  SkuMatrix,
  StatusChip,
  Terminal,
} from "./ui";
export { Icon, type IconName } from "./icon";
export { Glyph, Wordmark } from "./brand";
export { Reveal } from "./reveal";
export { MobileNav } from "./mobile-nav";
