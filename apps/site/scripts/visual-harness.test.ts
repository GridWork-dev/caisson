import { describe, expect, test } from "bun:test";
import { MARKETING_ROUTES } from "../lib/routes.ts";
import { WRITING_PIECES } from "../lib/writing.tsx";
import { DASHBOARD_ROUTES, allRoutes, routeSlug } from "./visual-harness.ts";

describe("routeSlug", () => {
  test("root route maps to 'home'", () => {
    expect(routeSlug("/")).toBe("home");
  });

  test("a nested route flattens slashes to double-underscore", () => {
    expect(routeSlug("/marketplace/modules/field-crypto")).toBe(
      "marketplace__modules__field-crypto",
    );
  });

  test("a single-segment route strips only the leading slash", () => {
    expect(routeSlug("/login")).toBe("login");
  });

  test("a deep-linked pop-out query string flattens to filename-safe dashes", () => {
    expect(routeSlug("/marketplace?view=bundle:compliance")).toBe(
      "marketplace-view-bundle-compliance",
    );
  });
});

describe("allRoutes", () => {
  test("includes every module depth page and glossary term, with no duplicates", () => {
    const routes = allRoutes();
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toContain("/marketplace/modules/field-crypto");
    expect(routes).toContain("/glossary/worm-audit-log");
    expect(routes).toContain("/");
  });

  test("includes the compare family and the enumerated docs tree", () => {
    const routes = allRoutes();
    expect(routes.some((r) => r.startsWith("/compare/"))).toBe(true);
    expect(routes).toContain("/docs");
    expect(routes).toContain("/docs/getting-started");
  });

  // C25: the public route arrays were hand-maintained and had gone stale — these four registry
  // rows had no shot at all. Pinned by name so a regression names itself, not just "count fell".
  test("covers the four public routes the hand-written arrays had dropped", () => {
    const routes = allRoutes();
    for (const path of [
      "/writing",
      "/trust",
      "/support",
      "/frameworks/eu-ai-act/article-50",
    ]) {
      expect(routes).toContain(path);
    }
  });

  // The fifth omission: published commentary spokes. Derived from WRITING_PIECES exactly as
  // app/sitemap.ts derives them, so a new piece is shot the day it publishes.
  test("covers every published writing spoke", () => {
    const routes = allRoutes();
    expect(WRITING_PIECES.length).toBeGreaterThan(0); // never let this pass vacuously
    for (const piece of WRITING_PIECES) {
      expect(routes).toContain(`/writing/${piece.slug}`);
    }
  });

  // The guard that makes staleness structurally impossible rather than pinned case by case: any
  // row added to the canonical registry must already be covered, with no follow-up edit here.
  test("covers every canonical marketing registry row, derived not listed", () => {
    const routes = new Set(allRoutes());
    const missing = MARKETING_ROUTES.map((r) => r.path || "/").filter(
      (path) => !routes.has(path),
    );
    expect(missing).toEqual([]);
  });

  // The refuted half of C25: deriving public routes must NOT swallow the stateful surfaces, which
  // need setup (an item in the cart, a session) and therefore stay hand-written.
  test("keeps the stateful routes that have no registry row", () => {
    const routes = allRoutes();
    for (const path of [
      "/cart",
      "/login",
      "/forgot-password",
      "/reset-password",
    ]) {
      expect(routes).toContain(path);
    }
    expect(DASHBOARD_ROUTES).toContain("/dashboard");
    expect(DASHBOARD_ROUTES).toContain("/dashboard/license");
  });
});
