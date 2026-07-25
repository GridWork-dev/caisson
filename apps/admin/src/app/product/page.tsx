import { EmptyState, MetricStat } from "@caisson/ui/components";

import { fetchProductSnapshot } from "@/lib/posthog-reads";

// W-PRODUCT (ADR-0316) — server-side PostHog product-analytics panels. Live per-request read from
// the PostHog Query API (HogQL); the client is env-gated inert (POSTHOG_QUERY_KEY /
// POSTHOG_PROJECT_ID), so a local build renders the not-configured empty state. The project carries
// ~only `purchase` events at near-zero volume today, so each panel renders an honest "no events yet"
// state (distinct from not-configured) rather than fabricating — support_answer traffic arrives with
// the support-bot's battery-v2.
export const dynamic = "force-dynamic";

function fmtWhen(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

export default async function ProductPage() {
  const snapshot = await fetchProductSnapshot();

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin / product</p>
        <h1 className="page-title" style={{ maxWidth: "22ch" }}>
          Product analytics, from PostHog.
        </h1>
        <p className="lede">
          Server-side PostHog Query API panels (purchase events and the
          support-answer confidence distribution) read live per request. The
          project carries near-zero traffic today; panels show an honest{" "}
          <span className="mono">no events yet</span> state until real events
          land.
        </p>
      </section>

      {!snapshot.configured ? (
        <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
          <h2 className="section-title">Product analytics</h2>
          <div className="panel">
            <EmptyState
              icon="gauge"
              title="PostHog not configured"
              description="Set POSTHOG_QUERY_KEY (a personal API key with the query:read scope) and POSTHOG_PROJECT_ID (caisson-prod) to light up these panels. This surface stays dormant until those envs are set at deploy."
            />
          </div>
        </section>
      ) : !snapshot.reachable ? (
        <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
          <h2 className="section-title">Product analytics</h2>
          <div className="panel">
            <EmptyState
              icon="alert-triangle"
              title="PostHog configured but unreachable"
              description="The envs are set, but the Query API didn't respond (network, a non-2xx, or an invalid key/scope). This is NOT the same as zero events — reload to retry. The key needs the query:read scope."
            />
          </div>
        </section>
      ) : (
        <>
          <section
            className="row"
            style={{ gap: "var(--cs-space-4)", flexWrap: "wrap" }}
          >
            <MetricStat
              label="Purchase events"
              value={snapshot.purchaseCount.toLocaleString()}
              hint="all time"
              icon="cart"
            />
          </section>

          <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
            <h2 className="section-title">Recent purchases</h2>
            <div className="panel">
              {snapshot.recentPurchases.length === 0 ? (
                <EmptyState
                  icon="inbox"
                  title="No purchase events yet"
                  description="No `purchase` events have been ingested. A completed checkout emits one server-side; this list will populate as sales land."
                />
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Distinct id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.recentPurchases.map((p, i) => (
                      <tr key={i}>
                        <td className="mono">{fmtWhen(p.timestamp)}</td>
                        <td className="mono">{p.distinctId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
            <h2 className="section-title">Support-answer confidence</h2>
            <div className="panel">
              {snapshot.confidence.length === 0 ? (
                <EmptyState
                  icon="inbox"
                  title="No support_answer events yet"
                  description="The support bot has not emitted `support_answer` events with a confidence property. This distribution fills in once the support-bot battery-v2 generates traffic."
                />
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Confidence</th>
                      <th>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.confidence.map((c, i) => (
                      <tr key={i}>
                        <td>{c.bucket}</td>
                        <td className="mono">{c.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
