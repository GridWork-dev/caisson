import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import {
  type VersionRecord,
  currentVersions,
  isCurrent,
  validateVersionSet,
  versionChain,
} from "./versioning.ts";

// Two independent lineages: art-1 has v1→v2→v3 (v3 current); art-2 has a single v1 (current).
const VERSIONS: VersionRecord[] = [
  { id: "a1-v1", supersedesId: null },
  { id: "a1-v2", supersedesId: "a1-v1" },
  { id: "a1-v3", supersedesId: "a1-v2" },
  { id: "a2-v1", supersedesId: null },
];

describe("versioning", () => {
  test("current iff nothing supersedes it", () => {
    expect(isCurrent(VERSIONS, "a1-v3")).toBe(true);
    expect(isCurrent(VERSIONS, "a1-v2")).toBe(false);
    expect(isCurrent(VERSIONS, "a1-v1")).toBe(false);
    expect(isCurrent(VERSIONS, "a2-v1")).toBe(true);
  });

  test("currentVersions returns each lineage tip, input order preserved", () => {
    expect(currentVersions(VERSIONS).map((v) => v.id)).toEqual([
      "a1-v3",
      "a2-v1",
    ]);
  });

  test("versionChain returns root → tip for any member of the lineage", () => {
    expect(versionChain(VERSIONS, "a1-v2").map((v) => v.id)).toEqual([
      "a1-v1",
      "a1-v2",
      "a1-v3",
    ]);
    expect(versionChain(VERSIONS, "a2-v1").map((v) => v.id)).toEqual(["a2-v1"]);
  });

  test("a duplicate id is rejected", () => {
    expect(() =>
      validateVersionSet([
        { id: "x", supersedesId: null },
        { id: "x", supersedesId: null },
      ]),
    ).toThrow(/duplicate/);
  });

  test("a dangling supersedesId is rejected", () => {
    expect(() =>
      validateVersionSet([{ id: "x", supersedesId: "ghost" }]),
    ).toThrow(/unknown version/);
  });

  test("a fork (two versions superseding the same id) is rejected", () => {
    expect(() =>
      validateVersionSet([
        { id: "root", supersedesId: null },
        { id: "a", supersedesId: "root" },
        { id: "b", supersedesId: "root" },
      ]),
    ).toThrow(/fork/);
  });

  test("a self-supersede is rejected", () => {
    expect(() => validateVersionSet([{ id: "x", supersedesId: "x" }])).toThrow(
      /supersedes itself/,
    );
  });

  test("a rootless cycle is rejected", () => {
    expect(() =>
      validateVersionSet([
        { id: "a", supersedesId: "b" },
        { id: "b", supersedesId: "a" },
      ]),
    ).toThrow(/rootless cycle/);
  });

  test("an unknown id query throws", () => {
    expect(() => isCurrent(VERSIONS, "nope")).toThrow(/unknown version/);
    expect(() => versionChain(VERSIONS, "nope")).toThrow(/unknown version/);
  });

  test("the current set matches its golden", () => {
    matchGolden(import.meta.url, "version-chain", {
      current: currentVersions(VERSIONS).map((v) => v.id),
      a1Chain: versionChain(VERSIONS, "a1-v1").map((v) => v.id),
    });
  });
});
