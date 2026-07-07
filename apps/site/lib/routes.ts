import type { MetadataRoute } from "next";

// Single source of truth for the marketing route surface (kickoff Phase-2: "MARKETING_ROUTES →
// sitemap 1:1"). Before this, the route list was hand-duplicated across sitemap.ts (4 inline
// arrays), site-nav (NAV_LINKS), and site-footer (COLS) — editions alone appeared in four places,
// free to drift. Now sitemap, the primary nav, and the footer columns all derive from this one
// list. Docs routes are NOT here (they come from Fumadocs `source.getPages()`).
//
// ADR-0237 F1: the three commerce routes (/pricing, /modules, /build) are UNIFIED into the
// /marketplace hub (tabs: Editions · Modules · Build · Plans). The old paths 301 permanently in
// next.config.ts `redirects()` — they are gone from this registry so the sitemap, nav, and footer
// only ever emit the canonical hub routes.

export type RouteGroup =
  "home" | "edition" | "product" | "trust" | "framework" | "legal";

/** Footer column a route renders in (ADR-0237: footer derives from this registry). */
export type FooterCol = "editions" | "product" | "resources" | "legal";

type ChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]["changeFrequency"]
>;

export interface MarketingRoute {
  /** Path relative to origin; `""` is the home page. */
  path: string;
  /** Canonical label — used in the footer and as the default nav label. */
  label: string;
  /** Shorter label for the space-constrained primary nav, when it differs from `label`. */
  navLabel?: string;
  /** sitemap priority (preserved verbatim from the original hand-authored sitemap). */
  priority: number;
  /** sitemap changeFrequency. */
  changeFrequency: ChangeFrequency;
  /** Grouping for nav derivation + sitemap ordering. */
  group: RouteGroup;
  /** Appears in the primary desktop/mobile nav. */
  nav?: boolean;
  /** Footer column this route renders in; omitted = not in the footer. */
  footer?: FooterCol;
}

// Order matters: it is the sitemap emission order (core → trust → framework → legal).
export const MARKETING_ROUTES: readonly MarketingRoute[] = [
  { path: "", label: "Home", priority: 1.0, changeFrequency: "weekly", group: "home" }, // prettier-ignore
  { path: "/compliance", label: "Compliance", priority: 0.9, changeFrequency: "weekly", group: "edition", nav: true, footer: "editions" }, // prettier-ignore
  { path: "/ai-kit", label: "AI-Production", priority: 0.9, changeFrequency: "weekly", group: "edition", nav: true, footer: "editions" }, // prettier-ignore
  { path: "/local-first", label: "Local-first AI", navLabel: "Local-first", priority: 0.9, changeFrequency: "weekly", group: "edition", nav: true, footer: "editions" }, // prettier-ignore
  { path: "/agentic-dev", label: "Agentic-Dev", priority: 0.9, changeFrequency: "weekly", group: "edition", nav: true, footer: "editions" }, // prettier-ignore
  { path: "/provenance", label: "Provenance", priority: 0.9, changeFrequency: "weekly", group: "edition", footer: "editions" }, // prettier-ignore
  { path: "/marketplace", label: "Marketplace", priority: 0.9, changeFrequency: "weekly", group: "product", nav: true, footer: "product" }, // prettier-ignore
  { path: "/marketplace/modules", label: "Modules", priority: 0.85, changeFrequency: "weekly", group: "product", footer: "product" }, // prettier-ignore
  { path: "/marketplace/build", label: "Build your stack", priority: 0.8, changeFrequency: "weekly", group: "product", footer: "product" }, // prettier-ignore
  { path: "/marketplace/plans", label: "Plans", priority: 0.85, changeFrequency: "weekly", group: "product", footer: "product" }, // prettier-ignore
  { path: "/glossary", label: "Glossary", priority: 0.7, changeFrequency: "weekly", group: "product", footer: "resources" }, // prettier-ignore
  { path: "/compare", label: "Comparisons", priority: 0.75, changeFrequency: "weekly", group: "product", footer: "resources" }, // prettier-ignore
  { path: "/build-vs-buy", label: "Build vs buy", priority: 0.75, changeFrequency: "weekly", group: "product" }, // prettier-ignore
  { path: "/security", label: "Security", priority: 0.75, changeFrequency: "weekly", group: "trust", footer: "resources" }, // prettier-ignore
  { path: "/updates", label: "Updates", priority: 0.7, changeFrequency: "weekly", group: "trust", footer: "resources" }, // prettier-ignore
  { path: "/procurement", label: "Security & procurement", priority: 0.7, changeFrequency: "weekly", group: "trust", footer: "resources" }, // prettier-ignore
  { path: "/affiliates", label: "Affiliates", priority: 0.5, changeFrequency: "monthly", group: "product", footer: "resources" }, // prettier-ignore
  { path: "/frameworks/eu-ai-act", label: "EU AI Act", priority: 0.75, changeFrequency: "weekly", group: "framework" }, // prettier-ignore
  { path: "/legal/privacy", label: "Privacy policy", priority: 0.4, changeFrequency: "weekly", group: "legal", footer: "legal" }, // prettier-ignore
  { path: "/legal/terms", label: "Terms of service", priority: 0.4, changeFrequency: "weekly", group: "legal", footer: "legal" }, // prettier-ignore
  { path: "/legal/license", label: "License", priority: 0.4, changeFrequency: "weekly", group: "legal", footer: "legal" }, // prettier-ignore
  { path: "/legal/eula", label: "EULA", priority: 0.4, changeFrequency: "weekly", group: "legal", footer: "legal" }, // prettier-ignore
];

/** The editions, in display order — single-sourced for the nav, the footer, and the sitemap. */
export const EDITION_ROUTES = MARKETING_ROUTES.filter(
  (r) => r.group === "edition",
);

/** Marketing routes that appear in the primary nav (in declared order). */
export const NAV_ROUTES = MARKETING_ROUTES.filter((r) => r.nav);

/** Legal page routes (the footer appends `.well-known/security.txt`, which is not a page route). */
export const LEGAL_ROUTES = MARKETING_ROUTES.filter((r) => r.group === "legal");

/** Routes flagged for footer column `col`, in declared order (ADR-0237 footer derivation). */
export function footerRoutes(col: FooterCol): readonly MarketingRoute[] {
  return MARKETING_ROUTES.filter((r) => r.footer === col);
}

/** The `/marketplace` hub tabs, in display order (ADR-0237 F1). Derived, not re-declared. */
export const MARKETPLACE_TAB_ROUTES = MARKETING_ROUTES.filter(
  (r) => r.path === "/marketplace" || r.path.startsWith("/marketplace/"),
);
