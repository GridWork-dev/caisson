import type { MetadataRoute } from "next";

// Single source of truth for the marketing route surface (kickoff Phase-2: "MARKETING_ROUTES →
// sitemap 1:1"). Before this, the route list was hand-duplicated across sitemap.ts (4 inline
// arrays), site-nav (NAV_LINKS), and site-footer (COLS) — editions alone appeared in four places,
// free to drift. Now the sitemap and the footer columns derive from this one list; the primary
// nav is hand-shaped in site-nav.tsx over BUNDLE_ROUTES. Docs routes are NOT here (they come
// from Fumadocs `source.getPages()`).
//
// ADR-0237 F1: the three commerce routes (/pricing, /modules, /build) are UNIFIED into the
// /marketplace hub (tabs: Editions · Modules · Build · Plans). The old paths 301 permanently in
// next.config.ts `redirects()` — they are gone from this registry so the sitemap and footer
// only ever emit the canonical hub routes.

export type RouteGroup =
  | "home"
  | "edition"
  | "product"
  | "trust"
  | "framework"
  | "legal";

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
  /** Grouping for sitemap ordering + the derived slices below. */
  group: RouteGroup;
  /** Footer column this route renders in; omitted = not in the footer. */
  footer?: FooterCol;
}

// Order matters: it is the sitemap emission order (core → trust → framework → legal).
export const MARKETING_ROUTES: readonly MarketingRoute[] = [
  { path: "", label: "Home", priority: 1.0, changeFrequency: "weekly", group: "home" }, // prettier-ignore
  { path: "/compliance", label: "Compliance", priority: 0.9, changeFrequency: "weekly", group: "edition", footer: "editions" }, // prettier-ignore
  { path: "/ai-kit", label: "AI-Production", priority: 0.9, changeFrequency: "weekly", group: "edition", footer: "editions" }, // prettier-ignore
  { path: "/local-first", label: "Local-first AI", navLabel: "Local-first", priority: 0.9, changeFrequency: "weekly", group: "edition", footer: "editions" }, // prettier-ignore
  { path: "/agentic-dev", label: "Agentic-Dev", priority: 0.9, changeFrequency: "weekly", group: "edition", footer: "editions" }, // prettier-ignore
  { path: "/provenance", label: "Provenance", priority: 0.9, changeFrequency: "weekly", group: "edition", footer: "editions" }, // prettier-ignore
  { path: "/marketplace", label: "Marketplace", priority: 0.9, changeFrequency: "weekly", group: "product", footer: "product" }, // prettier-ignore
  { path: "/writing", label: "Writing", priority: 0.7, changeFrequency: "weekly", group: "product", footer: "resources" }, // prettier-ignore
  { path: "/ui", label: "UI Pro showcase", navLabel: "UI Pro", priority: 0.7, changeFrequency: "weekly", group: "product", footer: "resources" }, // prettier-ignore
  // Public, indexable, and until now absent from BOTH the registry and every internal link — the
  // only route on the site reachable by direct URL alone. Registry-only (no nav/footer flag) puts
  // it in the sitemap without deciding where it belongs in the nav.
  { path: "/demo", label: "Try it", priority: 0.8, changeFrequency: "weekly", group: "product" }, // prettier-ignore
  { path: "/security", label: "Security", priority: 0.75, changeFrequency: "weekly", group: "trust", footer: "resources" }, // prettier-ignore
  { path: "/evidence", label: "Evidence pack", priority: 0.8, changeFrequency: "weekly", group: "trust", footer: "resources" }, // prettier-ignore
  { path: "/updates", label: "Updates", priority: 0.7, changeFrequency: "weekly", group: "trust", footer: "resources" }, // prettier-ignore
  { path: "/trust", label: "Trust", priority: 0.75, changeFrequency: "weekly", group: "trust", footer: "resources" }, // prettier-ignore
  { path: "/support", label: "Support", priority: 0.6, changeFrequency: "weekly", group: "trust", footer: "resources" }, // prettier-ignore
  { path: "/partners", label: "Design partners", priority: 0.5, changeFrequency: "monthly", group: "product", footer: "resources" }, // prettier-ignore
  { path: "/frameworks/eu-ai-act", label: "EU AI Act", priority: 0.75, changeFrequency: "weekly", group: "framework" }, // prettier-ignore
  { path: "/frameworks/eu-ai-act/article-50", label: "EU AI Act Article 50", priority: 0.7, changeFrequency: "weekly", group: "framework" }, // prettier-ignore
  { path: "/legal/privacy", label: "Privacy policy", priority: 0.4, changeFrequency: "weekly", group: "legal", footer: "legal" }, // prettier-ignore
  { path: "/legal/terms", label: "Terms of service", priority: 0.4, changeFrequency: "weekly", group: "legal", footer: "legal" }, // prettier-ignore
];

/** The bundle persona pages, in display order — single-sourced for the nav, the footer, and the
 *  sitemap. (The `edition` group name is the legacy persona-page grouping, ADR-0257.) */
export const BUNDLE_ROUTES = MARKETING_ROUTES.filter(
  (r) => r.group === "edition",
);

/** Legal page routes (the footer appends `.well-known/security.txt`, which is not a page route). */
export const LEGAL_ROUTES = MARKETING_ROUTES.filter((r) => r.group === "legal");

/** Routes flagged for footer column `col`, in declared order (ADR-0237 footer derivation). */
export function footerRoutes(col: FooterCol): readonly MarketingRoute[] {
  return MARKETING_ROUTES.filter((r) => r.footer === col);
}
