import { describe, expect, test } from "bun:test";

import { contentSecurityPolicy, demosOriginUrl } from "./security-headers";

// The policy exactly as apps/site served it before the ADR-0400 split, with `frame-src 'self'`
// added — the one directive change the same-origin embed required. Written out in full, not
// derived, so this test can actually catch a drift in the builder rather than restate it.
const POLICY_NONE =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; " +
  "img-src 'self' data: https://*.paddle.com; font-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://*.paddle.com; " +
  "script-src 'self' 'unsafe-inline' https://plausible.io https://cdn.paddle.com https://challenges.cloudflare.com https://us-assets.i.posthog.com; " +
  "frame-src 'self' https://*.paddle.com https://challenges.cloudflare.com; " +
  "connect-src 'self' https://plausible.io https://*.paddle.com https://challenges.cloudflare.com https://us.i.posthog.com https://us-assets.i.posthog.com";

describe("contentSecurityPolicy", () => {
  test("the site's own policy is the pre-split policy plus frame-src 'self'", () => {
    expect(contentSecurityPolicy("'none'")).toBe(POLICY_NONE);
  });

  test("frame-ancestors is the ONLY thing the demo zone's policy changes", () => {
    // The whole reason the builder exists: the /demos header rule restates the entire policy
    // (a later Next header rule replaces a key, it does not merge into it), so any directive that
    // differed between the two would be a silent, invisible relaxation of the demo zone.
    expect(contentSecurityPolicy("'self'")).toBe(
      POLICY_NONE.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
    );
  });

  test("frame-src allows the same-origin embed — without it the site blocks its own iframe", () => {
    // frame-src does not fall back to default-src when present, so 'self' here is load-bearing,
    // not decorative. Asserted on the directive rather than the whole string so the reason
    // survives a future directive edit elsewhere in the policy.
    const frameSrc = contentSecurityPolicy("'none'")
      .split("; ")
      .find((d) => d.startsWith("frame-src "));
    expect(frameSrc).toContain("'self'");
  });

  test("no cross-origin frame parent is ever permitted", () => {
    // 'self' on frame-ancestors means "the document's own origin" — proxied through this app that
    // is caisson.sh, and hit directly on Railway it is the Railway host. Neither policy may ever
    // grow a wildcard or a third-party origin here.
    for (const value of ["'none'", "'self'"]) {
      const ancestors = contentSecurityPolicy(value)
        .split("; ")
        .find((d) => d.startsWith("frame-ancestors "));
      expect(ancestors).toBe(`frame-ancestors ${value}`);
    }
  });
});

describe("demosOriginUrl", () => {
  test("unset, empty, or whitespace is the fail-safe state — no rewrite, no throw", () => {
    expect(demosOriginUrl(undefined)).toBeNull();
    expect(demosOriginUrl("")).toBeNull();
    expect(demosOriginUrl("   ")).toBeNull();
  });

  test("accepts the Railway private-network target (plain http, non-default port)", () => {
    expect(demosOriginUrl("http://caisson-demos.railway.internal:3040")).toBe(
      "http://caisson-demos.railway.internal:3040",
    );
  });

  test("accepts a public https origin and strips trailing slashes", () => {
    expect(demosOriginUrl("https://demos.example.com/")).toBe(
      "https://demos.example.com",
    );
    expect(demosOriginUrl("https://demos.example.com///")).toBe(
      "https://demos.example.com",
    );
  });

  // The realistic operator error: Railway's dashboard shows a service URL with a trailing path,
  // and pasting it verbatim would compose `…/demos` + `/demos/:path*` into a destination where
  // every embed 404s while the variable looks correctly armed. Normalizing to the origin is what
  // makes that paste work instead of failing silently.
  test("keeps only the origin — path, query, fragment, and credentials are dropped", () => {
    expect(demosOriginUrl("https://demos.example.com/demos")).toBe(
      "https://demos.example.com",
    );
    expect(demosOriginUrl("https://demos.example.com/x?a=b#c")).toBe(
      "https://demos.example.com",
    );
    expect(demosOriginUrl("http://user:pass@demos.example.com:3040")).toBe(
      "http://demos.example.com:3040",
    );
  });

  test("a non-network scheme is refused, not silently proxied to", () => {
    expect(() => demosOriginUrl("javascript:alert(1)")).toThrow(
      /must be an http\(s\) URL/,
    );
    expect(() => demosOriginUrl("file:///etc/passwd")).toThrow(
      /must be an http\(s\) URL/,
    );
    expect(() => demosOriginUrl("data:text/html,x")).toThrow(
      /must be an http\(s\) URL/,
    );
  });

  test("a typo throws instead of degrading to the fail-safe state", () => {
    // The distinction this test exists for: unset means "not armed yet", garbage means "armed
    // wrong". Collapsing the second into the first is how an armed rewrite silently serves the
    // pre-flip fallback with nothing to point at.
    expect(() => demosOriginUrl("not a url at all")).toThrow(/not a valid URL/);
    expect(() => demosOriginUrl("/demos")).toThrow(/not a valid URL/);
    // A dropped scheme parses as a URL whose SCHEME is the hostname (a scheme may contain dots),
    // so it fails the protocol check rather than the parse — still a throw, never a silent
    // fallback, which is the property that matters.
    expect(() => demosOriginUrl("caisson-demos.railway.internal:3040")).toThrow(
      /must be an http\(s\) URL/,
    );
  });
});
