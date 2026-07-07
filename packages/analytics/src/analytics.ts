// Provider-agnostic SERVER-SIDE analytics capture. The `AnalyticsProvider` port has one method —
// `capture(event)` — and four drivers: a capture driver (records events in memory for tests — never
// touches the network) and Plausible / PostHog / GA4 drivers (prod) that POST via `fetchWithTimeout`
// (ADR-0002) and read their credentials from injected config — no provider key in code.
//
// This is the SERVER-SIDE contract (a backend/queue/webhook recording an event), NOT a browser
// snippet — `apps/site` keeps its own client-side Plausible/PostHog init for page-level tracking.
//
// FAIL-OPEN by design: analytics must never break the caller, so `capture` never rejects. A network
// error or a non-2xx response is caught and reported through `onError` (default: a single stderr
// line) instead of propagating. This is the deliberate inverse of the email/jobs drivers, which
// fail CLOSED — a dropped analytics event is acceptable; a dropped email or job is not.

/** One server-side analytics event. `name` is the event/goal name (or `"pageview"`). */
export interface AnalyticsEvent {
  name: string;
  /** Visitor/user id. Required by PostHog (distinct_id) + GA4 (client_id); ignored by Plausible. */
  distinctId?: string;
  /** The page URL the event is attributed to. Plausible pageviews need it; the others fold it into props. */
  url?: string;
  props?: Record<string, string | number | boolean>;
}

/** The port: one method, provider-agnostic, the only seam callers depend on. Never rejects (fail-open). */
export interface AnalyticsProvider {
  capture(event: AnalyticsEvent): Promise<void>;
}

/** A test driver that records every captured event in memory for assertions. */
export interface CaptureAnalyticsProvider extends AnalyticsProvider {
  readonly captured: readonly AnalyticsEvent[];
}

/**
 * In-memory `AnalyticsProvider` for tests + the framework-agnostic reference. Records each event into
 * a private array exposed read-only via `captured` (preserving order); never hits the network.
 */
export function createCaptureAnalytics(): CaptureAnalyticsProvider {
  const captured: AnalyticsEvent[] = [];
  return {
    async capture(event: AnalyticsEvent): Promise<void> {
      captured.push(event);
    },
    get captured(): readonly AnalyticsEvent[] {
      return captured;
    },
  };
}

/** A failure sink for the fail-open path. Callers may inject one; the default writes one stderr line. */
export type AnalyticsErrorReporter = (detail: string) => void;

/** Build a reporter that prefixes the provider name; the default sink is a single `process.stderr` line
 *  (no `console` in product code — matching the registry builder's stderr convention). */
export function makeReporter(
  provider: string,
  onError: AnalyticsErrorReporter | undefined,
): AnalyticsErrorReporter {
  if (onError !== undefined) return onError;
  return (detail: string): void => {
    process.stderr.write(`[analytics:${provider}] capture failed: ${detail}\n`);
  };
}

/**
 * Run one capture body fail-open: any thrown error is stringified and reported, never re-thrown, so
 * the returned promise always resolves. A non-2xx response is NOT a throw (fetch resolves it) — each
 * driver checks `res.ok` itself and calls `report` on a non-ok status before returning here.
 */
export async function captureFailOpen(
  report: AnalyticsErrorReporter,
  body: () => Promise<void>,
): Promise<void> {
  try {
    await body();
  } catch (err) {
    report(err instanceof Error ? err.message : String(err));
  }
}
