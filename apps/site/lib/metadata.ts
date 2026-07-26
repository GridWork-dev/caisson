// buildMetadata() — one helper for every page's title/description/canonical/OG/twitter
// (ADR-0079 §4). Closes the identical-OG bug, the missing self-referencing canonicals, and the
// absent Twitter card in one mechanical call. The root layout owns metadataBase + the title
// template; pages call this for their per-page metadata.
import type { Metadata } from "next";

export const SITE_URL = "https://caisson.sh";
export const SITE_NAME = "Caisson";
// Mirrors the root layout's title.default — used for OG/twitter on the home page, which omits a
// per-page title so the root <title> default inherits (setting title:undefined would suppress it).
export const DEFAULT_TITLE =
  "Caisson — Compliance-grade infrastructure for regulated SaaS";
const DEFAULT_OG = "/opengraph-image";

export interface PageMeta {
  /** Page <title> (the root template appends " · Caisson"). Omit on the home page. */
  title?: string;
  /** Meta description — 1–2 sentences, keyword in the first clause. */
  description: string;
  /** Absolute path from the site root, e.g. "/compliance". "/" for home. */
  path: string;
  /** OG image path; defaults to the root satori card. Per-edition pages pass their own. */
  ogImage?: string;
  /** OG type. */
  type?: "website" | "article";
  /** Real publication date for article metadata. Omit for undated reference pages. */
  publishedOn?: string;
}

/** Self-referencing canonical + OG + twitter summary_large_image from one args object. */
export function buildMetadata({
  title,
  description,
  path,
  ogImage = DEFAULT_OG,
  type = "website",
  publishedOn,
}: PageMeta): Metadata {
  const canonical = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  const ogTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  const meta: Metadata = {
    description,
    alternates: { canonical },
    openGraph: {
      type,
      siteName: SITE_NAME,
      url: canonical,
      title: ogTitle,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogTitle }],
      ...(type === "article" && publishedOn !== undefined
        ? { publishedTime: publishedOn }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImage],
    },
  };
  // Only set title when provided — omitting the key lets the root layout's title.default inherit
  // (the home page relies on this); setting title:undefined would blank the <title> instead.
  if (title) meta.title = title;
  return meta;
}
