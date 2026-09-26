import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import { acceptDeviation, isTransitionSuppressed } from "./deviation.ts";
import type { ComplianceSnapshot } from "./types.ts";
import type { ControlStatusTransition } from "./diff.ts";

const CONTROL_ID = "DATA-PROTECTION.DISPOSAL";
const COLLECTOR_ID = "substrate.worm-retention-floor";
const ACCEPTED_REASON = "contractor bucket retention short of the floor";

function flaggedSnapshot(reason = ACCEPTED_REASON): ComplianceSnapshot {
  return [
    {
      controlId: CONTROL_ID,
      collectorId: COLLECTOR_ID,
      status: "flagged",
      reason,
    },
  ];
}

function regressionTransition(
  reason = ACCEPTED_REASON,
): ControlStatusTransition {
  return {
    controlId: CONTROL_ID,
    collectorId: COLLECTOR_ID,
    from: "pass",
    to: "flagged",
    toReason: reason,
  };
}

describe("acceptDeviation", () => {
  test("derives the baseline from the current snapshot's flagged rows for the control", () => {
    const deviation = acceptDeviation({
      id: "dev-1",
      controlId: CONTROL_ID,
      reason: "contractor offboarding pending",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: flaggedSnapshot(),
    });
    expect(deviation.baseline).toEqual({ [COLLECTOR_ID]: ACCEPTED_REASON });
  });

  test("a control with no flagged evidence yields a legal, inert deviation (empty baseline)", () => {
    const passingSnapshot: ComplianceSnapshot = [
      { controlId: CONTROL_ID, collectorId: COLLECTOR_ID, status: "pass" },
    ];
    const deviation = acceptDeviation({
      id: "dev-2",
      controlId: CONTROL_ID,
      reason: "n/a",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: passingSnapshot,
    });
    expect(deviation.baseline).toEqual({});
    // An empty baseline matches nothing — it never suppresses any transition.
    expect(
      isTransitionSuppressed(
        regressionTransition(),
        deviation,
        new Date("2026-08-01T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  test("a malformed expiresAt fails closed (ValidationError)", () => {
    expect(() =>
      acceptDeviation({
        id: "dev-3",
        controlId: CONTROL_ID,
        reason: "n/a",
        acceptor: "compliance@buyer.example",
        expiresAt: "not-a-date",
        snapshot: flaggedSnapshot(),
      }),
    ).toThrow(ValidationError);
  });
});

describe("isTransitionSuppressed — accepted-deviation alert suppression", () => {
  const NOW = new Date("2026-08-01T00:00:00.000Z");

  test("suppresses a regression matching the accepted baseline, before expiry", () => {
    const deviation = acceptDeviation({
      id: "dev-1",
      controlId: CONTROL_ID,
      reason: "known contractor gap",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: flaggedSnapshot(),
    });
    expect(isTransitionSuppressed(regressionTransition(), deviation, NOW)).toBe(
      true,
    );
  });

  test("expiry re-arms the alert — no longer suppressed at/after expiresAt", () => {
    const deviation = acceptDeviation({
      id: "dev-1",
      controlId: CONTROL_ID,
      reason: "known contractor gap",
      acceptor: "compliance@buyer.example",
      expiresAt: "2026-07-01T00:00:00.000Z", // before NOW
      snapshot: flaggedSnapshot(),
    });
    expect(isTransitionSuppressed(regressionTransition(), deviation, NOW)).toBe(
      false,
    );
  });

  test("a regression past the accepted baseline (a NEW/different flagged reason) alerts despite the deviation", () => {
    const deviation = acceptDeviation({
      id: "dev-1",
      controlId: CONTROL_ID,
      reason: "known contractor gap",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: flaggedSnapshot(),
    });
    const worseTransition = regressionTransition(
      "a completely different, unaccepted gap",
    );
    expect(isTransitionSuppressed(worseTransition, deviation, NOW)).toBe(false);
  });

  test("no deviation on record never suppresses", () => {
    expect(isTransitionSuppressed(regressionTransition(), undefined, NOW)).toBe(
      false,
    );
  });

  test("a deviation for a different control never suppresses", () => {
    const deviation = acceptDeviation({
      id: "dev-1",
      controlId: "AUDIT.IMMUTABLE-LOG",
      reason: "unrelated",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: [
        {
          controlId: "AUDIT.IMMUTABLE-LOG",
          collectorId: "x",
          status: "flagged",
          reason: "y",
        },
      ],
    });
    expect(isTransitionSuppressed(regressionTransition(), deviation, NOW)).toBe(
      false,
    );
  });

  test("a transition landing back on pass is never suppressed (nothing to suppress)", () => {
    const deviation = acceptDeviation({
      id: "dev-1",
      controlId: CONTROL_ID,
      reason: "known contractor gap",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: flaggedSnapshot(),
    });
    const recovered: ControlStatusTransition = {
      controlId: CONTROL_ID,
      collectorId: COLLECTOR_ID,
      from: "flagged",
      to: "pass",
    };
    expect(isTransitionSuppressed(recovered, deviation, NOW)).toBe(false);
  });

  test("a new collector flagging under the same control (absent from the baseline) is not suppressed", () => {
    const deviation = acceptDeviation({
      id: "dev-1",
      controlId: CONTROL_ID,
      reason: "known contractor gap",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: flaggedSnapshot(),
    });
    const otherCollector: ControlStatusTransition = {
      controlId: CONTROL_ID,
      collectorId: "substrate.some-other-collector",
      from: "pass",
      to: "flagged",
      toReason: "a brand new gap",
    };
    expect(isTransitionSuppressed(otherCollector, deviation, NOW)).toBe(false);
  });
});
