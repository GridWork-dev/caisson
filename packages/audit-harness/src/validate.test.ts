import { describe, expect, test } from "bun:test";

import { withId, type Finding } from "./findings.ts";
import {
  majorityKills,
  validateHighRisk,
  type Challenger,
  type ChallengeVerdict,
} from "./validate.ts";

const finding: Finding = withId({
  domain: "packages/auth",
  dimension: "D1",
  subject: "packages/auth/src/session.ts",
  title: "Session token compared with ===",
  severity: "high",
});

describe("majorityKills — truth table (ADR-0134 §4)", () => {
  test("both passes explicitly not-refuted → survives (killed = false)", () => {
    expect(majorityKills([{ refuted: false }, { refuted: false }])).toBe(false);
  });

  test("one pass refuted, one not → killed = true", () => {
    expect(majorityKills([{ refuted: true }, { refuted: false }])).toBe(true);
  });

  test("both passes refuted → killed = true", () => {
    expect(majorityKills([{ refuted: true }, { refuted: true }])).toBe(true);
  });

  test("a tie (one null, one not-refuted) defaults to killed = true", () => {
    expect(majorityKills([null, { refuted: false }])).toBe(true);
  });

  test("both missing (null) → killed = true", () => {
    expect(majorityKills([null, null])).toBe(true);
  });
});

function challengerReturning(verdict: ChallengeVerdict | null): Challenger {
  return { challenge: async () => verdict };
}

describe("validateHighRisk — two independent passes, never throws", () => {
  test("both passes not-refuted → survives", async () => {
    await expect(
      validateHighRisk(finding, challengerReturning({ refuted: false })),
    ).resolves.toBe(true);
  });

  test("both passes refuted → does not survive", async () => {
    await expect(
      validateHighRisk(finding, challengerReturning({ refuted: true })),
    ).resolves.toBe(false);
  });

  test("a null verdict (challenger declines) defaults to killed", async () => {
    await expect(
      validateHighRisk(finding, challengerReturning(null)),
    ).resolves.toBe(false);
  });

  test("a throwing challenger is caught, treated as a missing verdict, never propagates", async () => {
    const throwing: Challenger = {
      challenge: async () => {
        throw new Error("PAL unreachable");
      },
    };
    await expect(validateHighRisk(finding, throwing)).resolves.toBe(false);
  });

  test("calls the challenger exactly twice (two independent passes)", async () => {
    let calls = 0;
    const counting: Challenger = {
      challenge: async () => {
        calls += 1;
        return { refuted: false };
      },
    };
    await validateHighRisk(finding, counting);
    expect(calls).toBe(2);
  });
});
