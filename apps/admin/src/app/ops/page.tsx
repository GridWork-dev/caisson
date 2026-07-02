import { EmptyState, Icon, MetricStat } from "@caisson/ui/components";
import type { IconName } from "@caisson/ui/components";

import {
  fetchOpsSnapshot,
  grafanaExploreUrl,
  type OpsSnapshot,
  type TraceRow,
} from "@/lib/grafana";

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

export default async function OpsPage() {
  const snapshot = await fetchOpsSnapshot();

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · admin / ops</p>
        <h1 className="page-title" style={{ maxWidth: "20ch" }}>
          Fleet telemetry, at a glance.
        </h1>
        <p className="lede">
          The active services, the most recent traces, and the error traces over
          the last 30 minutes — read from Grafana Cloud (Tempo) over TraceQL,
          with deep-links into Grafana Explore when you need to go deeper.
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
            <Icon name="arrow" /> View in Grafana
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
        <ul className="board">
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
