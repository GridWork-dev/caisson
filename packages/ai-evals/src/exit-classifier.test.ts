// Exit classifier tests (ADR-0208). One fixture per taxonomy class, plus priority ties — the chain
// order (error → timeout → budget-exhausted → refusal → empty-output → success → unknown) is the
// load-bearing behavior.
import { describe, expect, test } from "bun:test";
import {
  classifyExit,
  EXIT_CLASSES,
  exitSignalSchema,
} from "./exit-classifier.ts";

describe("classifyExit: one fixture per class", () => {
  test("error", () => {
    expect(classifyExit({ errored: true })).toBe("error");
  });

  test("timeout", () => {
    expect(classifyExit({ timedOut: true })).toBe("timeout");
  });

  test("budget-exhausted", () => {
    expect(classifyExit({ budgetExhausted: true })).toBe("budget-exhausted");
  });

  test("refusal (case-insensitive substring match)", () => {
    expect(
      classifyExit({
        output: "I'm sorry, I CANNOT help with that request.",
        refusalMarkers: ["i cannot help"],
      }),
    ).toBe("refusal");
  });

  test("empty-output", () => {
    expect(classifyExit({ output: "" })).toBe("empty-output");
  });

  test("success", () => {
    expect(classifyExit({ output: "here is the answer" })).toBe("success");
  });

  test("unknown: no output and no other signal", () => {
    expect(classifyExit({})).toBe("unknown");
  });
});

describe("classifyExit: priority ties", () => {
  test("errored wins over timedOut", () => {
    expect(classifyExit({ errored: true, timedOut: true })).toBe("error");
  });

  test("timedOut wins over budgetExhausted", () => {
    expect(classifyExit({ timedOut: true, budgetExhausted: true })).toBe(
      "timeout",
    );
  });

  test("budgetExhausted wins over a matching refusal marker", () => {
    expect(
      classifyExit({
        budgetExhausted: true,
        output: "I cannot help with that",
        refusalMarkers: ["cannot help"],
      }),
    ).toBe("budget-exhausted");
  });

  test("a refusal match wins over empty-output/success (output is non-empty)", () => {
    expect(
      classifyExit({
        output: "As an AI, I must decline this request.",
        refusalMarkers: ["must decline"],
      }),
    ).toBe("refusal");
  });

  test("no marker match on non-empty output falls through to success", () => {
    expect(
      classifyExit({ output: "a normal answer", refusalMarkers: ["decline"] }),
    ).toBe("success");
  });
});

describe("exitSignalSchema boundary", () => {
  test("rejects an unknown field (.strict)", () => {
    expect(() =>
      exitSignalSchema.parse({ output: "x", sneaky: true }),
    ).toThrow();
  });

  test("accepts an empty signal", () => {
    expect(() => exitSignalSchema.parse({})).not.toThrow();
  });
});

test("EXIT_CLASSES has exactly the 7 taxonomy members", () => {
  expect(EXIT_CLASSES).toHaveLength(7);
  expect(new Set(EXIT_CLASSES).size).toBe(7);
});
