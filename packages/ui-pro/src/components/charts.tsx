import type { ReactNode } from "react";

import {
  areaPath,
  extent,
  linearScale,
  linePath,
  niceTicks,
  type Point,
} from "../lib/charts.ts";

import "./charts.css";

// A dependency-free SVG chart pack (line · area · bar · sparkline). Pure presentational — no state,
// no client hooks — so it renders in a server component or a client island alike. Colours come from
// the floor token contract (default `--cs-accent`), so light/dark theming is automatic. Each chart
// is `role="img"` with an SVG `<title>`/`<desc>`, giving assistive tech the name + summary a bare
// `<svg>` lacks. Scale + path math lives in `../lib/charts` (the unit-tested part).

const PAD = { top: 8, right: 10, bottom: 22, left: 40 } as const;

export interface CartesianChartProps {
  /** The series values (y), plotted against their index (x). */
  data: readonly number[];
  /** Optional x-axis tick labels, aligned to `data` by index. */
  labels?: readonly string[];
  width?: number;
  height?: number;
  /** Accessible name (SVG `<title>`). */
  title: string;
  /** Longer summary for assistive tech (SVG `<desc>`). */
  description?: string;
  /** Series colour — any CSS colour; defaults to the accent token. */
  color?: string;
  className?: string;
}

function chartClass(base: string, extra?: string): string {
  return extra ? `${base} ${extra}` : base;
}

function ChartFrame({
  width,
  height,
  title,
  description,
  className,
  children,
}: {
  width: number;
  height: number;
  title: string;
  description?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <svg
      className={chartClass("cs-chart", className)}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>
      {description ? <desc>{description}</desc> : null}
      {children}
    </svg>
  );
}

/** Shared inner-plot geometry: usable pixel box + a value→pixel y-scale + nice y ticks. */
function plotGeometry(
  data: readonly number[],
  width: number,
  height: number,
  includeZero: boolean,
) {
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const [dataMin, dataMax] = extent(data);
  const min = includeZero ? Math.min(0, dataMin) : dataMin;
  const max = dataMax === min ? min + 1 : dataMax;
  const ticks = niceTicks(min, max, 4);
  const domainLo = Math.min(min, ticks[0]!);
  const domainHi = Math.max(max, ticks[ticks.length - 1]!);
  const y = linearScale(domainLo, domainHi, PAD.top + innerH, PAD.top);
  return { innerW, innerH, y, ticks, baselineY: y(Math.max(0, domainLo)) };
}

function YAxis({
  ticks,
  y,
  width,
}: {
  ticks: number[];
  y: (v: number) => number;
  width: number;
}) {
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line
            className="cs-chart__grid"
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(t)}
            y2={y(t)}
          />
          <text className="cs-chart__tick" x={PAD.left - 6} y={y(t) + 3}>
            {t}
          </text>
        </g>
      ))}
    </g>
  );
}

function XLabels({
  labels,
  count,
  innerW,
  height,
}: {
  labels: readonly string[] | undefined;
  count: number;
  innerW: number;
  height: number;
}) {
  if (!labels || count === 0) return null;
  const step = count > 1 ? innerW / (count - 1) : 0;
  // Thin dense label rows so ticks never overlap.
  const every = Math.max(1, Math.ceil(count / 8));
  return (
    <g aria-hidden="true">
      {labels.slice(0, count).map((label, i) =>
        i % every === 0 ? (
          <text
            key={i}
            className="cs-chart__xlabel"
            x={PAD.left + i * step}
            y={height - 6}
            textAnchor="middle"
          >
            {label}
          </text>
        ) : null,
      )}
    </g>
  );
}

