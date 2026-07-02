# ADR-0207 — admin /ops cockpit rebuilds on the Grafana Cloud query API

**Status:** accepted · 2026-07-02 (edition-tails-ops kickoff — operator lock, picker round 2026-07-02).
**Relates:** ADR-0177 (Grafana sole OTLP sink; SigNoz torn down 2026-07-01), ADR-0140 (admin control-plane
charter), ADR-0117 (superseded SigNoz posture).

## Context

The ADR-0177 cutover deleted the SigNoz Railway services, orphaning the `apps/admin` /ops cockpit:
`lib/signoz.ts` queries the dead SigNoz v5 query API and the page deep-links to the deleted SigNoz UI. It
is env-gated inert (unset ⇒ empty state, no crash), but its backend is gone permanently.

## Decision

Rebuild the cockpit's telemetry reads against **Grafana Cloud's HTTP query API** (the fleet's live sink):
replace the SigNoz client with a Grafana-backed one behind the same env-gated pattern (new `GRAFANA_*`
query env vars; unset ⇒ the existing "Observability backend not configured" empty state). The fleet emits
**traces only**, so widgets query Tempo (TraceQL) for service health/recent traces; the deep-links repoint
to Grafana Explore. All stale SigNoz labels (ops page copy, home-page description, architecture-diagram
node) are corrected in the same change. In-app fleet telemetry stays a first-class admin surface per the
ADR-0140 charter.

## Rejected

- **Deep-link card to Grafana Explore + delete the query client** (the recon recommendation — cheapest,
  Grafana's UI already renders all of it) — operator locked the full rebuild; the control-plane keeps
  in-app widgets rather than bouncing to a second console.
- **Copy-fix only, leave the cockpit dormant** — keeps dead code wired to a deleted backend.
