import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { CONTENT_SECURITY_POLICY } from "./security-headers";

// public/_headers is what the static site actually serves; the /security page renders the
// CONTENT_SECURITY_POLICY constant. These tests pin the two together and pin the floor
// (identity/security.md: HSTS, nosniff, X-Frame-Options DENY) on every path.

/** Parse a Cloudflare `_headers` file into path → ordered [name, value] lines (`!` = detach). */
function parseHeaders(text: string): Map<string, [string, string][]> {
  const blocks = new Map<string, [string, string][]>();
  let current: [string, string][] | undefined;
  for (const raw of text.split("\n")) {
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      current = [];
      blocks.set(raw.trim(), current);
      continue;
    }
    const line = raw.trim();
    if (line.startsWith("! ")) current?.push([line.slice(2), "!"]);
    else {
      const colon = line.indexOf(":");
      current?.push([line.slice(0, colon), line.slice(colon + 1).trim()]);
    }
  }
  return blocks;
}

const HEADERS = parseHeaders(
  readFileSync(new URL("../public/_headers", import.meta.url), "utf8"),
);
const site = new Map(HEADERS.get("/*") ?? []);

describe("public/_headers", () => {
  test("the /* block exists and is not vacuous", () => {
    expect(site.size).toBeGreaterThanOrEqual(6);
  });

  test("serves the security floor on every path", () => {
    expect(site.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(site.get("X-Content-Type-Options")).toBe("nosniff");
    expect(site.get("X-Frame-Options")).toBe("DENY");
  });

  test("the served CSP is exactly the one the /security page renders", () => {
    expect(site.get("Content-Security-Policy")).toBe(CONTENT_SECURITY_POLICY);
  });

  test("no retired third party survives in the CSP", () => {
    for (const origin of ["paddle", "challenges.cloudflare.com", "posthog"]) {
      expect(CONTENT_SECURITY_POLICY).not.toContain(origin);
    }
  });

  test("the /demos/* override detaches before it re-sets (no comma-joined DENY, SAMEORIGIN)", () => {
    const demos = HEADERS.get("/demos/*") ?? [];
    for (const name of ["X-Frame-Options", "Content-Security-Policy"]) {
      const idx = demos.findIndex(([n, v]) => n === name && v === "!");
      const set = demos.findIndex(([n, v]) => n === name && v !== "!");
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(set).toBeGreaterThan(idx);
    }
  });

  test("/* precedes /demos/* (rules apply in file order; reversed, /* would append DENY back)", () => {
    const order = [...HEADERS.keys()];
    expect(order.indexOf("/*")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("/demos/*")).toBeGreaterThan(order.indexOf("/*"));
  });

  test("extensionless exports name their Content-Type", () => {
    const expected: [string, string][] = [
      ["/opengraph-image*", "image/png"],
      ["/:section/opengraph-image*", "image/png"],
      ["/apple-icon*", "image/png"],
      ["/api/search", "application/json"],
    ];
    for (const [path, type] of expected) {
      expect(HEADERS.get(path)).toEqual([["Content-Type", type]]);
    }
  });
});
