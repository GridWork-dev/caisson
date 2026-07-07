// Google Analytics 4 (Measurement Protocol) server-side driver for the `AnalyticsProvider` port.
// POSTs `/mp/collect` via `fetchWithTimeout` (ADR-0002). The measurement id + api secret are injected
// config — never module constants. Fail-open: a network error or a non-2xx status is reported,
// never thrown.
//
// The Measurement Protocol authenticates via the `api_secret` + `measurement_id` QUERY params, takes
// one or more `events` in the body, and requires a `client_id` — a server-side event with no id uses
// a stable `"server"` sentinel. GA4 returns 204 on accept and does NOT validate payloads on the
// production endpoint (use `/debug/mp/collect` for validation) — so `res.ok` is the only signal here.
import { ConfigError, fetchWithTimeout } from "@caisson/kernel";
import {
  type AnalyticsErrorReporter,
  type AnalyticsEvent,
  type AnalyticsProvider,
  captureFailOpen,
  makeReporter,
} from "./analytics.ts";

export interface Ga4Config {
  /** The GA4 data stream Measurement ID (`G-XXXXXXXX`). */
  measurementId: string;
  /** The Measurement Protocol API secret for that stream. */
  apiSecret: string;
  /** Override the collect endpoint (e.g. `/debug/mp/collect` for validation). */
  endpoint?: string;
  onError?: AnalyticsErrorReporter;
}

const DEFAULT_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const SERVER_CLIENT_ID = "server";

/**
 * Production `AnalyticsProvider` backed by GA4 Measurement Protocol. Fails CLOSED at construction
 * (`ConfigError`) when `measurementId` or `apiSecret` is missing.
 */
export function createGa4Analytics(config: Ga4Config): AnalyticsProvider {
  if (config.measurementId.length === 0 || config.apiSecret.length === 0) {
    throw new ConfigError(
      "createGa4Analytics requires `measurementId` and `apiSecret`",
    );
  }
  const base = config.endpoint ?? DEFAULT_ENDPOINT;
  const report = makeReporter("ga4", config.onError);
  const url = `${base}?measurement_id=${encodeURIComponent(
    config.measurementId,
  )}&api_secret=${encodeURIComponent(config.apiSecret)}`;

  return {
    async capture(event: AnalyticsEvent): Promise<void> {
      await captureFailOpen(report, async () => {
        const params: Record<string, string | number | boolean> = {
          ...(event.props ?? {}),
          ...(event.url !== undefined ? { page_location: event.url } : {}),
        };
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: event.distinctId ?? SERVER_CLIENT_ID,
            events: [{ name: event.name, params }],
          }),
        });
        if (!res.ok) {
          report(`GA4 responded ${res.status}`);
        }
      });
    },
  };
}
