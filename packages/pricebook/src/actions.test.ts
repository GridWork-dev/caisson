// action-book unit tests (ADR-0089): the flat per-action credit cost + a strict boundary parser.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
import { ACTION_BOOK, parseActionBook, resolveActionCost } from "./actions.ts";

describe("action-book", () => {
  test("resolveActionCost returns the codegen run cost", () => {
    expect(resolveActionCost("codegenRunCredits")).toBe(
      ACTION_BOOK.codegenRunCredits,
    );
  });
  test("parseActionBook rejects a non-integer cost", () => {
    expect(() => parseActionBook({ codegenRunCredits: 1.5 })).toThrow(
      ValidationError,
    );
  });
  test("parseActionBook rejects an unknown key (strict)", () => {
    expect(() => parseActionBook({ codegenRunCredits: 100, extra: 1 })).toThrow(
      ValidationError,
    );
  });
});
