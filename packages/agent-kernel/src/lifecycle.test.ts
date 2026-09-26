import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  ACTS,
  CANONICAL_LIFECYCLE,
  canTransition,
  isTerminal,
  runLifecycle,
  transition,
} from "./lifecycle.ts";

describe("lifecycle FSM", () => {
  test("the canonical path is the 7 acts and traces 6 transitions", () => {
    expect(CANONICAL_LIFECYCLE).toEqual([...ACTS]);
    const trace = runLifecycle(CANONICAL_LIFECYCLE);
    expect(trace).toHaveLength(6);
    expect(trace[0]).toEqual({ seq: 0, from: "spec", to: "plan" });
    expect(trace.at(-1)).toEqual({ seq: 5, from: "eval", to: "ship" });
  });

  test("the documented branch edges are legal", () => {
    expect(transition("verify", "plan")).toBe("plan"); // failed verify → re-plan
    expect(transition("sweep", "ship")).toBe("ship"); // untagged → skip eval
    expect(canTransition("sweep", "eval")).toBe(true);
  });

  test("an illegal transition throws (flag-never-guess), never a silent skip", () => {
    expect(() => transition("spec", "execute")).toThrow(ValidationError); // skips PLAN
    expect(() => transition("ship", "spec")).toThrow(ValidationError); // terminal
    expect(() => transition("execute", "ship")).toThrow(ValidationError);
    expect(canTransition("spec", "execute")).toBe(false);
  });

  test("runLifecycle throws on the first illegal pair in a sequence", () => {
    expect(() => runLifecycle(["spec", "plan", "ship"])).toThrow(
      ValidationError,
    );
  });

  test("a 0- or 1-element sequence yields an empty trace", () => {
    expect(runLifecycle([])).toEqual([]);
    expect(runLifecycle(["spec"])).toEqual([]);
  });

  test("only `ship` is terminal", () => {
    expect(isTerminal("ship")).toBe(true);
    for (const act of ACTS.filter((a) => a !== "ship")) {
      expect(isTerminal(act)).toBe(false);
    }
  });
});
