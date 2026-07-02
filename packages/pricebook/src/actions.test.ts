// action-book unit tests (ADR-0089): the flat per-action credit cost + a strict boundary parser.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
import {
  ACTION_BOOK,
  BYOK_COVERED_ACTIONS,
  parseActionBook,
  resolveActionCost,
} from "./actions.ts";
import type { ActionBook, ActionTag } from "./actions.ts";

describe("action-book", () => {
  test("resolveActionCost returns the codegen run cost", () => {
    expect(resolveActionCost("codegenRunCredits")).toBe(
      ACTION_BOOK.codegenRunCredits,
    );
  });
  test("resolveActionCost defaults keySource to env (cost unchanged)", () => {
    expect(resolveActionCost("codegenRunCredits", ACTION_BOOK, "env")).toBe(
      ACTION_BOOK.codegenRunCredits,
    );
  });
  test("ADR-0182: a tenant (BYOK) keySource zeroes the debit", () => {
    expect<number>(
      resolveActionCost("codegenRunCredits", ACTION_BOOK, "tenant"),
    ).toBe(0);
  });
  test("an unknown action still throws under a tenant keySource (fail-closed)", () => {
    expect(() =>
      resolveActionCost("notARealAction" as never, ACTION_BOOK, "tenant"),
    ).toThrow(/no action-book entry/);
  });
  test("ADR-0198: a non-BYOK-covered action stays metered under a tenant key", () => {
    // Simulate a future platform action (e.g. an evidence-pack export) absent from the allowlist:
    // a tenant key must NOT zero its debit — the regression the allowlist guards against.
    const book = {
      ...ACTION_BOOK,
      evidencePackCredits: 50,
    } as unknown as ActionBook;
    const tag = "evidencePackCredits" as unknown as ActionTag;
    expect<number>(resolveActionCost(tag, book, "tenant")).toBe(50);
    expect<number>(resolveActionCost(tag, book, "env")).toBe(50);
  });
  test("BYOK_COVERED_ACTIONS is the explicit allowlist (new actions default to metered)", () => {
    expect(BYOK_COVERED_ACTIONS.has("codegenRunCredits")).toBe(true);
    expect([...BYOK_COVERED_ACTIONS]).toEqual(["codegenRunCredits"]);
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
