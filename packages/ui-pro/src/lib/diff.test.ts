import { describe, expect, test } from "bun:test";

import { DEFAULT_REDACT_KEYS } from "./redact";
import { diffJson, diffLines } from "./diff";

describe("diffLines", () => {
  test("marks same / add / remove with source line numbers", () => {
    const out = diffLines("a\nb\nc", "a\nB\nc\nd");
    expect(out).toEqual([
      { op: "same", text: "a", beforeLine: 1, afterLine: 1 },
      { op: "remove", text: "b", beforeLine: 2 },
      { op: "add", text: "B", afterLine: 2 },
      { op: "same", text: "c", beforeLine: 3, afterLine: 3 },
      { op: "add", text: "d", afterLine: 4 },
    ]);
  });

  test("identical text is all 'same'", () => {
    const out = diffLines("x\ny", "x\ny");
    expect(out.every((l) => l.op === "same")).toBe(true);
  });
});

describe("diffJson", () => {
  test("reports added, removed, and changed leaves by path", () => {
    const before = { name: "acme", seats: 10, region: "us" };
    const after = { name: "acme", seats: 12, tier: "pro" };
    const changes = diffJson(before, after);
    expect(changes).toContainEqual({
      path: "$.seats",
      kind: "changed",
      before: 10,
      after: 12,
    });
    expect(changes).toContainEqual({
      path: "$.region",
      kind: "removed",
      before: "us",
    });
    expect(changes).toContainEqual({
      path: "$.tier",
      kind: "added",
      after: "pro",
    });
  });

  test("walks nested objects and arrays by path", () => {
    const changes = diffJson(
      { user: { roles: ["admin"] } },
      { user: { roles: ["admin", "billing"] } },
    );
    expect(changes).toEqual([
      { path: "$.user.roles[1]", kind: "added", after: "billing" },
    ]);
  });

  test("no change yields an empty diff", () => {
    expect(diffJson({ a: 1 }, { a: 1 })).toEqual([]);
  });

  test("redacts secret keys in both panes so a changed secret does not leak", () => {
    const before = { apiKey: "sk-OLD", note: "one" };
    const after = { apiKey: "sk-NEW", note: "two" };
    const changes = diffJson(before, after, DEFAULT_REDACT_KEYS);
    // apiKey masks to the same sentinel on both sides -> no leaked change.
    expect(changes.find((c) => c.path === "$.apiKey")).toBeUndefined();
    // A non-secret key still diffs with real values.
    expect(changes).toContainEqual({
      path: "$.note",
      kind: "changed",
      before: "one",
      after: "two",
    });
  });
});