/** Line chart — a value series over its index, with a nice y axis and gridlines. */
export function LineChart({
  data,
  labels,
  width = 480,
  height = 220,
  title,
  description,
  color = "var(--cs-accent)",
  className,
}: CartesianChartProps) {
  const { innerW, y, ticks } = plotGeometry(data, width, height, false);
  const x = linearScale(
    0,
    Math.max(1, data.length - 1),
    PAD.left,
    PAD.left + innerW,
  );
  const points: Point[] = data.map((v, i) => ({ x: x(i), y: y(v) }));
  return (
    <ChartFrame {...{ width, height, title, description, className }}>
      <YAxis ticks={ticks} y={y} width={width} />
      <path
        className="cs-chart__line"
        d={linePath(points)}
        style={{ stroke: color }}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          className="cs-chart__dot"
          cx={p.x}
          cy={p.y}
          r={2.5}
          style={{ fill: color }}
        />
      ))}
      <XLabels
        labels={labels}
        count={data.length}
        innerW={innerW}
        height={height}
      />
    </ChartFrame>
  );
}

/** Area chart — a line filled to the baseline; same axes as {@link LineChart}. */
export function AreaChart({
  data,
  labels,
  width = 480,
  height = 220,
  title,
  description,
  color = "var(--cs-accent)",
  className,
}: CartesianChartProps) {
  const { innerW, y, ticks, baselineY } = plotGeometry(
    data,
    width,
    height,
    true,
  );
  const x = linearScale(
    0,
    Math.max(1, data.length - 1),
    PAD.left,
    PAD.left + innerW,
  );
  const points: Point[] = data.map((v, i) => ({ x: x(i), y: y(v) }));
  return (
    <ChartFrame {...{ width, height, title, description, className }}>
      <YAxis ticks={ticks} y={y} width={width} />
      <path
        className="cs-chart__area"
        d={areaPath(points, baselineY)}
        style={{ fill: color }}
      />
      <path
        className="cs-chart__line"
        d={linePath(points)}
        style={{ stroke: color }}
      />
      <XLabels
        labels={labels}
        count={data.length}
        innerW={innerW}
        height={height}
      />
    </ChartFrame>
  );
}

/** Bar chart — one bar per value, from a zero baseline, with a nice y axis. */
export function BarChart({
  data,
  labels,
  width = 480,
  height = 220,
  title,
  description,
  color = "var(--cs-accent)",
  className,
}: CartesianChartProps) {
  const { innerW, y, ticks, baselineY } = plotGeometry(
    data,
    width,
    height,
    true,
  );
  const n = Math.max(1, data.length);
  const slot = innerW / n;
  const barW = Math.max(1, slot * 0.7);
  return (
    <ChartFrame {...{ width, height, title, description, className }}>
      <YAxis ticks={ticks} y={y} width={width} />
      <g>
        {data.map((v, i) => {
          const top = Math.min(y(v), baselineY);
          const h = Math.abs(baselineY - y(v));
          return (
            <rect
              key={i}
              className="cs-chart__bar"
              x={PAD.left + i * slot + (slot - barW) / 2}
              y={top}
              width={barW}
              height={h}
              style={{ fill: color }}
            />
          );
        })}
      </g>
      <XLabels
        labels={labels}
        count={data.length}
        innerW={innerW}
        height={height}
      />
    </ChartFrame>
  );
}

export interface SparklineProps {
  data: readonly number[];
  width?: number;
  height?: number;
  title: string;
  color?: string;
  className?: string;
}

/** Sparkline — a compact inline trend line, no axes or labels. */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  title,
  color = "var(--cs-accent)",
  className,
}: SparklineProps) {
  const [min, max] = extent(data);
  const hi = max === min ? min + 1 : max;
  const y = linearScale(min, hi, height - 3, 3);
  const x = linearScale(0, Math.max(1, data.length - 1), 1, width - 1);
  const points: Point[] = data.map((v, i) => ({ x: x(i), y: y(v) }));
  return (
    <svg
      className={chartClass("cs-sparkline", className)}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={title}
      preserveAspectRatio="none"
    >
      <title>{title}</title>
      <path
        className="cs-chart__line"
        d={linePath(points)}
        style={{ stroke: color }}
      />
    </svg>
  );
}
