import { describe, expect, test } from "bun:test";

import { reconcileFindings } from "./reconcile";

describe("browser audit reconciliation", () => {
  test("classifies new, unchanged, regressed, and closed findings", () => {
    const previous = [
      { id: "same", status: "open" as const, title: "Same" },
      { id: "returned", status: "closed" as const, title: "Returned" },
      { id: "gone", status: "open" as const, title: "Gone" },
    ];
    const current = [
      { id: "same", title: "Same" },
      { id: "returned", title: "Returned" },
      { id: "new", title: "New" },
    ];

    expect(reconcileFindings(previous, current).classes).toEqual({
      gone: "closed",
      new: "new",
      returned: "regressed",
      same: "unchanged",
    });
  });
});
