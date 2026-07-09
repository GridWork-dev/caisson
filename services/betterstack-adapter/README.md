# Better Stack → Discord adapter (CAISSON-53)

A minimal, stateless Cloudflare Worker. Better Stack's Uptime plan sends outgoing webhooks
natively to email/Slack only; this Worker receives Better Stack's "Incident" outgoing webhook,
validates + optionally authenticates it, and reshapes it into a Discord embed POST — so uptime
alerts land in the same ops Discord channel as the job/watcher alerts wired the same wave
(`packages/alerting`'s `createDiscordChannel`, `services/jobs`/`services/intel` job- and
watcher-failure alerting).

## Deploy

```bash
cd services/betterstack-adapter
bunx wrangler secret put DISCORD_OPS_WEBHOOK_URL
bunx wrangler secret put BETTERSTACK_WEBHOOK_SECRET   # required — see "Wire it to Better Stack" below
bunx wrangler deploy
```

## Wire it to Better Stack

1. In Better Stack: **Uptime → Integrations → Exporting data → Outgoing webhooks → Configure**.
2. Trigger type: **Incident**. Webhook URL: this Worker's `workers.dev` URL (or a custom domain,
   wired the same way `registry/worker/wrangler.toml` attaches one).
3. Better Stack does **not** sign outgoing webhooks (confirmed:
   <https://betterstack.com/docs/errors/integrations/outgoing-webhooks/> — "Webhook requests are
   not signed. Set up Basic HTTP authentication or add a custom header with a secret value and
   check it on your server."). Under **Advanced settings → Headers**, add a custom header:
   `X-Betterstack-Secret: <the same value as BETTERSTACK_WEBHOOK_SECRET>`.
4. Leave the default request body template — this Worker parses Better Stack's default
   `incident_change` JSON shape (see `handler.ts`'s module doc for the confirmed field list +
   source URLs).

**Fails closed:** a deployed Worker with `BETTERSTACK_WEBHOOK_SECRET` unset rejects every request
(401) — a public `workers_dev` endpoint with no secret configured must refuse traffic, not accept
it silently. For local testing only, set `ALLOW_UNAUTHENTICATED` (any non-empty value) to opt out
of the check; never set it on a real deploy.

## Payload

Validated against Better Stack's own documented `incident_change` webhook shape. The inner
`attributes` object is deliberately **not** `.strict()` — Better Stack's real payload carries
many more fields than this adapter reads (`team_name`, `incident_group_id`, `metadata`,
`screenshot_url`, …), and a `.strict()` provider-webhook envelope has broken real deliveries in
this repo before (every field Better Stack adds later must stay ignorable, not a 400).

## Local test

```bash
bun test handler.test.ts
```
