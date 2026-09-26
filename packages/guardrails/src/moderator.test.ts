import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import { compileBlocklist, localModerator } from "./moderator.ts";

describe("configurable moderator regex safety", () => {
  test("accepts the shipped sample-style alternations", () => {
    expect(
      compileBlocklist([
        "ignore (all|previous) instructions",
        "reveal (your|the) system prompt",
      ]),
    ).toHaveLength(2);
  });

  test.each([
    "(a+)+$",
    "(a|aa)+$",
    String.raw`(a+)\1`,
    // One nesting level must not hide the alternation from the quantified group's check.
    "((a|a))+$",
    "(?:(a|ab))+c",
    "(((a|a)))+$",
    // Repeated unbounded WIDE atoms backtrack like `.*.*` — classes and \w-style escapes count.
    "[a-z]*[a-z]*x",
    String.raw`\w*\s*\w*\s*x`,
    ".*secret.*",
    // Open-ended repetition is unbounded, so a second one busts the same budget.
    String.raw`\d{2,}\s{2,}x`,
    // Bounded repetition over the ceiling, on either side.
    "a{5000,}",
    "a{0,5000}",
  ])("rejects unsafe pattern %s deterministically", (source) => {
    expect(() => compileBlocklist([source])).toThrow(ValidationError);
    expect(() => compileBlocklist([source])).toThrow(
      /unsafe moderator regex pattern/u,
    );
  });

  test("open-ended repetition is allowed like + and budgeted, not banned", () => {
    // `x{n,}` is exactly `x{n}x*` — strictly narrower than the already-permitted `x*`.
    expect(
      compileBlocklist([String.raw`account number \d{6,}`, "a{2,5}"]),
    ).toHaveLength(2);
  });

  test("a group quantified to repeat at most once is safe", () => {
    // `?`/`{0,1}` cannot multiply backtracking paths; `*`/`+`/`{0,n>1}` on the same group stays
    // rejected.
    expect(
      compileBlocklist([
        "ignore (?:all|previous)? instructions",
        "(foo|bar){0,1}baz",
      ]),
    ).toHaveLength(2);
    expect(() => compileBlocklist(["(?:a|b)*c"])).toThrow(
      /unsafe moderator regex pattern/u,
    );
    expect(() => compileBlocklist(["(?:a|aa){0,50}"])).toThrow(
      /unsafe moderator regex pattern/u,
    );
  });

  test("bounds pattern source and input text before regex work", () => {
    expect(() => compileBlocklist(["a".repeat(501)])).toThrow(
      /moderator regex pattern exceeds 500 code units/u,
    );
    const moderator = localModerator(["safe"]);
    expect(() => moderator.moderate("x".repeat(100_001))).toThrow(
      /text exceeds 100000 code units/u,
    );
  });
});
