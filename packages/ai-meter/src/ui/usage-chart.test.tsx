import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { UsageChart, aggregateByModel } from "./usage-chart.tsx";
import type { UsageEventDatum } from "./usage-chart.tsx";

const events: UsageEventDatum[] = [
  {
    model: "gpt-x",
    inputTokens: 100,
    outputTokens: 50,
    costMicroUsd: 30_000,
    credits: 3,
  },
  {
    model: "gpt-x",
    inputTokens: 200,
    outputTokens: 10,
    costMicroUsd: 20_000,
    credits: 2,
  },
  {
    model: "claude-y",
    inputTokens: 400,
    outputTokens: 80,
    costMicroUsd: 90_000,
    credits: 9,
  },
];

describe("aggregateByModel — pure fold, credits-descending", () => {
  test("folds per model and sorts by credits spent", () => {
    const rolled = aggregateByModel(events);
    expect(rolled.map((m) => m.model)).toEqual(["claude-y", "gpt-x"]);
    const gptx = rolled.find((m) => m.model === "gpt-x")!;
    expect(gptx.calls).toBe(2);
    expect(gptx.credits).toBe(5);
    expect(gptx.inputTokens).toBe(300);
    expect(gptx.costMicroUsd).toBe(50_000);
  });
  test("empty input folds to no rows", () => {
    expect(aggregateByModel([])).toEqual([]);
  });
});

describe("UsageChart — SSR render (ADR-0250)", () => {
  test("renders totals, bars, and the per-model table", () => {
    const html = renderToStaticMarkup(<UsageChart events={events} />);
    expect(html).toContain("Credits spent");
    expect(html).toContain("claude-y"); // top model bar + row
    expect(html).toContain("gpt-x");
    expect(html).toContain("credits"); // bar aria-label + MoneyCell
  });

  test("empty usage renders the empty state", () => {
    const html = renderToStaticMarkup(<UsageChart events={[]} />);
    expect(html).toContain("No usage recorded");
  });
});
