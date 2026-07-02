# ADR-0206 — support-bot escalations post to Linear Triage (third best-effort sink)

**Status:** accepted · 2026-07-02 (edition-tails-ops kickoff — operator lock, picker round 2026-07-02).
**Relates:** ADR-0177 (Linear adopted for work tracking), ADR-0105 (support-bot implementation),
ADR-0009 (support service concept); `docs/state/linear-integration.md` (CAISSON-3, the named fast-follow).

## Context

Escalations today fire two best-effort sinks from `Escalator.escalate()` (Discord thread + Postgres
`support_ticket.ai_brief`); the Linear inbound leg — every escalation becoming a triageable Linear issue —
was designed in `docs/state/linear-integration.md` but never built (zero Linear code in the bot).

## Decision

Add a third best-effort sink, cloning the existing port pattern:

- **`IssueTracker` Protocol** beside `ThreadOpener`; concrete `LinearIssueTracker` in a new
  `linear_client.py` POSTs the `issueCreate` GraphQL mutation to `api.linear.app` with the `format_brief()`
  body. Port owns its failures: escalation must succeed even when Linear is down (never raises).
- **Explicit `stateId` = the CAISSON team's Triage state**, passed on create — no dependency on
  Business-tier triage automations.
- **v1 is log-only for the created issue URL** — no `support_ticket` schema migration (the deployed table
  has no ALTER path; correlation is a nice-to-have).
- **Feature is env-gated off**: `LINEAR_API_KEY` / `LINEAR_TEAM_ID` / `LINEAR_TRIAGE_STATE_ID` optional
  settings; unset ⇒ no Linear code path runs.
- **Credential: the operator's existing `lin_api_` personal key** is set as the bot's `LINEAR_API_KEY`
  (operator lock). Trade-off acknowledged: bot compromise exposes workspace-wide Linear access, not just
  issue-create; swapping to a dedicated bot actor later is a pure env-var rotation, zero code change.
- Two verified API gotchas are pinned in tests: Linear personal keys use `Authorization: <key>` with **no
  `Bearer` prefix**, and GraphQL can return HTTP 200 with a top-level `errors` array — both must be
  asserted so they cannot regress silently.
- `api.linear.app` becomes an acknowledged external egress sink from `caisson-support-bot` (row landed in
  gridwork-core `identity/security-surfaces.md` alongside this change, per the security floor's
  same-commit invariant).

## Rejected

- **Dedicated narrowly-scoped bot key** (the recommended default — smaller blast radius) — operator chose
  key reuse for now; revisit at rotation time.
- **Business-tier triage-automation routing** — plan-dependent and console-configured; explicit stateId is
  plan-independent and testable.
- **Persisting the Linear issue URL onto `support_ticket` in v1** — requires the codebase's first ALTER
  TABLE migration path for a nice-to-have; log-only until correlation earns it.
