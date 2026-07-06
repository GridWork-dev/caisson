import { describe, expect, test } from "bun:test";
import {
  clearSignupIntentCookie,
  encodeSignupIntentCookie,
  parseSignupIntentCookie,
  sanitizeSignupSource,
} from "./signup-intent";

describe("sanitizeSignupSource", () => {
  test("passes through a clean slug", () => {
    expect(sanitizeSignupSource("docs-quickstart")).toBe("docs-quickstart");
  });

  test("strips anything outside the safe charset (no cookie/property injection)", () => {
    expect(sanitizeSignupSource("docs;evil=1&x=<script>")).toBe(
      "docsevil1xscript",
    );
  });

  test("bounds length to 64 chars", () => {
    const long = "a".repeat(200);
    expect(sanitizeSignupSource(long)).toHaveLength(64);
  });

  test("undefined yields empty string", () => {
    expect(sanitizeSignupSource(undefined)).toBe("");
  });
});

describe("encode/parse round-trip", () => {
  test("round-trips a signupSource + plausibleAlreadyFired pair", () => {
    const setCookieString = encodeSignupIntentCookie("docs-quickstart", true);
    // Simulate the browser storing just the name=value pair (document.cookie strips attrs).
    const nameValue = setCookieString.split(";")[0] as string;
    expect(parseSignupIntentCookie(nameValue)).toEqual({
      signupSource: "docs-quickstart",
      plausibleAlreadyFired: true,
    });
  });

  test("round-trips an empty signupSource + false flag", () => {
    const setCookieString = encodeSignupIntentCookie(undefined, false);
    const nameValue = setCookieString.split(";")[0] as string;
    expect(parseSignupIntentCookie(nameValue)).toEqual({
      signupSource: "",
      plausibleAlreadyFired: false,
    });
  });

  test("absent cookie yields null", () => {
    expect(parseSignupIntentCookie("other_cookie=1; another=2")).toBeNull();
  });

  test("finds the cookie among siblings", () => {
    const setCookieString = encodeSignupIntentCookie("ref", true);
    const nameValue = setCookieString.split(";")[0] as string;
    expect(parseSignupIntentCookie(`a=1; ${nameValue}; b=2`)).toEqual({
      signupSource: "ref",
      plausibleAlreadyFired: true,
    });
  });
});

describe("clearSignupIntentCookie", () => {
  test("carries max-age=0 so the browser deletes it", () => {
    expect(clearSignupIntentCookie()).toContain("max-age=0");
  });
});
