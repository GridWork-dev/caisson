import { describe, expect, test } from "bun:test";

import { CONTENT_SECURITY_POLICY } from "./security-headers";

// This app is proxied at caisson.sh/demos/* and Next does not apply the proxying app's headers to
// a rewritten response, so this policy is the only CSP governing a document that holds same-origin
// authority over caisson.sh. These assertions exist so a loosening has to be deliberate: the
// policy is pinned whole, and the two directives that carry the design are pinned again by name.

const directives = new Map(
  CONTENT_SECURITY_POLICY.split("; ").map((d) => {
    const space = d.indexOf(" ");
    return space === -1
      ? ([d, ""] as const)
      : ([d.slice(0, space), d.slice(space + 1)] as const);
  }),
);

describe("apps/demos CSP (ADR-0400)", () => {
  test("is pinned whole", () => {
    expect(CONTENT_SECURITY_POLICY).toBe(
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
    );
  });

  // 'none' would block the site's own module page from framing the embed — the app's entire job.
  // Anything wider would let a third-party page frame a document that can read caisson.sh.
  test("frame-ancestors is exactly 'self'", () => {
    expect(directives.get("frame-ancestors")).toBe("'self'");
  });

  // "Runs entirely in your browser. Nothing leaves this page." — the copy every poke prints.
  test("connect-src is exactly 'self' — no egress origin", () => {
    expect(directives.get("connect-src")).toBe("'self'");
  });

  // The pokes run on in-page sample data; nothing here should ever need a remote script, a remote
  // style, a remote font, or a remote frame. Catching a new origin is the point of the whole file.
  test("no directive admits a remote origin", () => {
    expect(CONTENT_SECURITY_POLICY).not.toContain("http");
    expect(CONTENT_SECURITY_POLICY).not.toContain("*");
  });

  // Guard the guard: a parser bug that produced an empty map would pass every lookup above.
  test("the directive parse is not vacuous", () => {
    expect(directives.size).toBe(10);
    expect(directives.get("default-src")).toBe("'self'");
  });
});
