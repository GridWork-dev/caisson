import { describe, expect, test } from "bun:test";
import { safeEqualFixed, safeEqualVariable } from "./crypto.ts";

describe("constant-time comparison", () => {
  test("safeEqualFixed matches equal strings and rejects others", () => {
    expect(safeEqualFixed("s3cret-token", "s3cret-token")).toBe(true);
    expect(safeEqualFixed("s3cret-token", "s3cret-toker")).toBe(false);
    // A length mismatch is rejected without throwing (the leak the floor warns about).
    expect(safeEqualFixed("short", "longer-value")).toBe(false);
  });

  test("safeEqualVariable hashes first, so length differences never throw", () => {
    expect(safeEqualVariable("<email>", "<email>")).toBe(
      true,
    );
    expect(safeEqualVariable("a", "a-very-long-different-value")).toBe(false);
  });
});
