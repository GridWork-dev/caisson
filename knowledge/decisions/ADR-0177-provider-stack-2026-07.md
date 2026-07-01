# ADR-0177 — Provider stack 2026-07-01: Grafana-sole OTLP, PostHog, Linear + Cookiy, Greptile PR-gate

**Status:** accepted · 2026-07-01 (operator provider picker) · **supersedes ADR-0117** (self-hosted SigNoz
observability backend) for the OTLP sink · relates ADR-0138 (admin control-plane + observability charter),
ADR-0118 / ADR-0086 (Plausible cookieless marketing analytics). Append-only; supersede with a later ADR,
never edit. **Tags:** `infra` `observability` `external-system` `billing`.

## Context

The 2026-07-01 provider-optimization forks (PF-1..PF-7, Exa-research-backed — `docs/state/providers.md`)
surfaced five provider decisions. PF-1 (the observability backend, ≈half the monthly bill) was the one
material cost lever; the rest were $0-adds or recommended-closes. ADR-0117 shipped observability as a
self-hosted 5-service SigNoz stack on Railway (≈$45-70/mo compute) behind an OTLP-export seam, explicitly
designed so the backend is a one-env-var swap. The operator first leaned "keep SigNoz" (brand / data-custody),
then reversed the same day to **drop it** — the recurring compute cost outweighs the self-host custody story
pre-revenue, and Grafana Cloud's free tier covers current volume.

## Decision

1. **Observability — Grafana Cloud is the SOLE OTLP sink; self-hosted SigNoz is dropped.** Stack
   `caisson.grafana.net` (US region `prod-us-west-0`), Free tier ($0; 50GB logs + 50GB traces, 14-day). All
   app services export OTLP to the Grafana Cloud gateway. Supersedes ADR-0117's self-hosted backend; the
   OTLP-export seam (ADR-0117) is unchanged — only the sink URL + auth move. **Teardown of the 5 SigNoz
   Railway services happens only after Grafana OTLP is verified receiving traces/metrics** — observability
   must never go dark mid-cutover. `grafanactl` is the stack-management CLI (`GRAFANA_SERVER` + `GRAFANA_TOKEN`
   service-account token); the OTLP ingestion gateway needs a separate Cloud Access Policy token
   (`glc_`, `metrics/logs/traces:write`) — a `glsa_` instance token returns 401 there.
2. **Product analytics — PostHog Cloud (US), dashboard routes only.** Client ingest on
   `apps/site/app/dashboard/**` (`NEXT_PUBLIC_POSTHOG_KEY`, `person_profiles: identified_only`); Plausible
   stays the cookieless marketing analytics (ADR-0118/0086 unchanged). **PostHog error-tracking stays OFF** —
   the OTLP backend owns errors; no overlap. Operator MCP query key is the distinct `POSTHOG_MCP_API_KEY`.
3. **Agent tooling MCPs — Linear + Cookiy added.** Linear (`lin_api_` static Bearer, headless) for
   agent-native issue/project ops; the Business plan ($16/mo) unlocks agent automations but CRUD works on any
   plan. Cookiy (`cky_` headless Bearer) for positioning/message research **only — never customer PII**
   (data-custody brand posture). Both are egress sinks logged in `gridwork-core` `identity/security-surfaces.md`.
4. **Review gate — Greptile is the PR required check only.** The advisory pre-push git hook
   (`.githooks/pre-push`) is removed; pushes no longer run Greptile. The `Greptile Review` GitHub check stays a
   required status on `main` (with `@greptileai` re-trigger for skips); the `/greptile` skill remains for
   on-demand local review of large or long-lived uncommitted work.

## Consequences

- **Cost:** monthly floor drops from ≈$75-100 to ≈$30-55 once SigNoz is torn down (−$45-70/mo). PostHog +
  Cookiy = $0; Linear Business = $16/mo if enabled.
- **New egress sinks:** Grafana Cloud OTLP, PostHog US, Linear, Cookiy — all recorded in the security-surfaces
  ledger; query/telemetry text egresses, never secrets or customer data.
- **Blocked tail:** the SigNoz→Grafana OTLP cutover is gated on the operator handing a `glc_` CAP token (or the
  stack's OTLP env snippet). Until then SigNoz keeps running — no observability gap.
- **Flip-back trigger:** a HIPAA/BAA or PHI-in-telemetry customer → return to self-hosted SigNoz or SigNoz
  Cloud Teams ($49). The OTLP seam makes this a one-env-var reversal.

Live current-state ledger + cutover runbook: `docs/state/providers.md`.
