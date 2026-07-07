import { describe, expect, test } from "bun:test";
import {
  isAllowedGithubId,
  parseAllowedGithubIds,
} from "./admin-auth-config.ts";

describe("parseAllowedGithubIds", () => {
  test("undefined env → empty set (fail-closed)", () => {
    expect(parseAllowedGithubIds(undefined)).toEqual(new Set());
  });

  test("blank env → empty set (fail-closed)", () => {
    expect(parseAllowedGithubIds("")).toEqual(new Set());
    expect(parseAllowedGithubIds("   ")).toEqual(new Set());
  });

  test("a single numeric id", () => {
    expect(parseAllowedGithubIds("123456")).toEqual(new Set(["123456"]));
  });

  test("multiple ids, comma-separated with whitespace", () => {
    expect(parseAllowedGithubIds(" 111 , 222,333 ")).toEqual(
      new Set(["111", "222", "333"]),
    );
  });

  test("non-numeric entries are dropped, not fatal", () => {
    expect(parseAllowedGithubIds("111,gridwork-dev,222")).toEqual(
      new Set(["111", "222"]),
    );
  });

  test("a lone bad entry never poisons the whole allowlist", () => {
    expect(parseAllowedGithubIds("111,,222")).toEqual(new Set(["111", "222"]));
  });
});

describe("isAllowedGithubId", () => {
  test("id present in a non-empty allowlist → allowed", () => {
    expect(isAllowedGithubId("123456", new Set(["123456"]))).toBe(true);
  });

  test("id absent from a non-empty allowlist → denied", () => {
    expect(isAllowedGithubId("999999", new Set(["123456"]))).toBe(false);
  });

  test("EMPTY allowlist denies even a well-formed id (missing-env fail-closed)", () => {
    expect(isAllowedGithubId("123456", new Set())).toBe(false);
  });

  test("isAllowedGithubId itself does not re-validate numeric shape — the parser owns that guarantee", () => {
    expect(isAllowedGithubId("gridwork-dev", new Set(["gridwork-dev"]))).toBe(
      // parseAllowedGithubIds would never have produced this entry — this documents that the
      // numeric-only guarantee lives in the parser, not here; a caller MUST feed this function a
      // parser-produced Set, never a raw hand-built one.
      true,
    );
  });
});
