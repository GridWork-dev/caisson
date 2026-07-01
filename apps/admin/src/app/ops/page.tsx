import { EmptyState, Icon, MetricStat } from "@caisson/ui/components";
import type { MetricStatTone } from "@caisson/ui/components";

import { fetchFleetSummary, signozUiUrl, type ServiceStat } from "@/lib/signoz";

// Live per-request telemetry — never cache. SigNoz is provisioned at deploy (ADR-0142), so
// in a local build `fetchFleetSummary()` short-circuits to the empty-state below.
export const dynamic = "force-dynamic";

const fmtCount = (n: number | null): string =>
  n === null ? "—" : Math.round(n).toLocaleString();
const fmtMs = (n: number | null): string =>
  n === null ? "—" : `${Math.round(n).toLocaleString()} ms`;

function errorRateTone(rate: number): MetricStatTone {
  if (rate > 0.05) return "critical";
  if (rate > 0.01) return "warning";
  return "positive";
}
function p90Tone(ms: number): MetricStatTone {
  if (ms > 2000) return "critical";
  if (ms > 500) return "warning";
  return "default";
}

export default async function OpsPage() {
  const summary = await fetchFleetSummary();
  const deepLink = signozUiUrl();

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · admin / ops</p>
        <h1 className="page-title" style={{ maxWidth: "20ch" }}>
          Fleet telemetry, at a glance.
        </h1>
        <p className="lede">
          Request rate, error rate, and tail latency per service over the last
          30 minutes — read from the self-hosted SigNoz query API, with a
          deep-link to the full traces when you need to go deeper.
        </p>
      </section>

      {!summary.configured ? (
        <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
          <h2 className="section-title">Observability</h2>
          <div className="panel">
            <EmptyState
              icon="gauge"
              title="Observability backend not configured"
              description="Set SIGNOZ_QUERY_URL / SIGNOZ_API_KEY to light up the fleet widgets. SigNoz is provisioned at deploy (ADR-0142) — this surface stays dormant until then."
            />
          </div>
        </section>
      ) : (
        <ConfiguredOps services={summary.services} deepLink={deepLink} />
      )}
    </div>
  );
}

function ConfiguredOps({
  services,
  deepLink,
}: {
  services: ServiceStat[];
  deepLink: string | null;
}) {
  const totalRequests = services.reduce((a, s) => a + (s.requests ?? 0), 0);
  const totalErrors = services.reduce((a, s) => a + (s.errors ?? 0), 0);
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
  const worstP90 = services.reduce<number | null>(
    (a, s) => (s.p90Ms === null ? a : Math.max(a ?? 0, s.p90Ms)),
    null,
  );

  return (
    <>
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title">Last 30 minutes</h2>
          {deepLink ? (
            <a
              className="btn"
              href={deepLink}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Icon name="arrow" /> Open in SigNoz
            </a>
          ) : null}
        </div>
        <div
          className="row"
          style={{ gap: "var(--cs-space-4)", flexWrap: "wrap" }}
        >
          <MetricStat
            label="Requests"
            value={fmtCount(totalRequests)}
            hint="across the fleet"
            icon="gauge"
          />
          <MetricStat
            label="Error rate"
            value={`${(errorRate * 100).toFixed(2)}%`}
            hint={`${fmtCount(totalErrors)} errors`}
            icon="alert-triangle"
            tone={errorRateTone(errorRate)}
          />
          <MetricStat
            label="p90 latency"
            value={fmtMs(worstP90)}
            hint="worst service"
            icon="server"
            tone={worstP90 === null ? "default" : p90Tone(worstP90)}
          />
        </div>
      </section>

      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">By service</h2>
        {services.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon="inbox"
              title="No telemetry in the window"
              description="The backend is configured but reported no spans in the last 30 minutes. Traffic will populate this as services emit traces."
            />
          </div>
        ) : (
          <ul className="board">
            {services.map((s) => (
              <li key={s.service} className="board-row">
                <div className="board-link is-static">
                  <span className="board-glyph" data-state="ready">
                    <Icon name="server" />
                  </span>
                  <span className="board-main">
                    <span className="board-title mono">{s.service}</span>
                    <span className="board-desc muted">
                      {fmtCount(s.requests)} req · {fmtCount(s.errors)} err ·{" "}
                      {fmtMs(s.p90Ms)} p90
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
