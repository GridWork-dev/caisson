# @caisson-sh/alerting

A SOC2 CC7.2 multi-channel alerting pipeline — the concrete "anomaly detection and timely
notification" control primitive. ADR-0135 (pipeline) · ADR-0151 (transport).

## What it gives you

- **Five-stage pipeline**, pure where possible, injected `now`: **dedup** (suppress a repeat while
  an incident sharing its `dedupeKey` is open) → **rate-cap + digest** (per-recipient cap, digest
  fallback once the recent count hits the policy) → **IANA-timezone quiet hours** (via stdlib
  `Intl`, no tz dependency; a `critical` event always overrides) → **multi-channel delivery** →
  **structured audit log**.
- **One `AlertChannel` port, five drivers.** Capture (in-memory, tests), Email (delegates to the
  injected `@caisson-sh/email` `Emailer` — no second email path), Webhook (+ optional HMAC signing),
  Slack, Telegram. Every network driver is injected config + `fetchWithTimeout` + a
  `@caisson-sh/kernel` typed error on non-ok **without the response body**. `deliverAll` runs every
  channel and isolates a failing one — the rest still deliver.
- **A data-only `EventTypeRegistry`** (`eventType -> { defaultSeverity, channels, ratePolicy }`) —
  a small seed, not the full 12-type reference; extend per real usage.
- **Plain-Postgres audit logging**, explicitly **NOT** hash-chained WORM — see
  `src/migrations/0001_alert_audit.sql`. `@caisson-sh/audit-worm` owns tamper-evidence; this owns
  "what happened and why", one row per outcome.

## Entry points

- `.` — the full surface, including the five network delivery drivers (node-capable).
- `./browser` — the event contract, all three decision stages, the delivery port with its isolation
  wrapper and capture driver, the audit port with its in-memory driver, and `processAlert` itself:
  safe inside a client bundle. The network drivers are deliberately absent (a browser cannot hold a
  webhook signing secret, and the SSRF re-check resolves DNS). Every name on `./browser` is also
  on `.`.

## Use

```ts
import {
  processAlert,
  createCaptureChannel,
  createEmailChannel,
  createWebhookChannel,
  createInMemoryAuditSink,
} from "@caisson-sh/alerting";

const result = await processAlert(event, {
  openIncidents, // { dedupeKey }[] — from your incident store
  recentCount, // this recipient's sends in the current rate-cap window
  ratePolicy: { maxPerWindow: 5 },
  recipientTz: "America/New_York",
  quietPolicy: { startHour: 22, endHour: 7 },
  now: new Date(),
  channels: [createEmailChannel(emailer), createWebhookChannel({ url })],
  auditSink: createInMemoryAuditSink(), // or a Postgres-backed AlertAuditSink
});
// result.outcome: "delivered" | "suppressed" | "held" | "digested"
```

## Drivers

| Channel  | Factory                         | Transport                                               |
| -------- | ------------------------------- | ------------------------------------------------------- |
| Capture  | `createCaptureChannel()`        | In-memory; test-only.                                   |
| Email    | `createEmailChannel(emailer)`   | Delegates to an injected `@caisson-sh/email` `Emailer`. |
| Webhook  | `createWebhookChannel(config)`  | `fetchWithTimeout` POST; optional HMAC signature.       |
| Slack    | `createSlackChannel(config)`    | `fetchWithTimeout` POST to an incoming-webhook URL.     |
| Telegram | `createTelegramChannel(config)` | `fetchWithTimeout` POST to a bot-API `sendMessage`.     |

## Tests

`bun test packages/alerting/src` — dedup suppression, the rate-cap boundary, quiet-hours hold +
critical override, capture-channel delivery recording, `deliverAll` per-channel isolation, and
`processAlert` audit-row outcomes (delivered/suppressed/digested/held). No live network — capture
drivers only.
