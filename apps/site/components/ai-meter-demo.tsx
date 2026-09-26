"use client";

// The ai-meter module's `component` media slide (ADR-0308 full-depth) — the module's own shipped
// surface `@caisson-sh/ai-meter/ui` <UsageChart>, rendered live over sample metered-usage events. The
// component owns the aggregation (a pure reduce), the per-model bar chart, and the credit/cost
// rollup; credits + cost stay integer units end to end (ADR-0007). Presentational still-frame.
// Loaded via next/dynamic (ssr: false) so this commercial-tier tree never lands in the shared
// client bundle. Source: packages/ai-meter/src/ui/usage-chart.tsx.
import { UsageChart, type UsageEventDatum } from "@caisson-sh/ai-meter/ui";

import { MediaFrame } from "./media-frame";

// costMicroUsd is integer micro-USD; the sample keeps a clean 1 credit ≈ 1 cent mapping so the
// rollup reads plausibly (the component's `microUsdToCents` renders it via MoneyCell).
const EVENTS: readonly UsageEventDatum[] = [
  {
    model: "claude-opus-4",
    inputTokens: 18240,
    outputTokens: 4120,
    costMicroUsd: 2_140_000,
    credits: 214,
  },
  {
    model: "claude-opus-4",
    inputTokens: 9310,
    outputTokens: 2010,
    cachedInputTokens: 3200,
    costMicroUsd: 960_000,
    credits: 96,
  },
  {
    model: "gpt-5",
    inputTokens: 33110,
    outputTokens: 8300,
    costMicroUsd: 4_020_000,
    credits: 402,
  },
  {
    model: "gemini-2.5-pro",
    inputTokens: 5120,
    outputTokens: 1440,
    costMicroUsd: 610_000,
    credits: 61,
  },
];

export default function AiMeterDemo() {
  return (
    <MediaFrame label="Metered usage">
      <div style={{ padding: "var(--cs-space-6)" }}>
        <UsageChart events={EVENTS} />
      </div>
    </MediaFrame>
  );
}
