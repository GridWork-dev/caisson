import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DateRangePicker } from "./date-range-picker";

const value = { start: "2026-07-01", end: "2026-07-07" };

describe("DateRangePicker (initial render)", () => {
  test("renders labelled native date inputs, presets, and a timezone label", () => {
    const html = renderToStaticMarkup(
      <DateRangePicker
        value={value}
        onChange={() => {}}
        timeZone="America/New_York"
        referenceDate={new Date("2026-07-07T12:00:00Z")}
      />,
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Date range"');
    expect(html).toContain('type="date"');
    expect(html).toContain('aria-label="Start date"');
    expect(html).toContain('aria-label="End date"');
    expect(html).toContain('value="2026-07-01"');
    expect(html).toContain("This quarter");
    expect(html).toContain("Billing cycle");
    expect(html).toContain("America/New_York");
  });

  test("comparison inputs appear only when enabled with a comparison value", () => {
    const withComparison = renderToStaticMarkup(
      <DateRangePicker
        value={value}
        onChange={() => {}}
        enableComparison
        comparison={{ start: "2026-06-24", end: "2026-06-30" }}
        onComparisonChange={() => {}}
      />,
    );
    expect(withComparison).toContain("Compare to another period");
    expect(withComparison).toContain('aria-label="Comparison start date"');

    const off = renderToStaticMarkup(
      <DateRangePicker value={value} onChange={() => {}} />,
    );
    expect(off).not.toContain("Compare to another period");
  });
});
