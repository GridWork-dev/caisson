# ADR-0316 — Admin dashboard buildout locks: full six-wave cockpit, in-admin logs, PostHog federation, all riders

**Status:** accepted · 2026-07-10 (close-out follow-up picker, second round of the sitting).
**Tags:** `frontend`, `infra`, `observability`. Locks
`outputs/specs/close-out-triage/SPEC-admin-dashboard-buildout.md` (DRAFT → LOCKED).

## Context

The close-out follow-up mapped `apps/admin` against everything the platform now emits: Tempo
traces are the only federated telemetry; Loki logs, PostHog events, the credit ledger, Paddle
event history, Worker metrics, Railway health, and support-bot signals all live in second panes.
The spec tabled five forks + two riders; the picker ran the same sitting.

## Decision

1. **Wave-1 scope (F1 + F3 + riders): the full six-wave buildout.** The operator selected
   W-LOGS · W-COMMERCE · W-FLEET · W-SUPPORT on F1, pulled **W-PRODUCT in via the F3
   federate-now lock**, and **W-INTEL-TRIAGE in via the riders answer**. Sequencing within the
   wave is the executor's call; W-LOGS + W-COMMERCE carry the recommendation as first-built.
2. **F2 — in-admin Loki panel.** `/ops` gains server-side Loki queries (per-service tail,
   error filter) beside the trace widgets; Grafana Explore stays the deep-dive link, not the
   primary pane.
3. **F3 — PostHog federation NOW.** W-PRODUCT read-only panels build immediately, rendering
   honestly-sparse states until site events + `support_answer` traffic arm (today the project
   carries only server-side `purchase`). The panels must label empty series as
   "no events yet", never as zero activity.
4. **Riders — all three:** (a) `@caisson/platform-reads` adoption in `business-reads.ts`
   (kills the parallel-SQL desync risk); (b) intel triage state — `reviewed`/`dismissed`
   migration + two dual-logged POST routes; (c) **support-bot OTLP log export** in the Python
   telemetry module so the bot finally lands in Loki like the TS fleet.
5. Standing rider: every new view renders the `/ops`-style `EmptyState` when its env/config is
   absent — a missing token can never break the cockpit.

## Consequences

- Admin becomes the actual one-operator cockpit its overview page claims; Grafana, PostHog,
  Railway, and Cloudflare become deep-dive panes, not required daily consoles.
- New read paths: Loki + PostHog + Railway + CF GraphQL — all read-only server-side calls from
  admin (no new mutation surface beyond the two intel-triage routes, which follow the
  dual-logging convention).
- The support-bot Loki gap closes at the telemetry-module level, not with a service rewrite.
- Execution is a normal SPEC→PLAN→EXECUTE pickup; the `frontend`/`infra` tags fire the matching
  audits at SHIP.
