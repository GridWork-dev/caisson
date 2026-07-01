# ADR-0151 — `@caisson/alerting` transport: four channels behind one `AlertChannel` port

Status: accepted · 2026-07-01 (Stage-2 Stream B, operator fork-lock) · implements the
`multi-channel delivery` stage of ADR-0135's alerting pipeline · builds under ADR-0150. Append-only;
supersede with a later ADR, never edit.

## Context

ADR-0135 locks `@caisson/alerting` as a five-stage SOC2 CC7.2 pipeline (dedup → rate-cap+digest →
IANA-tz quiet-hours → **multi-channel delivery** → structured audit log) but leaves the _transport_
open. The Stream B SPEC surfaced three options: email+webhook only (rec), all four channels now, or
webhook+capture only. The operator locked **all four channels now**.

## Decision

Delivery is a single `AlertChannel` port — `{ name: string; deliver(alert): Promise<DeliveryResult> }`
— with **four production drivers plus a capture driver**:

1. **Email** — wraps the shipped `@caisson/email` `Emailer` port (no re-implementation).
2. **Webhook** — POSTs the alert JSON via `fetchWithTimeout`; injected URL + optional HMAC signing
   header (`crypto.timingSafeEqual` never applies here — signing is outbound; the secret is injected).
3. **Slack** — POSTs a Slack-shaped message to an injected incoming-webhook URL via `fetchWithTimeout`.
4. **Telegram** — POSTs `sendMessage` to the injected bot-API URL + chat id via `fetchWithTimeout`.
5. **Capture** — records deliveries in memory for tests; never touches the network (the `email.ts`
   capture-driver idiom).

All four network drivers read their endpoint/token from **injected config** (never module constants),
route every outbound call through `fetchWithTimeout`, and throw a `@caisson/kernel` typed error
**without the upstream response body** (it can echo recipient/token fragments — the `email.ts` rule).
Slack and Telegram need **no SDK** — both are a single authenticated `fetchWithTimeout` POST, so the
zero-new-dep rule of ADR-0150 holds. Per-channel delivery is error-isolated: one failing channel is
recorded in the `DeliveryResult` and does not abort the others.

## Why

- **One port, four thin drivers** — the port makes the four channels (and future ones) uniform; each
  driver is a few lines over `fetchWithTimeout`, so building all four now costs little and matches the
  operator's lock.
- **Reuse `@caisson/email`** rather than a second email path — it already owns the Resend/capture split
  and the no-body-leak discipline.
- **No SDKs** keeps ADR-0150's single-install invariant intact — Slack/Telegram are plain webhook POSTs.

## Rejected

- **email + webhook only (SPEC rec)** — the operator chose the fuller channel set now.
- **Pull in `@slack/web-api` / a Telegram SDK** — rejected; both channels are one `fetchWithTimeout`
  POST, and an SDK would break ADR-0150's zero-new-dep parallel-build invariant.

## Relations

Implements ADR-0135 (alerting pipeline). Composes ADR-0018 (`@caisson/email` port) and ADR-0002
(`fetchWithTimeout`, typed errors, no-leak). Builds under ADR-0150.

## Binding

`@caisson/alerting` ships email + webhook + Slack + Telegram + capture drivers behind one
`AlertChannel` port, all config-injected, all via `fetchWithTimeout`, all no-body-leak, all
error-isolated, zero new external deps. Adding/removing a channel family requires a superseding ADR.

Evidence: `docs/state/stage2-stream-b-spec.md` §B2 + Fork 2; `packages/email/src/email.ts`; the
2026-07-01 operator fork-lock.
