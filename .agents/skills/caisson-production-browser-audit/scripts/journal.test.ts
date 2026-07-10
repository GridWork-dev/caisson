import { describe, expect, test } from "bun:test";

import { createJournal, transitionMutation } from "./journal";

describe("mutation journal", () => {
  test("permits only planned through verified in order", () => {
    let journal = createJournal("run-1", "buyer");
    journal = transitionMutation(journal, "mutation-1", "applied");
    journal = transitionMutation(journal, "mutation-1", "observed");
    journal = transitionMutation(journal, "mutation-1", "reverted");
    journal = transitionMutation(journal, "mutation-1", "verified");

    expect(journal.entries[0]?.state).toBe("verified");
    expect(journal.mutationLock).toBe(false);
  });

  test("rejects skipped transitions and concurrent mutations", () => {
    const journal = createJournal("run-1", "buyer");
    expect(() => transitionMutation(journal, "mutation-1", "observed")).toThrow(
      "transition",
    );
    const applied = transitionMutation(journal, "mutation-1", "applied");
    expect(() => transitionMutation(applied, "mutation-2", "applied")).toThrow(
      "unresolved",
    );
  });

  test("cleanup failure creates a P0 lock", () => {
    let journal = createJournal("run-1", "buyer");
    journal = transitionMutation(journal, "mutation-1", "applied");
    journal = transitionMutation(journal, "mutation-1", "observed");
    journal = transitionMutation(journal, "mutation-1", "reverted", {
      cleanupVerified: false,
    });

    expect(journal.mutationLock).toBe(true);
    expect(journal.blockingFinding?.severity).toBe("P0");
  });
});
