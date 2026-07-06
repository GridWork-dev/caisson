// The section-union PageSection type (renderer SPEC §2, glossary SPEC Tasks 1-2). A page is a
// PageSpec: typed SEO meta (feeds `buildMetadata`) + an ORDERED PageSection[] a data file
// supplies. `<PageSections>` (components/page-sections.tsx) is the ONE renderer that switches on
// `kind` — this file holds only the shape, no rendering logic. Every variant maps to an existing
// @caisson/ui / site primitive (ADR-0099) — no new visual component, no plugin registry.
//
// Data files are compile-time-static in-repo TS source, not a runtime boundary — no Zod parse
// layer (renderer SPEC §4, ADR-0002 carve-out).
import type { ReactNode } from "react";
import type {
  FaqItem,
  HeroProps,
  IconName,
  SectionProps,
  SkuMatrixRow,
} from "@caisson/ui/components";

import type { PageMeta } from "./metadata";

/** hero — the split marketing header. Passes straight through to `<Hero>`. */
export interface HeroSection extends HeroProps {
  kind: "hero";
}

/** section — a titled band; `children` composes nested content. Passes straight through to `<Section>`. */
export interface GenericSection extends SectionProps {
  kind: "section";
}

/** One property/benefit tile rendered as a `<Card>` inside the grid. */
export interface FeatureGridItem {
  title: string;
  body: ReactNode;
  icon?: IconName;
}

/** featureGrid — 2-4 short properties (`<FeatureGrid>` of `<Card>`s), optionally under a header. */
export interface FeatureGridSection {
  kind: "featureGrid";
  cols?: 2 | 3;
  eyebrow?: string;
  title?: string;
  lede?: ReactNode;
  items: readonly FeatureGridItem[];
}

/** One control-map row: the `frameworks/eu-ai-act` `ANNEX_CONTROLS` shape (Card + framed CodeBlock). */
export interface ControlMapItem {
  icon?: IconName;
  /** Small label above the title, e.g. "Article 12 · Annex IV §3". */
  eyebrow?: string;
  /** Right-aligned chip, e.g. "Record-keeping". */
  label?: string;
  title: string;
  body: string;
  code: string;
  codeLabel?: string;
  clause?: string;
}

/** controlMap — an ordered evidence-row list (requirement → Caisson control → code proof). */
export interface ControlMapSection {
  kind: "controlMap";
  eyebrow?: string;
  title?: string;
  lede?: ReactNode;
  items: readonly ControlMapItem[];
}

/** codeArtifact — one framed code sample (`<CodeBlock frame>`). Mirrors `CodeBlockProps` (minus
 *  `frame`, which `<PageSections>` always sets) so the render arm is a clean prop spread. */
export interface CodeArtifactSection {
  kind: "codeArtifact";
  code: string;
  label?: string;
  status?: ReactNode;
}

/** comparison — a `<SkuMatrix>` columns/rows table, reused as-is. */
export interface ComparisonSection {
  kind: "comparison";
  eyebrow?: string;
  title?: string;
  columns: readonly string[];
  rows: readonly SkuMatrixRow[];
}

/** faq — a native `<details>` disclosure list (`<Faq>`), optionally under a header. */
export interface FaqSection {
  kind: "faq";
  eyebrow?: string;
  title?: string;
  items: readonly FaqItem[];
  defaultOpenFirst?: boolean;
}

/** cta — the closing call to action: a title + 1-2 buttons. */
export interface CtaSection {
  kind: "cta";
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

/**
 * media — the reserved media slot (ADR-0237 F2). Ships as a deliberately-dumb placeholder — the
 * page's mark scaled large at low opacity on a `--cs-surface-2` field over a hairline grid — and
 * the ONLY contract real media must later honor is the `aspect` container (operator directive
 * 2026-07-03: no generative art system, media is produced before launch). ADR-0263: when `src` is
 * set, the renderer arm plays that pre-rendered mp4 instead of the placeholder — a self-hosted
 * `<video>`, never a `@remotion/player` runtime embed.
 */
export interface MediaSection {
  kind: "media";
  /** The mark rendered as placeholder art (decorative; aria-hidden). Ignored once `src` is set. */
  icon?: IconName;
  /** CSS aspect-ratio of the container, e.g. "16 / 9" (default). The one contract. */
  aspect?: string;
  /** A produced video under /public (ADR-0263) — e.g. "/videos/audit-worm-demo.mp4". */
  src?: string;
  /** Optional poster frame for the video (unused by the placeholder path). */
  poster?: string;
  eyebrow?: string;
  title?: string;
  lede?: ReactNode;
}

/**
 * custom — MANDATORY escape hatch (renderer SPEC §2). Every page eventually needs a hand-authored
 * artifact (a `cs-tok`-colorized Terminal, a bespoke layout) that doesn't reduce to flat data;
 * `<PageSections>` renders `node` verbatim, unflattened.
 */
export interface CustomSection {
  kind: "custom";
  node: ReactNode;
}

/**
 * The discriminated union every section variant belongs to. Keep this a flat switch target —
 * adding a `kind` here without a matching render arm in `<PageSections>` is a compile error (its
 * `never` default arm), not a silent blank (renderer SPEC §3).
 */
export type PageSection =
  | HeroSection
  | GenericSection
  | FeatureGridSection
  | ControlMapSection
  | CodeArtifactSection
  | ComparisonSection
  | FaqSection
  | CtaSection
  | MediaSection
  | CustomSection;

/** A full page: typed SEO meta + the ordered sections a data file supplies. */
export interface PageSpec {
  meta: PageMeta;
  sections: readonly PageSection[];
}
