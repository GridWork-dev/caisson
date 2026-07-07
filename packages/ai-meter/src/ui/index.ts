// @caisson/ai-meter/ui — optional embeddable frontend surface (ADR-0250 G2c). Imported ONLY via the
// `./ui` subpath; the package root never re-exports this tree, so importing `@caisson/ai-meter`
// pulls no React. Composes the `@caisson/ui` floor.
export { UsageChart, aggregateByModel } from "./usage-chart.tsx";
export type {
  UsageChartProps,
  UsageEventDatum,
  ModelUsage,
} from "./usage-chart.tsx";
