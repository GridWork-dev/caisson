import { test, expect, describe } from "bun:test";

import {
  MARKETING_ROUTES,
  EDITION_ROUTES,
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
    // Spot-check the values the original hand-authored sitemap shipped.
    const byPath = (p: string) => MARKETING_ROUTES.find((r) => r.path === p);
    expect(byPath("/pricing")?.priority).toBe(0.85);
    expect(byPath("/legal/privacy")?.priority).toBe(0.4);
    expect(byPath("/frameworks/eu-ai-act")?.priority).toBe(0.75);
  });

  test("every route declares a changeFrequency", () => {
    for (const r of MARKETING_ROUTES) {
      expect(typeof r.changeFrequency).toBe("string");
      expect(r.changeFrequency.length).toBeGreaterThan(0);
    }
  });
});

describe("derived route slices", () => {
  test("EDITION_ROUTES is exactly the four editions in display order", () => {
    expect(EDITION_ROUTES.map((r) => r.path)).toEqual([
      "/compliance",
      "/ai-kit",
      "/local-first",
      "/agentic-dev",
    ]);
  });

  test("NAV_ROUTES are the nav-flagged routes; agentic-dev is intentionally excluded", () => {
    const navPaths = NAV_ROUTES.map((r) => r.path);
    expect(navPaths).toEqual([
      "/compliance",
      "/ai-kit",
      "/local-first",
      "/pricing",
    ]);
    expect(navPaths).not.toContain("/agentic-dev");
  });

  test("local-first carries a short navLabel distinct from its full label", () => {
    const lf = MARKETING_ROUTES.find((r) => r.path === "/local-first");
    expect(lf?.label).toBe("Local-first AI");
    expect(lf?.navLabel).toBe("Local-first");
  });

  test("LEGAL_ROUTES are the three legal pages", () => {
    expect(LEGAL_ROUTES.map((r) => r.path)).toEqual([
      "/legal/privacy",
      "/legal/terms",
      "/legal/license",
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
