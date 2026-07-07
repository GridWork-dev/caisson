import { describe, expect, test } from "bun:test";
import { dedupKey, parseFinding } from "./finding.ts";
import type { Finding } from "./finding.ts";

describe("dedupKey", () => {
  test("normalizes parts to lowercase and joins them with the source by ':'", () => {
    expect(dedupKey("compliance", "OSCAL", "v1.2.0")).toBe(
      "compliance:oscal:v1-2-0",
    );
  });

  test("collapses runs of non-alphanumeric characters", () => {
    expect(dedupKey("github", "my--repo!!", "42")).toBe("github:my-repo:42");
  });

  test("falls back to the bare source when every part is empty after normalization", () => {
    expect(dedupKey("analytics", "", "!!!")).toBe("analytics");
  });
});

describe("parseFinding", () => {
  const base: Finding = {
    source: "github",
    kind: "traction",
    severity: "info",
    title: "repo gained stars",
    body: "some detail",
    dedupKey: "github:repo:100",
    payload: {},
  };

  test("accepts a well-formed finding", () => {
    expect(parseFinding(base)).toEqual(base);
  });

  test("rejects an unknown source at the strict boundary", () => {
    // @ts-expect-error - deliberately invalid source to exercise the strict Zod boundary
    expect(() => parseFinding({ ...base, source: "not-a-source" })).toThrow();
  });

  test("rejects an empty title", () => {
    expect(() => parseFinding({ ...base, title: "" })).toThrow();
  });
});
