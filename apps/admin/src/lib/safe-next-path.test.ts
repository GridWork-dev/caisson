import { describe, expect, test } from "bun:test";
import { safeNextPath } from "./safe-next-path.ts";

describe("safeNextPath", () => {
  test("undefined → root", () => {
    expect(safeNextPath(undefined)).toBe("/");
  });

  test("a plain root-relative path passes through", () => {
    expect(safeNextPath("/business")).toBe("/business");
  });

  test("a protocol-relative //evil.example is rejected", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
  });

  test("an absolute URL is rejected", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
  });

  test("a backslash-leading path is rejected (browser //-normalization side door)", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("\\/evil.example")).toBe("/");
  });

  test("a backslash anywhere in an otherwise valid path is rejected", () => {
    expect(safeNextPath("/business\\evil")).toBe("/");
  });
});
