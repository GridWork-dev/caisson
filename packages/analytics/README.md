# @caisson/analytics

Provider-agnostic **server-side** analytics port: a vendor-neutral `AnalyticsProvider`
interface with an in-memory capture driver and production drivers for Plausible, PostHog,
and GA4.

- **Layer:** base

## Install

```bash
bun add @caisson/analytics
```

## Drivers

- `createCaptureAnalytics` — synchronous in-memory test/reference driver. No network.
- `createPlausibleAnalytics` — Plausible Events API (`/api/event`). Injected `domain`.
- `createPostHogAnalytics` — PostHog capture API (`/capture/`). Injected project `apiKey`.
- `createGa4Analytics` — GA4 Measurement Protocol (`/mp/collect`). Injected `measurementId` + `apiSecret`.

Each production driver is env-gated by the caller (config is injected, never read from
`process.env` inside the package) and routes every call through `fetchWithTimeout`.

## Fail-open

`capture` **never throws into the caller** — analytics must not break the surface it
measures. A network error or a non-2xx response is reported through the optional `onError`
sink (default: a single stderr line) instead of propagating. This is the deliberate inverse
of `@caisson/email` / `@caisson/jobs`, which fail closed.
