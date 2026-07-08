// WR-01 (SHIP review on PR #171): the dedup window + the per-minute cap, each verified to trip AND
// to reset once its window elapses (a deterministic injected clock, no real sleep).
import { describe, expect, test } from "bun:test";
import {
  CAP_PER_MINUTE,
  DEDUP_WINDOW_MS,
  throttleEscalate,
} from "./escalate-throttle.ts";

describe("throttleEscalate", () => {
  test("suppresses a duplicate (normalized) question within the dedup window, then allows it again once the window elapses", async () => {
    const pushed: string[] = [];
    let clock = 0;
    const throttled = throttleEscalate(
      async (q) => {
        pushed.push(q);
      },
      () => clock,
    );

    await throttled("Does Compliance do HIPAA?", "no_match");
    await throttled("  does compliance do hipaa?  ", "no_match"); // same question, case/whitespace differ
    expect(pushed.length).toBe(1);

    clock += DEDUP_WINDOW_MS + 1;
    await throttled("does compliance do hipaa?", "no_match");
    expect(pushed.length).toBe(2);
  });

  test("enforces the global escalations-per-minute cap across DISTINCT questions, then resets once the window elapses", async () => {
    const pushed: string[] = [];
    let clock = 0;
    const throttled = throttleEscalate(
      async (q) => {
        pushed.push(q);
      },
      () => clock,
    );

    for (let i = 0; i < CAP_PER_MINUTE + 5; i++) {
      await throttled(`question ${i}`, "no_match");
    }
    expect(pushed.length).toBe(CAP_PER_MINUTE); // the extra 5 distinct questions were dropped

    clock += 60_000 + 1;
    await throttled("after the window resets", "no_match");
    expect(pushed.length).toBe(CAP_PER_MINUTE + 1);
  });
});
