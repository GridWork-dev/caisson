# SPEC — Admin dashboard buildout: views + telemetry federation (one operator cockpit)

**Status: LOCKED (ADR-0316, 2026-07-10) — armed for execution: full six-wave buildout (W-PRODUCT via the F3 federate-now lock, W-INTEL-TRIAGE via the riders), in-admin Loki panel, PostHog federation now with honest empty states, all three riders.** Requested at
the 2026-07-10 close-out follow-up. Grounded in a full surface map of `apps/admin` (routes, data
seams, conventions) — the platform now emits far more telemetry than the cockpit surfaces, and
the "one operator cockpit" pitch on the overview page is honest only for Postgres reads + Tempo
traces.

- **Surface:** `apps/admin` (new pages + `/ops`/`/business`/`/architecture`/`/intel` extensions),
  one small `intel.findings` migration (fork F5), optionally `services/support-bot` (Loki gap).
- **Tags:** `frontend`, `infra`, `observability`.
- **Auth/conventions (unchanged):** GitHub-OAuth + numeric-id allowlist, `src/proxy.ts` gate,
  RSC pages with `readAdmin()` reads, nav via `admin-nav.tsx` `LINKS`, mutations POST-only
  Zod-`.strict()` dual-logged. New views are READ-ONLY unless a fork says otherwise.

## What exists today vs what's dark

| Signal                                               | Exists in                         | Admin surface today                 |
| ---------------------------------------------------- | --------------------------------- | ----------------------------------- |
| Tempo traces (fleet)                                 | Grafana Cloud                     | `/ops` (30-min window, works)       |
| Loki logs (admin/docs/license/site since 2026-07-10) | Grafana Cloud                     | **none**                            |
| PostHog server events (`purchase`)                   | PostHog caisson-prod              | **none**                            |
| support-bot answer telemetry (`support_answer`)      | PostHog (wired; zero traffic yet) | **none**                            |
| `credit_event` raw ledger                            | Postgres                          | balance only on `/business`         |
| Paddle subscription/webhook event history            | Postgres via `services/license`   | snapshot rows only                  |
| Registry Worker request/429/filter metrics           | Cloudflare (GraphQL analytics)    | **none**                            |
| Railway deploy/restart/health                        | Railway API                       | static build-time `/architecture`   |
| `intel.findings`                                     | Postgres `intel` schema           | `/intel` read-only, no triage state |
| support-bot escalations (`support_ticket`)           | Postgres                          | **none**                            |

## Candidate waves (fork F1 picks wave-1)

- **W-LOGS — `/ops` logs panel.** Per-service Loki tail (last 30 min, error-level filter,
  `service_name` picker) beside the existing trace widgets, + "Open in Grafana Explore"
  deep-links. Env already on the service (`GRAFANA_URL`/`GRAFANA_QUERY_TOKEN`); add the logs
  datasource uid env. Known gap to note in-page: support-bot has NO Loki stream (its Python
  telemetry is OTLP traces + PostHog only) — rider (b) below.
- **W-COMMERCE — money timeline.** Per-account `credit_event` ledger view (grant/consume/claw
  with FIFO expiry annotations) + a Paddle event timeline (webhook history from
  `services/license`'s tables) + chargeback/refund flags per ADR-0294/0302. Structural rider:
  adopt `@caisson/platform-reads` in `business-reads.ts` where overlap exists (fork F4) so admin
  stops hand-rolling SQL the package already owns under a column-contract test.
- **W-PRODUCT — PostHog federation.** Server-side PostHog query API panels: purchase events,
  checkout funnel once site events arm, `support_answer` confidence distribution once battery-v2
  generates traffic (fork F3 decides whether this view exists at all vs PostHog staying the
  second pane).
- **W-FLEET — live topology.** `/architecture` gains live overlays: Railway API deploy
  status/restarts per service + registry Worker request/429 counts from the CF GraphQL analytics
  API. The static diagram stays the skeleton; live data decorates it.
- **W-SUPPORT — support health card.** `support_ticket` escalation list + bot liveness (last
  boot line from Loki once rider (b) lands, else Railway) + link to the Linear Triage view.
- **W-INTEL-TRIAGE — findings workflow.** `reviewed`/`dismissed` state on `intel.findings`
  (one migration + two POST routes following the mutation conventions) so findings stop
  accumulating as an append-only wall (fork F5).

## Operator forks (picker)

- **F1 — wave-1 scope:** which waves ship first (recommend W-LOGS + W-COMMERCE: highest
  operator-debugging value, zero new vendors).
- **F2 — logs approach:** (a) in-admin Loki panel (recommended — true one-cockpit), or
  (b) deep-links to Grafana Explore only (zero query code, second pane stays).
- **F3 — PostHog posture:** (a) federate read-only panels into admin, or (b) PostHog dashboard +
  MCP stay the analytics pane, admin never queries it (recommended until site events arm — the
  project currently carries only `purchase`).
- **F4 — platform-reads adoption in admin:** (a) yes, fold `business-reads.ts` overlap onto
  `@caisson/platform-reads` (recommended — kills the schema-desync risk its column-contract test
  exists to prevent), or (b) keep the parallel SQL.
- **F5 — intel triage state:** (a) build reviewed/dismissed now (recommended, S effort), or
  (b) park until the intel daemon's finding volume actually hurts.
- **Riders:** (a) every new view renders the standard `EmptyState` when its env/config is absent
  (the `/ops` dormant pattern); (b) support-bot Loki gap — add OTLP log export to the Python
  telemetry module (S) or accept Railway logs as its log home (named in-page either way).

## Verify

Per wave: page renders with real data on the live admin + renders `EmptyState` with env unset
(PGlite/dev) · no new mutation surface except W-INTEL-TRIAGE's two routes (dual-logged like every
other mutation) · lighthouse not applicable (operator-only surface) · `bun run check` +
standards-gate green.

## Effort / value

S–M per wave. Value: closes the second-pane-of-glass gap the surface map documented — the
operator debugs incidents, money questions, and bot quality from one authed cockpit instead of
four consoles (Grafana, PostHog, Railway, Cloudflare).
