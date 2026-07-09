import { describe, expect, test } from "bun:test";
import { allRoutes, routeSlug } from "./visual-harness.ts";

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
});
