// @caisson-sh/ai-meter/ui — the metered-usage chart (ADR-0250 G2c/G2d). A headless-data-in
// surface: it renders `usage_event` rows the host queried (no DB, no meter call). Aggregates by
// model (a pure reduce) into credit / cost / token totals, then draws a token-scaled bar chart +
// a per-model table. Credits/cost stay INTEGER units end to end (ADR-0007); the only float is the
// display string MoneyCell produces. Composes the `@caisson-sh/ui` floor; presentational + SSR-safe.
import type { CSSProperties } from "react";
import {
  DataTable,
  EmptyState,
  MetricStat,
  MoneyCell,
  Section,
} from "@caisson-sh/ui/components";
import type { DataTableColumn } from "@caisson-sh/ui/components";

const MONO: CSSProperties = { fontFamily: "var(--cs-font-mono)" };
const STACK: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--cs-space-6)",
};
const ROW: CSSProperties = {
  display: "grid",
  gap: "var(--cs-space-4)",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
};
const BARS: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--cs-space-3)",
};
const BAR_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(120px, 1fr) 3fr auto",
  alignItems: "center",
  gap: "var(--cs-space-3)",
  fontSize: "var(--cs-text-sm)",
};
const BAR_TRACK: CSSProperties = {
  height: "var(--cs-space-3)",
  background: "var(--cs-surface-2)",
  borderRadius: "var(--cs-radius-pill)",
  overflow: "hidden",
};

/** One metered-inference actual — a `usage_event` row in display shape (camelCase, integer units). */
export interface UsageEventDatum {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  costMicroUsd: number;
  credits: number;
}

/** Per-model rollup — the pure aggregation the chart + table both render. */
export interface ModelUsage {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  credits: number;
  costMicroUsd: number;
}

/** Fold usage events into per-model totals, sorted by credits spent (descending). Deterministic. */
export function aggregateByModel(
  events: readonly UsageEventDatum[],
): ModelUsage[] {
  const byModel = new Map<string, ModelUsage>();
  for (const e of events) {
    const cur = byModel.get(e.model) ?? {
      model: e.model,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      credits: 0,
      costMicroUsd: 0,
    };
    cur.calls += 1;
    cur.inputTokens += e.inputTokens;
    cur.outputTokens += e.outputTokens;
    cur.cachedInputTokens += e.cachedInputTokens ?? 0;
    cur.credits += e.credits;
    cur.costMicroUsd += e.costMicroUsd;
    byModel.set(e.model, cur);
  }
  return [...byModel.values()].sort(
    (a, b) => b.credits - a.credits || a.model.localeCompare(b.model),
  );
}

/** Integer micro-USD → integer USD cents for MoneyCell (display-only; the ledger stays micro-USD). */
const microUsdToCents = (micro: number): number => Math.round(micro / 10_000);

export interface UsageChartProps {
  /** The metered usage events to chart (any window the host selected). */
  events: readonly UsageEventDatum[];
  loading?: boolean;
  className?: string;
}

/**
 * UsageChart — total credits / cost / calls headline, a per-model credit bar chart, and the
 * per-model numeric table. Bars scale to the top-spending model so relative burn is legible.
 */
export function UsageChart({ events, loading, className }: UsageChartProps) {
  const models = aggregateByModel(events);
  const totalCredits = models.reduce((s, m) => s + m.credits, 0);
  const totalCostMicro = models.reduce((s, m) => s + m.costMicroUsd, 0);
  const totalCalls = models.reduce((s, m) => s + m.calls, 0);
  const totalTokens = models.reduce(
    (s, m) => s + m.inputTokens + m.outputTokens + m.cachedInputTokens,
    0,
  );
  const maxCredits = models.reduce((m, x) => Math.max(m, x.credits), 0);

  const columns: readonly DataTableColumn<ModelUsage>[] = [
    {
      key: "model",
      header: "Model",
      sortable: true,
      sortValue: (m) => m.model,
      render: (m) => <code style={MONO}>{m.model}</code>,
    },
    {
      key: "calls",
      header: "Calls",
      numeric: true,
      sortable: true,
      sortValue: (m) => m.calls,
      render: (m) => m.calls,
    },
    {
      key: "inputTokens",
      header: "Input tok",
      numeric: true,
      sortable: true,
      sortValue: (m) => m.inputTokens,
      render: (m) => m.inputTokens.toLocaleString("en-US"),
    },
    {
      key: "outputTokens",
      header: "Output tok",
      numeric: true,
      sortable: true,
      sortValue: (m) => m.outputTokens,
      render: (m) => m.outputTokens.toLocaleString("en-US"),
    },
    {
      key: "credits",
      header: "Credits",
      numeric: true,
      sortable: true,
      sortValue: (m) => m.credits,
      render: (m) => <MoneyCell value={m.credits} unit="credits" />,
    },
    {
      key: "cost",
      header: "Cost",
      numeric: true,
      sortable: true,
      sortValue: (m) => m.costMicroUsd,
      render: (m) => (
        <MoneyCell value={microUsdToCents(m.costMicroUsd)} unit="usd-cents" />
      ),
    },
  ];

  return (
    <div className={className}>
      <Section eyebrow="Metered usage" title="Inference spend">
        <div style={STACK}>
          <div style={ROW}>
            <MetricStat
              label="Credits spent"
              value={<MoneyCell value={totalCredits} unit="credits" />}
            />
            <MetricStat
              label="Provider cost"
              value={
                <MoneyCell
                  value={microUsdToCents(totalCostMicro)}
                  unit="usd-cents"
                />
              }
            />
            <MetricStat label="Calls" value={totalCalls} />
            <MetricStat
              label="Tokens"
              value={totalTokens.toLocaleString("en-US")}
            />
          </div>
          {models.length > 0 ? (
            <div style={BARS}>
              {models.map((m) => (
                <div key={m.model} style={BAR_ROW}>
                  <code style={MONO} title={m.model}>
                    {m.model}
                  </code>
                  <div
                    style={BAR_TRACK}
                    role="img"
                    aria-label={`${m.model}: ${m.credits} credits`}
                  >
                    <div
                      style={{
                        height: "100%",
                        width:
                          maxCredits === 0
                            ? "0%"
                            : `${(m.credits / maxCredits) * 100}%`,
                        background: "var(--cs-accent)",
                      }}
                    />
                  </div>
                  <MoneyCell value={m.credits} unit="credits" />
                </div>
              ))}
            </div>
          ) : null}
          <DataTable
            columns={columns}
            rows={models}
            rowKey={(m) => m.model}
            dense
            loading={loading === true}
            empty={
              <EmptyState
                title="No usage recorded"
                description="Metered inference calls will appear here once the gateway records them."
              />
            }
          />
        </div>
      </Section>
    </div>
  );
}
