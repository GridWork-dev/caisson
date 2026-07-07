# @caisson/analytics — agent usage note

Provides the provider-agnostic **server-side** analytics port: a one-method `AnalyticsProvider`
interface, an in-memory capture driver, and Plausible / PostHog / GA4 production drivers.

## Key surface

- Import the `AnalyticsProvider` port and `capture(event)` server-side events (a backend, queue
  handler, or webhook recording an event) through it — this is NOT a browser snippet; `apps/site`
  keeps its own client-side page tracking.
- Use `createCaptureAnalytics()` in tests; swap a real driver in production via
  `createPlausibleAnalytics` / `createPostHogAnalytics` / `createGa4Analytics` — same port,
  dependency-injected config (`domain` / `apiKey` / `measurementId`+`apiSecret` sourced from env by
  the caller, never a module constant). Tests mock `fetch`, so the suite never touches the network.
- `capture` is **fail-open**: it never rejects. A failure is reported via the optional `onError`
  sink, never thrown — a dropped analytics event must never break the caller.

## Scope

Server-side event capture and the provider-port abstraction only. Page-level browser tracking
belongs in `apps/site`; product dashboards / funnels belong in the PostHog project itself.
