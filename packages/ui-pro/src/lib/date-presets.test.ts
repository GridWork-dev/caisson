import { describe, expect, test } from "bun:test";

import {
  billingCycle,
  fiscalQuarter,
  lastMonth,
  lastNDays,
  previousPeriod,
  standardPresets,
  thisMonth,
  yearToDate,
} from "./date-presets";

// Reference: 2026-07-07 (a Tuesday), UTC.
const ref = new Date("2026-07-07T12:00:00Z");

describe("recency presets", () => {
  test("thisMonth spans the whole calendar month", () => {
    expect(thisMonth(ref)).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });

  test("lastMonth handles month length (June has 30 days)", () => {
    expect(lastMonth(ref)).toEqual({ start: "2026-06-01", end: "2026-06-30" });
  });

  test("lastNDays is inclusive of the reference day", () => {
    expect(lastNDays(ref, 7)).toEqual({
      start: "2026-07-01",
      end: "2026-07-07",
    });
  });

  test("yearToDate runs Jan 1 to the reference day", () => {
    expect(yearToDate(ref)).toEqual({ start: "2026-01-01", end: "2026-07-07" });
  });
});

describe("fiscalQuarter", () => {
  test("calendar-year Q3 for July with a January fiscal start", () => {
    expect(fiscalQuarter(ref, 0, 0)).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
    });
  });

  test("previous quarter offsets back three months", () => {
    expect(fiscalQuarter(ref, 0, -1)).toEqual({
      start: "2026-04-01",
      end: "2026-06-30",
    });
  });

  test("an April (month 3) fiscal year puts July in the first fiscal quarter", () => {
    // FY starts April; July is month 4 of the FY → quarter 2 (Jul-Sep).
    expect(fiscalQuarter(ref, 3, 0)).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
    });
  });
});

describe("billingCycle", () => {
  test("anchor 15: a July 7 reference falls in the cycle that started June 15", () => {
    expect(billingCycle(ref, 15)).toEqual({
      start: "2026-06-15",
      end: "2026-07-14",
    });
  });

  test("anchor 1: the cycle is the calendar month", () => {
    expect(billingCycle(ref, 1)).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    });
  });
});

describe("previousPeriod", () => {
  test("returns the equal-length window ending the day before the range starts", () => {
    // A 7-day range (Jul 1-7) → the prior 7 days (Jun 24-30).
    expect(previousPeriod({ start: "2026-07-01", end: "2026-07-07" })).toEqual({
      start: "2026-06-24",
      end: "2026-06-30",
    });
  });
});

describe("standardPresets", () => {
  test("exposes the labelled preset row honouring fiscal + billing options", () => {
    const presets = standardPresets({
      fiscalStartMonth: 3,
      billingAnchorDay: 15,
    });
    const ids = presets.map((p) => p.id);
    expect(ids).toContain("thisQuarter");
    expect(ids).toContain("billingCycle");
    expect(presets.find((p) => p.id === "billingCycle")!.compute(ref)).toEqual({
      start: "2026-06-15",
      end: "2026-07-14",
    });
  });
});
