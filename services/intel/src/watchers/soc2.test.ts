import { describe, expect, test } from "bun:test";
import { detectSoc2Change } from "./soc2.ts";

describe("detectSoc2Change", () => {
  test("first observation records a baseline, no finding", () => {
    const { findings, nextState } = detectSoc2Change("page content", {});
    expect(findings).toEqual([]);
    expect(nextState["soc2:aicpa:hash"]).toBeDefined();
  });

  test("a hash mismatch against stored state emits a finding", () => {
    const { findings } = detectSoc2Change("new content", {
      "soc2:aicpa:hash": "deadbeef",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.source).toBe("soc2");
  });

  test("an unchanged hash emits nothing", () => {
    const baseline = detectSoc2Change("stable content", {}).nextState;
    const { findings } = detectSoc2Change("stable content", baseline);
    expect(findings).toEqual([]);
  });
});
