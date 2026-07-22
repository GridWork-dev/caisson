import { Button, EmptyState, Icon, MetricStat } from "@caisson/ui/components";
import type { IconName } from "@caisson/ui/components";

import {
  fetchOpsSnapshot,
  grafanaExploreUrl,
  type OpsSnapshot,
  type TraceRow,
} from "@/lib/grafana";
import {
  fetchLogsSnapshot,
  lokiExploreUrl,
  type LogLine,
  type LogsSnapshot,
} from "@/lib/loki";

// Live per-request telemetry — never cache. Grafana Cloud is the fleet's OTLP sink (ADR-0177/0207),
// provisioned at deploy, so in a local build `fetchOpsSnapshot()` short-circuits to the empty state.
export const dynamic = "force-dynamic";

const ERROR_TRACEQL = "{ status = error }";
const RECENT_TRACEQL = "{}";

const fmtMs = (n: number): string => `${Math.round(n).toLocaleString()} ms`;

function fmtAge(startMs: number, nowMs: number): string {
  if (startMs <= 0) return "—";
  const s = Math.max(0, Math.round((nowMs - startMs) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ logService?: string; logErrors?: string }>;
}) {
  const params = await searchParams;
  const logService = params.logService?.trim();
  const errorsOnly = params.logErrors === "1";
  // Traces (Tempo) and logs (Loki) are independent Grafana Cloud datasources — read both in
  // parallel; each panel gates on its OWN env, so one can be dark while the other lights up.
  const [snapshot, logs] = await Promise.all([
    fetchOpsSnapshot(),
    fetchLogsSnapshot({
      ...(logService !== undefined && logService !== ""
        ? { service: logService }
        : {}),
      errorsOnly,
    }),
  ]);

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · admin / ops</p>
        <h1 className="page-title" style={{ maxWidth: "20ch" }}>
          Fleet telemetry, at a glance.
        </h1>
        <p className="lede">
          The active services, the most recent traces, the error traces, and the
          log tail over the last 30 minutes — read from Grafana Cloud (Tempo +
          Loki), with deep-links into Grafana Explore when you need to go
          deeper.
        </p>
      </section>

      {!snapshot.configured ? (
        <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
          <h2 className="section-title">Observability</h2>
          <div className="panel">
            <EmptyState
              icon="gauge"
              title="Observability backend not configured"
              description="Set GRAFANA_URL / GRAFANA_QUERY_TOKEN / GRAFANA_TEMPO_DATASOURCE_UID to light up the fleet widgets. Grafana Cloud is the fleet's OTLP sink (ADR-0177/0207) — this surface stays dormant until those query envs are set at deploy."
            />
          </div>
        </section>
      ) : (
        <ConfiguredOps snapshot={snapshot} />
      )}

      <LogsPanel logs={logs} />
    </div>
  );
}

