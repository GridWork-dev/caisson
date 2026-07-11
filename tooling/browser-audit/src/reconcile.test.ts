import { describe, expect, test } from "bun:test";

import { reconcileFindings, stageCandidateTest } from "./reconcile";

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

  test("stages markdown only after operator acceptance and replay", () => {
    expect(() =>
      stageCandidateTest({
        findingId: "finding-1",
        operatorAccepted: false,
        cleanReplay: true,
        fixture: "probe account",
        setup: "sign in",
        action: "cancel dialog",
        assertion: "focus returns",
        selectors: ["data-testid=cancel"],
        cleanup: "sign out",
        destinationSuite: "apps/site/live/buyer-dashboard-flow.live.test.ts",
      }),
    ).toThrow("operator-approved");
  });
});
