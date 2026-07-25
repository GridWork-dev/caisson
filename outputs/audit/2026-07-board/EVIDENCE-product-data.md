# EVIDENCE — product data (stage d) — sufficiency probe

Probed 2026-07-23 by the resident (PostHog project caisson-prod, 30-day window,
`query-web-overview`).

- **E-P1 (OBSERVED):** 30d traffic: **1 unique visitor, 12 pageviews, 2 sessions**,
  18s avg session, 50% bounce. Effectively zero external traffic — consistent with
  pre-launch status; the single visitor is plausibly the operator.
- **E-P2 (OBSERVED):** event schema contains no product activation/signup events —
  instrumented events are web vitals, pageview, MCP/AI telemetry, one `purchase`
  definition with no meaningful volume, plus probe events (`aeo_citation_probe`,
  `parity_probe`).

## Gate consequence (binding on all personas — SPEC A12, PLAN pre-flight 5)

The data-sufficiency threshold is decisively unmet:

1. Any funnel/CAC/activation/retention claim is capped at **ASSUMED** — there is no
   funnel to observe.
2. The growth/demand lens draws ONLY on: the design-partner program (ADR-0297),
   Cookiy interview + screen-out evidence, the DEMAND-LEDGER (explicit zeroes), and
   site/positioning readiness.
3. The fail-closed pricing/pivot rule applies: no ranked pricing recommendation may
   claim demand evidence; pricing/pivot rows in the decision table are at best
   **EXPERIMENT-FIRST**, with the exact data needed to decide named per row.