function ConfiguredOps({ snapshot }: { snapshot: OpsSnapshot }) {
  const { services, recent, errors } = snapshot;
  const nowMs = snapshot.window.toMs;
  const openAll = grafanaExploreUrl(RECENT_TRACEQL);
  const openErrors = grafanaExploreUrl(ERROR_TRACEQL);

  return (
    <>
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title">Last 30 minutes</h2>
          {openAll ? (
            <a
              className="btn"
              href={openAll}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Icon name="arrow" /> Open in Grafana
            </a>
          ) : null}
        </div>
        <div
          className="row"
          style={{ gap: "var(--cs-space-4)", flexWrap: "wrap" }}
        >
          <MetricStat
            label="Active services"
            value={services.length.toLocaleString()}
            hint="emitting traces"
            icon="server"
          />
          <MetricStat
            label="Recent traces"
            value={recent.length.toLocaleString()}
            hint={`sampled, latest ${recent.length}`}
            icon="gauge"
          />
          <MetricStat
            label="Error traces"
            value={errors.length.toLocaleString()}
            hint="status = error"
            icon="alert-triangle"
            tone={errors.length > 0 ? "critical" : "positive"}
          />
        </div>
      </section>

      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Services</h2>
        {services.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon="inbox"
              title="No services in the window"
              description="Grafana is configured but no service.name tag values were reported in the last 30 minutes. Traffic will populate this as services emit traces."
            />
          </div>
        ) : (
          <ul className="board">
            {services.map((svc) => {
              const link = grafanaExploreUrl(
                `{ resource.service.name = "${svc}" }`,
              );
              return (
                <li key={svc} className="board-row">
                  <ServiceRow service={svc} href={link} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <TraceSection
        title="Recent traces"
        traces={recent}
        nowMs={nowMs}
        deepLink={openAll}
        emptyTitle="No traces in the window"
        emptyDescription="The backend is configured but reported no traces in the last 30 minutes. Traffic will populate this as services emit spans."
      />

      <TraceSection
        title="Error traces"
        traces={errors}
        nowMs={nowMs}
        deepLink={openErrors}
        emptyTitle="No error traces"
        emptyDescription="No spans with status = error in the last 30 minutes."
        emptyIcon="check"
      />
    </>
  );
}

function ServiceRow({
  service,
  href,
}: {
  service: string;
  href: string | null;
}) {
  const inner = (
    <>
      <span className="board-glyph" data-state="ready">
        <Icon name="server" />
      </span>
      <span className="board-main">
        <span className="board-title mono">{service}</span>
      </span>
      {href ? (
        <span className="board-arrow">
          <Icon name="arrow" />
        </span>
      ) : null}
    </>
  );
  return href ? (
    <a
      className="board-link"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {inner}
    </a>
  ) : (
    <div className="board-link is-static">{inner}</div>
  );
}

function TraceSection({
  title,
  traces,
  nowMs,
  deepLink,
  emptyTitle,
  emptyDescription,
  emptyIcon = "inbox",
}: {
  title: string;
  traces: TraceRow[];
  nowMs: number;
  deepLink?: string | null;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: IconName;
}) {
  return (
    <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="section-title">{title}</h2>
        {deepLink ? (
          <a
            className="btn"
            href={deepLink}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Icon name="arrow" /> Open in Grafana
          </a>
        ) : null}
      </div>
      {traces.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      ) : (
        <ul className="board board--capped">
          {traces.map((t) => {
            const link = grafanaExploreUrl(t.traceId);
            const inner = (
              <>
                <span className="board-glyph" data-state="ready">
                  <Icon name="gauge" />
                </span>
                <span className="board-main">
                  <span className="board-title mono">
                    {t.service}
                    {t.name ? ` · ${t.name}` : ""}
                  </span>
                  <span className="board-desc muted">
                    {fmtMs(t.durationMs)} · {fmtAge(t.startMs, nowMs)} ·{" "}
                    <span className="mono">{t.traceId.slice(0, 12)}</span>
                  </span>
                </span>
                {link ? (
                  <span className="board-arrow">
                    <Icon name="arrow" />
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={t.traceId} className="board-row">
                {link ? (
                  <a
                    className="board-link"
                    href={link}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="board-link is-static">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---- W-LOGS (ADR-0316): the Loki log-tail panel ---------------------------

/** Clamp a single log line so one runaway payload can't blow out the row. */
const LINE_CLAMP = 400;
const clampLine = (s: string): string =>
  s.length > LINE_CLAMP ? `${s.slice(0, LINE_CLAMP)}…` : s;

function LogsPanel({ logs }: { logs: LogsSnapshot }) {
  if (!logs.configured) {
    return (
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Logs</h2>
        <div className="panel">
          <EmptyState
            icon="terminal"
            title="Log backend not configured"
            description="Set GRAFANA_LOKI_DATASOURCE_UID (alongside the GRAFANA_URL / GRAFANA_QUERY_TOKEN already used for traces) to tail fleet logs here. Grafana Cloud Loki is the fleet's OTLP log sink (ADR-0177/0316) — this panel stays dormant until that datasource uid is set at deploy."
          />
        </div>
      </section>
    );
  }

  const deepLink = lokiExploreUrl(logs.query);
  const filtered = logs.service !== undefined || logs.errorsOnly;
  // Keep a selected-but-quiet service visible in the picker even if it emitted nothing in the window.
  const serviceOptions =
    logs.service !== undefined &&
    logs.service !== "" &&
    !logs.services.includes(logs.service)
      ? [logs.service, ...logs.services]
      : logs.services;

  return (
    <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="section-title">Logs · last 30 minutes</h2>
        {deepLink ? (
          <a
            className="btn"
            href={deepLink}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Icon name="arrow" /> Open in Grafana
          </a>
        ) : null}
      </div>

      <form
        method="GET"
        className="row"
        style={{
          gap: "var(--cs-space-3)",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <label className="stack" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: "0.8em" }}>
            Service
          </span>
          <select
            name="logService"
            defaultValue={logs.service ?? ""}
            className="text-input"
          >
            <option value="">All services</option>
            {serviceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="row" style={{ gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            name="logErrors"
            value="1"
            defaultChecked={logs.errorsOnly}
          />
          <span className="muted" style={{ fontSize: "0.85em" }}>
            Errors only
          </span>
        </label>
        <Button type="submit" variant="primary" size="sm">
          Apply
        </Button>
        {filtered ? (
          <a
            href="/ops"
            className="muted"
            style={{ alignSelf: "center", fontSize: "0.85em" }}
          >
            Clear
          </a>
        ) : null}
      </form>

      <p className="muted" style={{ fontSize: "0.85em" }}>
        A service missing from the picker (or showing no lines) isn&apos;t
        necessarily down — no stream yet means it hasn&apos;t been redeployed
        since its OTLP log export shipped, or it isn&apos;t logging in this
        window. support-bot&apos;s log export shipped 2026-07-10; its stream
        appears after its next deploy.
      </p>

      {logs.lines.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="inbox"
            title="No log lines in the window"
            description={
              logs.errorsOnly
                ? "No error-level lines in the last 30 minutes for this filter."
                : "Loki is configured but reported no lines for this filter in the last 30 minutes."
            }
          />
        </div>
      ) : (
        <ul className="board board--capped">
          {logs.lines.map((l, i) => (
            <li key={i} className="board-row">
              <LogRow line={l} nowMs={logs.window.toMs} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LogRow({ line, nowMs }: { line: LogLine; nowMs: number }) {
  return (
    <div className="board-link is-static">
      <span className="board-glyph" data-state="ready">
        <Icon name="terminal" />
      </span>
      <span className="board-main">
        <span className="board-title mono">
          {line.service}
          {line.level !== undefined ? ` · ${line.level}` : ""}
        </span>
        <span className="board-desc muted mono">{clampLine(line.line)}</span>
      </span>
      <span
        className="board-arrow muted"
        style={{ fontSize: "0.8em", whiteSpace: "nowrap" }}
      >
        {fmtAge(line.tsMs, nowMs)}
      </span>
    </div>
  );
}
