import { describe, expect, test } from "bun:test";
import { buildRollupFinding, dateStamp, parsePlausible } from "./analytics.ts";
import { parseRollup } from "../posthog.ts";

describe("dateStamp", () => {
  test("formats as UTC YYYY-MM-DD", () => {
    expect(dateStamp(Date.UTC(2026, 6, 7, 23, 59))).toBe("2026-07-07");
  });
});

describe("parsePlausible", () => {
  test("reads visitors/pageviews off the aggregate response shape", () => {
    const raw = {
      results: { visitors: { value: 42 }, pageviews: { value: 100 } },
    };
    expect(parsePlausible(raw)).toEqual({ visitors: 42, pageviews: 100 });
  });

  test("defaults to zero on a missing/malformed response", () => {
    expect(parsePlausible({})).toEqual({ visitors: 0, pageviews: 0 });
  });
});

describe("buildRollupFinding", () => {
  const now = Date.UTC(2026, 6, 7);

  test("dedup key is keyed on the date, not the counts", () => {
    const a = buildRollupFinding(now, { events: 100, users: 10 }, null);
    const b = buildRollupFinding(now, { events: 200, users: 20 }, null);
    expect(a.dedupKey).toBe(b.dedupKey);
  });

  test("body reports absent sources honestly when both are unreachable", () => {
    const finding = buildRollupFinding(now, null, null);
    expect(finding.body).toContain("No analytics sources");
  });

  test("body includes both sources when both are present", () => {
    const finding = buildRollupFinding(
      now,
      { events: 5, users: 2 },
      { visitors: 3, pageviews: 9 },
    );
    expect(finding.body).toContain("PostHog");
    expect(finding.body).toContain("Plausible");
  });
});

describe("parseRollup (re-exported from posthog.ts, exercised via the analytics path)", () => {
  test("maps a HogQL results row to events/users", () => {
    expect(parseRollup({ results: [[7, 3]] })).toEqual({ events: 7, users: 3 });
  });

  test("defaults to zero on an empty results set", () => {
    expect(parseRollup({ results: [] })).toEqual({ events: 0, users: 0 });
  });
});
