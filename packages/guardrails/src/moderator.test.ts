import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
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

  test.each(["(a+)+$", "(a|aa)+$", String.raw`(a+)\1`])(
    "rejects unsafe pattern %s deterministically",
    (source) => {
      expect(() => compileBlocklist([source])).toThrow(ValidationError);
      expect(() => compileBlocklist([source])).toThrow(
        /unsafe moderator regex pattern/u,
      );
    },
  );

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
