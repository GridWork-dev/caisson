import type { MetadataRoute } from "next";

// Single source of truth for the marketing route surface (kickoff Phase-2: "MARKETING_ROUTES →
// sitemap 1:1"). Before this, the route list was hand-duplicated across sitemap.ts (4 inline
// arrays), site-nav (NAV_LINKS), and site-footer (COLS) — editions alone appeared in four places,
// free to drift. Now sitemap, the primary nav, and the footer's editions/legal columns all derive
// from this one list. Docs routes are NOT here (they come from Fumadocs `source.getPages()`).

export type RouteGroup =
  "home" | "edition" | "product" | "trust" | "framework" | "legal";

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
  /** Grouping for nav/footer derivation + sitemap ordering. */
  group: RouteGroup;
  /** Appears in the primary desktop/mobile nav. */
  nav?: boolean;
}

// Order matters: it is the sitemap emission order (core → trust → framework → legal), preserved 1:1
// from the original sitemap.ts so the generated sitemap.xml stays byte-identical.
export const MARKETING_ROUTES: readonly MarketingRoute[] = [
  { path: "", label: "Home", priority: 1.0, changeFrequency: "weekly", group: "home" }, // prettier-ignore
  { path: "/compliance", label: "Compliance", priority: 0.9, changeFrequency: "weekly", group: "edition", nav: true }, // prettier-ignore
  { path: "/ai-kit", label: "AI Production Kit", priority: 0.9, changeFrequency: "weekly", group: "edition", nav: true }, // prettier-ignore
  { path: "/local-first", label: "Local-first AI", navLabel: "Local-first", priority: 0.9, changeFrequency: "weekly", group: "edition", nav: true }, // prettier-ignore
  { path: "/agentic-dev", label: "Agentic-Dev", priority: 0.9, changeFrequency: "weekly", group: "edition", nav: true }, // prettier-ignore
  { path: "/pricing", label: "Pricing", priority: 0.85, changeFrequency: "weekly", group: "product", nav: true }, // prettier-ignore
  { path: "/security", label: "Security", priority: 0.75, changeFrequency: "weekly", group: "trust" }, // prettier-ignore
  { path: "/changelog", label: "Changelog", priority: 0.7, changeFrequency: "weekly", group: "trust" }, // prettier-ignore
  { path: "/procurement", label: "Security & procurement", priority: 0.7, changeFrequency: "weekly", group: "trust" }, // prettier-ignore
  { path: "/frameworks/eu-ai-act", label: "EU AI Act", priority: 0.75, changeFrequency: "weekly", group: "framework" }, // prettier-ignore
  { path: "/legal/privacy", label: "Privacy policy", priority: 0.4, changeFrequency: "weekly", group: "legal" }, // prettier-ignore
  { path: "/legal/terms", label: "Terms of service", priority: 0.4, changeFrequency: "weekly", group: "legal" }, // prettier-ignore
  { path: "/legal/license", label: "License", priority: 0.4, changeFrequency: "weekly", group: "legal" }, // prettier-ignore
  { path: "/legal/eula", label: "EULA", priority: 0.4, changeFrequency: "weekly", group: "legal" }, // prettier-ignore
];

/** The editions, in display order — single-sourced for the nav, the footer, and the sitemap. */
export const EDITION_ROUTES = MARKETING_ROUTES.filter(
  (r) => r.group === "edition",
);

/** Marketing routes that appear in the primary nav (in declared order). */
export const NAV_ROUTES = MARKETING_ROUTES.filter((r) => r.nav);

/** Legal page routes (the footer appends `.well-known/security.txt`, which is not a page route). */
export const LEGAL_ROUTES = MARKETING_ROUTES.filter((r) => r.group === "legal");
