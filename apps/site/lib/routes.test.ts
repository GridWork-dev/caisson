import { test, expect, describe } from "bun:test";

import {
  MARKETING_ROUTES,
  MARKETPLACE_TAB_ROUTES,
  EDITION_ROUTES,
  footerRoutes,
  NAV_ROUTES,
  LEGAL_ROUTES,
} from "./routes";

// The marketing route registry is the single source of truth that sitemap.ts, site-nav, and
// site-footer all derive from (kickoff Phase-2). These invariants guard that derivation against
// drift — a regression here is a silently-wrong sitemap or a missing nav/footer link.

describe("MARKETING_ROUTES registry", () => {
  test("paths are unique", () => {
    const paths = MARKETING_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("home is the empty path with top priority", () => {
    const home = MARKETING_ROUTES.find((r) => r.group === "home");
    expect(home).toBeDefined();
    expect(home?.path).toBe("");
    expect(home?.priority).toBe(1.0);
  });

  test("every non-home path is absolute (leading slash) and slug-shaped", () => {
    for (const r of MARKETING_ROUTES) {
      if (r.group === "home") continue;
      expect(r.path.startsWith("/")).toBe(true);
      expect(r.path).not.toMatch(/\s/);
    }
  });

  test("priorities are within the sitemap range and preserved per group", () => {
    for (const r of MARKETING_ROUTES) {
      expect(r.priority).toBeGreaterThan(0);
      expect(r.priority).toBeLessThanOrEqual(1.0);
    }
    // Spot-check values (marketplace routes replaced /pricing per ADR-0237 F1).
    const byPath = (p: string) => MARKETING_ROUTES.find((r) => r.path === p);
    expect(byPath("/marketplace")?.priority).toBe(0.9);
    expect(byPath("/legal/privacy")?.priority).toBe(0.4);
    expect(byPath("/frameworks/eu-ai-act")?.priority).toBe(0.75);
  });

  test("the three retired commerce paths are OUT of the registry (they 301 in next.config.ts)", () => {
    for (const gone of ["/pricing", "/modules", "/build"]) {
      expect(MARKETING_ROUTES.some((r) => r.path === gone)).toBe(false);
    }
  });

  test("every route declares a changeFrequency", () => {
    for (const r of MARKETING_ROUTES) {
      expect(typeof r.changeFrequency).toBe("string");
      expect(r.changeFrequency.length).toBeGreaterThan(0);
    }
  });
});

describe("derived route slices", () => {
  test("EDITION_ROUTES is exactly the five bundle persona pages in display order", () => {
    // The four persona pages plus the net-new Provenance persona page (catalog-rework W6.2, ADR-0257).
    // The `edition` route group is the persona-page grouping (the bundles' front doors); the name is
    // retained until W7's commerce flip renames the surface.
    expect(EDITION_ROUTES.map((r) => r.path)).toEqual([
      "/compliance",
      "/ai-kit",
      "/local-first",
      "/agentic-dev",
      "/provenance",
    ]);
  });

  test("NAV_ROUTES are the nav-flagged routes; the four core personas plus the hub are navigable", () => {
    // Provenance is a footer + hub route, not a top-nav item (it's a subset of Compliance, discovered
    // from the marketplace and the Compliance page, not a primary nav destination).
    const navPaths = NAV_ROUTES.map((r) => r.path);
    expect(navPaths).toEqual([
      "/compliance",
      "/ai-kit",
      "/local-first",
      "/agentic-dev",
      "/marketplace",
    ]);
  });

  test("MARKETPLACE_TAB_ROUTES are the unified surface + Plans (ADR-0285 folded Modules + Build)", () => {
    expect(MARKETPLACE_TAB_ROUTES.map((r) => r.path)).toEqual([
      "/marketplace",
      "/marketplace/plans",
    ]);
  });

  test("the folded Modules + Build tab paths are OUT of the registry (they 301 in next.config.ts)", () => {
    for (const gone of ["/marketplace/modules", "/marketplace/build"]) {
      expect(MARKETING_ROUTES.some((r) => r.path === gone)).toBe(false);
    }
  });

  test("/ui joins the registry (sitemap + footer) per ADR-0285", () => {
    const ui = MARKETING_ROUTES.find((r) => r.path === "/ui");
    expect(ui).toBeDefined();
    expect(ui?.footer).toBe("resources");
  });

  test("footer derivation (ADR-0237): every column non-empty, security.txt page + glossary present", () => {
    expect(footerRoutes("editions").map((r) => r.path)).toEqual(
      EDITION_ROUTES.map((r) => r.path),
    );
    expect(footerRoutes("product").map((r) => r.path)).toEqual(
      MARKETPLACE_TAB_ROUTES.map((r) => r.path),
    );
    const resources = footerRoutes("resources").map((r) => r.path);
    expect(resources).toContain("/glossary");
    expect(resources).toContain("/security");
    expect(footerRoutes("legal").map((r) => r.path)).toEqual(
      LEGAL_ROUTES.map((r) => r.path),
    );
  });

  test("local-first carries a short navLabel distinct from its full label", () => {
    const lf = MARKETING_ROUTES.find((r) => r.path === "/local-first");
    expect(lf?.label).toBe("Local-first AI");
    expect(lf?.navLabel).toBe("Local-first");
  });

  test("LEGAL_ROUTES are the four legal pages", () => {
    expect(LEGAL_ROUTES.map((r) => r.path)).toEqual([
      "/legal/privacy",
      "/legal/terms",
      "/legal/license",
      "/legal/eula",
    ]);
    expect(LEGAL_ROUTES.every((r) => r.group === "legal")).toBe(true);
  });

  test("derived slices are all subsets of the registry", () => {
    const all = new Set(MARKETING_ROUTES);
    for (const slice of [EDITION_ROUTES, NAV_ROUTES, LEGAL_ROUTES]) {
      for (const r of slice) expect(all.has(r)).toBe(true);
    }
  });
});
