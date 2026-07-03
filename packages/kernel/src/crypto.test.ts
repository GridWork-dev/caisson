import { describe, expect, test } from "bun:test";
import { AuthnError } from "./errors.ts";
import {
  safeEqualFixed,
  safeEqualVariable,
  verifyAllowlisted,
  verifyBearer,
} from "./crypto.ts";

describe("constant-time comparison", () => {
  test("safeEqualFixed matches equal strings and rejects others", () => {
    expect(safeEqualFixed("s3cret-token", "s3cret-token")).toBe(true);
    expect(safeEqualFixed("s3cret-token", "s3cret-toker")).toBe(false);
    // A length mismatch is rejected without throwing (the leak the floor warns about).
    expect(safeEqualFixed("short", "longer-value")).toBe(false);
  });

  test("safeEqualVariable hashes first, so length differences never throw", () => {
    expect(safeEqualVariable("admin@gridwork.dev", "admin@gridwork.dev")).toBe(
      true,
    );
    expect(safeEqualVariable("a", "a-very-long-different-value")).toBe(false);
  });
});

describe("verifyAllowlisted", () => {
  const allow = ["owner@caisson.sh", "admin@gridwork.dev", "ops@caisson.sh"];

  test("matches an entry after the default trim+lowercase normalize", () => {
    expect(verifyAllowlisted("  Admin@GridWork.dev ", allow)).toBe(true);
  });

  test("rejects a non-member", () => {
    expect(verifyAllowlisted("attacker@evil.test", allow)).toBe(false);
  });

  test("matches an entry anywhere in the list, not just index 0", () => {
    // The last entry — proves the scan does not stop early and covers the whole allowlist.
    expect(verifyAllowlisted("ops@caisson.sh", allow)).toBe(true);
  });

  test("an empty allowlist is fail-closed (never authorizes)", () => {
    expect(verifyAllowlisted("owner@caisson.sh", [])).toBe(false);
  });

  test("honors a custom normalize (case-sensitive opaque ids)", () => {
    const ids = ["TOK_abc", "TOK_def"];
    const identity = (s: string) => s;
    expect(verifyAllowlisted("TOK_def", ids, identity)).toBe(true);
    expect(verifyAllowlisted("tok_def", ids, identity)).toBe(false);
  });

  test("compares every entry — no early return, iteration count is constant regardless of match position", () => {
    // `normalize` is called once for the candidate plus once per allowlist entry inside the loop,
    // so a counting `normalize` stands in for a call-count spy on the internal `safeEqualVariable`
    // compare (which isn't independently interceptable — it's a same-module lexical call, not a
    // call through the exported binding). Equal counts whether the match lands first, last, or
    // never proves the scan never `break`s/returns early on a hit.
    const list = ["a@x.com", "b@x.com", "c@x.com", "d@x.com"];
    const countingNormalize = () => {
      let calls = 0;
      return {
        fn: (s: string) => {
          calls++;
          return s.trim().toLowerCase();
        },
        get calls() {
          return calls;
        },
      };
    };
    const expectedCalls = list.length + 1;

    const matchFirst = countingNormalize();
    expect(verifyAllowlisted("a@x.com", list, matchFirst.fn)).toBe(true);
    expect(matchFirst.calls).toBe(expectedCalls);

    const matchLast = countingNormalize();
    expect(verifyAllowlisted("d@x.com", list, matchLast.fn)).toBe(true);
    expect(matchLast.calls).toBe(expectedCalls);

    const noMatch = countingNormalize();
    expect(verifyAllowlisted("z@x.com", list, noMatch.fn)).toBe(false);
    expect(noMatch.calls).toBe(expectedCalls);
  });
});

describe("verifyBearer", () => {
  const secret = "cron-secret-token-32-chars-abcdef";

  test("a correct Bearer token passes (no throw)", () => {
    expect(() => verifyBearer(`Bearer ${secret}`, secret)).not.toThrow();
  });

  test("a missing header throws AuthnError", () => {
    expect(() => verifyBearer(null, secret)).toThrow(AuthnError);
    expect(() => verifyBearer(undefined, secret)).toThrow(AuthnError);
    expect(() => verifyBearer("", secret)).toThrow(AuthnError);
  });

  test("a wrong scheme throws AuthnError", () => {
    expect(() => verifyBearer(`Basic ${secret}`, secret)).toThrow(AuthnError);
    // Case-sensitive scheme: the raw token with no "Bearer " prefix is refused too.
    expect(() => verifyBearer(secret, secret)).toThrow(AuthnError);
  });

  test("an empty token after the scheme throws AuthnError", () => {
    expect(() => verifyBearer("Bearer ", secret)).toThrow(AuthnError);
  });

  test("a mismatched token throws AuthnError", () => {
    expect(() => verifyBearer(`Bearer ${secret}-wrong`, secret)).toThrow(
      AuthnError,
    );
  });

  test("a blank expected secret always throws — fail closed, never authorizes", () => {
    // Even a syntactically valid-looking header must be refused when no secret is configured.
    expect(() => verifyBearer("Bearer anything", "")).toThrow(AuthnError);
  });

  test("the thrown message never echoes the token", () => {
    const token = "super-secret-do-not-leak-0000000";
    try {
      verifyBearer(`Bearer ${token}`, secret);
      throw new Error("expected verifyBearer to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthnError);
      expect((err as AuthnError).message).not.toContain(token);
    }
  });
});
