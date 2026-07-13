# ADR-0348 — Status page + /trust locks: SPEC accepted, status.caisson.sh CNAME, dedicated Worker health route

Status: accepted · 2026-07-13 (operator picker round; locks `outputs/specs/status-trust-page/SPEC.md`)

## Decision

1. **The status/trust SPEC is LOCKED as written** (Better Stack free status page over the four
   existing public health endpoints · `/trust` page · maintained subprocessor table · ADR-0080
   copy laws · no SLA language). EXECUTE rides a post-freeze session — `apps/site` belongs to
   Kickoff S this wave.
2. **Status page domain: `status.caisson.sh` CNAME to Better Stack** — branded and
   vendor-swappable; the record lands in `infra/terraform` beside the email records under the
   same operator-gated import/apply runbook. Better Stack free-tier custom-domain support is
   re-verified at EXECUTE before the CNAME is applied.
3. **Registry Worker monitor target: a dedicated unauthenticated `/health` route** on the Worker
   (200 + version) — liveness semantics never entangled with registry-index caching or
   entitlement filtering.
