// Plausible server-side driver for the `AnalyticsProvider` port. POSTs the Events API
// (`/api/event`) via `fetchWithTimeout` (ADR-0002). Config is injected — the package never reads
// `PLAUSIBLE_*` env itself; the caller env-gates and passes `domain` (+ optional self-hosted host).
// Fail-open: a network error or a non-2xx status is reported, never thrown (see `captureFailOpen`).
//
// Plausible's Events API needs no API key. It DOES require a `User-Agent` header (it drops requests
// without one and uses it to filter bots) and a full `url` — a server-side event with no page URL
// defaults to the site root.
import { ConfigError, fetchWithTimeout } from "@caisson/kernel";
import {
  type AnalyticsErrorReporter,
  type AnalyticsEvent,
  type AnalyticsProvider,
  captureFailOpen,
  makeReporter,
} from "./analytics.ts";

export interface PlausibleConfig {
  /** The Plausible site id (the `domain` registered in Plausible), e.g. `caisson.sh`. */
  domain: string;
  /** Self-hosted / EU host base; defaults to Plausible Cloud. */
  apiHost?: string;
  /** Server-side `User-Agent` (Plausible requires one). Defaults to a static Caisson UA. */
  userAgent?: string;
  onError?: AnalyticsErrorReporter;
}

const DEFAULT_HOST = "https://plausible.io";
const DEFAULT_UA = "caisson-analytics/1.0 (+https://caisson.sh)";

/**
 * Production `AnalyticsProvider` backed by Plausible. Fails CLOSED at construction (`ConfigError`)
 * when `domain` is missing — a config bug is distinct from the runtime fail-open path.
 */
export function createPlausibleAnalytics(
  config: PlausibleConfig,
): AnalyticsProvider {
  if (config.domain.length === 0) {
    throw new ConfigError("createPlausibleAnalytics requires `domain`");
  }
  const host = (config.apiHost ?? DEFAULT_HOST).replace(/\/+$/, "");
  const userAgent = config.userAgent ?? DEFAULT_UA;
  const report = makeReporter("plausible", config.onError);
  const endpoint = `${host}/api/event`;

  return {
    async capture(event: AnalyticsEvent): Promise<void> {
      await captureFailOpen(report, async () => {
        const res = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": userAgent,
          },
          body: JSON.stringify({
            name: event.name,
            url: event.url ?? `https://${config.domain}/`,
            domain: config.domain,
            ...(event.props ? { props: event.props } : {}),
          }),
        });
        if (!res.ok) {
          report(`Plausible responded ${res.status}`);
        }
      });
    },
  };
}
