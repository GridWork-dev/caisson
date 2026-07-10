import { describe, expect, test } from "bun:test";

import { finalizeBundle } from "./finalize";

describe("audit bundle finalization", () => {
  test("produces the required advisory artifact set", () => {
    const bundle = finalizeBundle({
      runId: "run-1",
      findings: [],
      journal: {
        runId: "run-1",
        ring: "buyer",
        mutationLock: false,
        entries: [],
      },
      forks: [],
      previousFindings: [],
    });

    expect(Object.keys(bundle).sort()).toEqual([
      "REPORT.md",
      "findings.json",
      "forks.md",
      "mutation-journal.json",
    ]);
    expect(bundle["REPORT.md"]).toContain("Advisory");
    expect(bundle["findings.json"]).toContain('"advisory": true');
  });
});
