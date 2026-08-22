import { describe, expect, test } from "bun:test";

import { manifestFixture } from "./test-fixture.ts";

const subject = await import("./select-services.ts").catch(() => undefined);

describe("selectServiceKeys", () => {
  test("selects only services whose reviewed paths changed", () => {
    expect(subject?.selectServiceKeys).toBeFunction();
    if (!subject) return;

    expect(
      subject.selectServiceKeys(manifestFixture, [
        "services/docs/src/app.ts",
        "README.md",
      ]),
    ).toEqual(["caisson-docs"]);
    expect(
      subject.selectServiceKeys(manifestFixture, [
        "packages/kernel/src/fetch.ts",
      ]),
    ).toEqual(["caisson-demos", "caisson-docs", "caisson-site"]);
    expect(subject.selectServiceKeys(manifestFixture, ["README.md"])).toEqual(
      [],
    );
  });

  test("an explicit service bypasses path selection but remains allowlisted", () => {
    expect(subject?.selectServiceKeys).toBeFunction();
    if (!subject) return;

    expect(
      subject.selectServiceKeys(manifestFixture, [], "caisson-demos"),
    ).toEqual(["caisson-demos"]);
    expect(() =>
      subject.selectServiceKeys(manifestFixture, [], "not-owned"),
    ).toThrow("unknown service not-owned");
  });

  test("an absent before revision selects every service", () => {
    expect(subject?.selectServiceKeys).toBeFunction();
    if (!subject) return;

    expect(subject.selectServiceKeys(manifestFixture, null)).toEqual([
      "caisson-demos",
      "caisson-docs",
      "caisson-site",
    ]);
    expect(subject.parseBefore("0".repeat(40))).toBeNull();
    expect(() => subject.parseBefore("main")).toThrow(
      "full lowercase Git commit SHA",
    );
  });
});
