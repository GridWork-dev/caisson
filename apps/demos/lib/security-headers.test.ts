import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { CONTENT_SECURITY_POLICY } from "./security-headers";

// This app is served at caisson.sh/demos/*, so this policy governs a document that holds
// same-origin authority over caisson.sh. These assertions exist so a loosening has to be
// deliberate: the policy is pinned whole, the two directives that carry the design are pinned
// again by name, and the header the site actually serves on /demos/* is pinned to this constant.

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

  // The static export has no server: the served header is the /demos/* block of the site's
  // _headers file, which must detach the site-wide CSP and restate exactly this one.
  test("the site's _headers serves exactly this policy on /demos/*", () => {
    const text = readFileSync(
      new URL("../../site/public/_headers", import.meta.url),
      "utf8",
    );
    const block = text.split(/\n(?=\S)/).find((b) => b.startsWith("/demos/*"));
    expect(block).toBeDefined();
    const csp = (block ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("Content-Security-Policy:"));
    expect(csp).toEqual([
      `Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`,
    ]);
    expect(block).toContain("! Content-Security-Policy");
  });
});
