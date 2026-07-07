import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AreaChart, BarChart, LineChart, Sparkline } from "./charts";

describe("Charts", () => {
  test("LineChart renders an accessible svg with a titled path", () => {
    const html = renderToStaticMarkup(
      <LineChart
        data={[4, 9, 2, 7]}
        title="Weekly signups"
        description="last 4 weeks"
      />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Weekly signups"');
    expect(html).toContain("<title>Weekly signups</title>");
    expect(html).toContain("<desc>last 4 weeks</desc>");
    expect(html).toContain("cs-chart__line");
    expect(html).toContain("<path");
  });

  test("AreaChart draws a filled area plus the line", () => {
    const html = renderToStaticMarkup(
      <AreaChart data={[1, 3, 2]} title="Usage" />,
    );
    expect(html).toContain("cs-chart__area");
    expect(html).toContain("cs-chart__line");
  });

  test("BarChart renders one bar per datum with axis ticks", () => {
    const html = renderToStaticMarkup(
      <BarChart
        data={[10, 20, 30]}
        labels={["a", "b", "c"]}
        title="By region"
      />,
    );
    expect(html).toContain("cs-chart__bar");
    expect(html).toContain("cs-chart__tick");
  });

  test("Sparkline renders a compact titled line, no axes", () => {
    const html = renderToStaticMarkup(
      <Sparkline data={[1, 2, 1, 3, 2]} title="Trend" />,
    );
    expect(html).toContain("cs-sparkline");
    expect(html).toContain("<title>Trend</title>");
    expect(html).not.toContain("cs-chart__tick");
  });
});
