---
updated: 2026-07-04
status: live
---

# Live-verification harness — post-rotation credential proof (ADR-0224)

The launch-blocking external seams (Paddle money path, Discord role-grant, Linear Triage sink,
Grafana Cloud query, `NEXT_PUBLIC_*` analytics) are wired to production but were exercised only by
unit doubles — a key rotation with a wrong scope, a stale secret, or an un-mirrored token passes every
unit test and fails only in production, on a real purchase. **This harness is the proof the rotated
launch credentials actually work end-to-end.** Every proof self-skips without its creds (the ADR-0201
`live/` + `skipIf` convention) and lives OUTSIDE the default suite, so CI never runs it.

## The loop: rotate → run → read the red seam

1. **Rotate** the scoped launch key(s) and mirror them into `~/.gridwork/caisson.env` (the launch
   credential SOT — ADR-0224 F6=A; source-chained from `~/.gridwork/env`, no 1Password at runtime).
2. **Run** the whole suite (source the env first so every seam's creds are present):

   ```bash
   set -a && . ~/.gridwork/caisson.env && set +a

   # The five bun seams (billing, license, admin, site) — fans out every package/service test:live:
   bun run test:live:all

   # The two Python seams (support-bot) — the `live` marker is deselected by default, so opt in:
   cd services/support-bot && uv run pytest -m live
   ```

3. **Read** the result. Green everywhere = the rotated credentials are wired correctly. A red leg
   **names the one seam that broke** — a signal no double-backed unit test can produce. Skipped (not
   run) means that seam's creds are absent from the env — fill them in and re-run.

> `bun run test:live:all` == `turbo run test:live`; it only runs in workspaces that declare a
> `test:live` script (billing · license · admin · site). The support-bot is Python, so its two live
> proofs run via the pytest `live` marker, separately, as shown above.

## The five seams — creds + skip condition + what each proves

| Seam                              | Proof file(s)                                                                                                                                                       | Required env (skips if any unset)                                                                                                                                                                 | Proves (the double can't)                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · Paddle → webhook → grant**  | `packages/billing/live/paddle-webhook.live.test.ts` · `services/license/live/webhook-grant.live.test.ts`                                                            | `PADDLE_API_KEY` + `PADDLE_SIM_RECEIVER_URL` (+ `PADDLE_SANDBOX_CHECKOUT_URL` for the Playwright leg); `PADDLE_WEBHOOK_SECRET` + `DATABASE_URL` + `LICENSE_WEBHOOK_URL` + `PADDLE_PROOF_PRICE_ID` | A real Paddle-signed/simulated delivery drives the real verify→parse→`applyBillingEvent`, landing a real grant row for the reserved proof tenant, then tearing it down.      |
| **2 · Discord role-grant**        | `services/license/live/discord-grant.live.test.ts` (license→bot Bearer push) · `services/support-bot/tests/live/test_billing_grant_live.py` (full grant + teardown) | TS: `SUPPORT_BOT_URL` + `SUPPORT_BOT_GRANT_TOKEN` + `DISCORD_PROOF_USER_ID`. Py: `DISCORD_TOKEN` + `GUILD_ID` + `DISCORD_PROOF_USER_ID` + `DISCORD_PROOF_ROLE_ID` + `BILLING_GRANT_TOKEN`         | The deployed bot authenticates the shared Bearer (TS), and a real `member.add_roles` lands the throwaway `caisson-proof` role on the guild owner then is removed (Py, F3=B). |
| **3 · Linear Triage sink**        | `services/support-bot/tests/live/test_linear_live.py`                                                                                                               | `LINEAR_API_KEY` + `LINEAR_TEAM_ID` + `LINEAR_TRIAGE_STATE_ID`                                                                                                                                    | The real Linear API accepts the bare-header (no `Bearer`) auth + explicit team/state and returns a real `issue.url`; the proof issue is archived on teardown.                |
| **4 · Grafana Cloud query**       | `apps/admin/live/grafana.live.test.ts`                                                                                                                              | `GRAFANA_URL` + `GRAFANA_QUERY_TOKEN` + `GRAFANA_TEMPO_DATASOURCE_UID`                                                                                                                            | The real datasource proxy accepts the real `glsa_` query token and returns the fleet's own service names (read-only, no teardown).                                           |
| **5 · `NEXT_PUBLIC_*` analytics** | `apps/site/live/analytics-bundle.live.test.ts`                                                                                                                      | `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`                                                                                                                                        | A real `next build` inlines the rotated key/domain into the shipped client bundle (F4=A build-grep).                                                                         |

### Seam-5 note — analytics ingestion stays dashboard-verified

The build-grep proves the rotated `NEXT_PUBLIC_*` value reaches the client bundle (the thing a rotation
breaks). It does **not** prove PostHog/Plausible _ingested_ the event — only their dashboards can
confirm receipt (ADR-0224 F4=A). After a rotation, spot-check the provider dashboard for a live event.

### Seam-1 note — the A1 signature question (record the answer here)

ADR-0224 Task 1: the Paddle webhook simulator delivers real-shaped payloads to a notification
destination, but it was open whether that delivery is **signed** with the destination's secret. The
billing leg (`packages/billing/live/paddle-webhook.live.test.ts`) resolves this live: a signed delivery
asserts the full `verifyPaddleWebhook` leg; an unsigned one asserts parse-only and prints a verify-leg
skip note.

**A1 result: SIGNED.** A live Paddle Simulations-API purchase proof ran 2026-07-04 end-to-end: signed
sim delivery -> `verifyPaddleWebhook` -> envelope parse -> `purchase.completed` -> a real
`entitlement_grant` row (field-crypto, line-item join id carried) -> `billing_processed_event` dedup
row -> a PostHog `purchase` capture. The simulator **does** cover the real verify leg — the
hand-signed unit suite is a belt-and-suspenders backstop, not the only signed coverage. The same live
pass also caught and fixed a launch-critical bug the fixture-only tests had missed: `PaddleEventSchema`/
`StripeEventSchema` were `.strict()` over just the mapper's consumed fields, so every real delivery
(which always carries additive fields Paddle/Stripe document as non-breaking, e.g. `occurred_at` +
`notification_id`) 400'd at the boundary -- no purchase would ever have fulfilled in production. Fixed
in `fix(billing): accept real Paddle and Stripe webhook envelopes at the boundary (#114)`, commit
`b674ed3`. One gotcha worth carrying forward: the simulator merges omitted payload-override fields in
from its static example, so a nulled field (e.g. `subscription_id`) must be set explicitly `null` or it
leaks in and misroutes the mapper. Evidence:
`outputs/archive/specs/audit-v2-remediation/TRIAGE.md` (2026-07-04 EXECUTED banner) + project memory
`remediation-closeout-live-proofs`.

## Invariants (why this is safe to run against production)

- **Zero product code.** The harness is `live/` / `tests/live/` proofs + `test:live` scripts + this
  runbook. No handler, verifier, env-gate, or component changed.
- **CI never runs it.** Every leg self-skips without creds and lives outside the default suite
  (`bun test ./src|./lib|./live`-excluded from default; pytest `-m 'not live'`). No push/PR job runs a
  live proof (F5=A local command only; a `workflow_dispatch` gate is a later, separately-audited step).
- **Production mutation is contained + self-cleaning.** Seam 1 uses the reserved proof tenant
  (`00000000-0000-4000-8000-00000000c0de`) with a per-run UUID and a teardown; seam 2 grants+removes a
  throwaway role on a reserved member; seam 3 archives its issue; seams 4–5 are read-only / build-only.
- **One credential SOT.** All creds come from `~/.gridwork/caisson.env` at run time (F6=A).
