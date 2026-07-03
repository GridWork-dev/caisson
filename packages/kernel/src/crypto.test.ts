import { describe, expect, test } from "bun:test";
import {
  safeEqualFixed,
  safeEqualVariable,
  verifyAllowlisted,
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
});
