// PostHog server-side driver for the `AnalyticsProvider` port. POSTs the capture API (`/capture/`)
// via `fetchWithTimeout` (ADR-0002). The project API key is injected config — never a module-level
// constant. Fail-open: a network error or a non-2xx status is reported, never thrown.
//
// PostHog's capture endpoint takes the project key IN THE BODY (`api_key`), not an Authorization
// header, and requires a `distinct_id` — a server-side event with no user id uses a stable
// `"server"` sentinel so the events still land against a consistent identity.
import { ConfigError, fetchWithTimeout } from "@caisson/kernel";
import {
  type AnalyticsErrorReporter,
  type AnalyticsEvent,
  type AnalyticsProvider,
  captureFailOpen,
  makeReporter,
} from "./analytics.ts";

export interface PostHogConfig {
  /** The PostHog PROJECT API key (`phc_...`) — safe to embed server-side, still injected not read. */
  apiKey: string;
  /** Ingestion host; defaults to PostHog US Cloud. EU / self-host set this explicitly. */
  apiHost?: string;
  onError?: AnalyticsErrorReporter;
}

const DEFAULT_HOST = "https://us.i.posthog.com";
const SERVER_DISTINCT_ID = "server";

/**
 * Production `AnalyticsProvider` backed by PostHog. Fails CLOSED at construction (`ConfigError`)
 * when `apiKey` is missing.
 */
export function createPostHogAnalytics(
  config: PostHogConfig,
): AnalyticsProvider {
  if (config.apiKey.length === 0) {
    throw new ConfigError("createPostHogAnalytics requires `apiKey`");
  }
  const host = (config.apiHost ?? DEFAULT_HOST).replace(/\/+$/, "");
  const report = makeReporter("posthog", config.onError);
  const endpoint = `${host}/capture/`;

  return {
    async capture(event: AnalyticsEvent): Promise<void> {
      await captureFailOpen(report, async () => {
        // url is folded into properties as PostHog's `$current_url` when present.
        const properties: Record<string, string | number | boolean> = {
          ...(event.props ?? {}),
          ...(event.url !== undefined ? { $current_url: event.url } : {}),
        };
        const res = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            api_key: config.apiKey,
            event: event.name,
            distinct_id: event.distinctId ?? SERVER_DISTINCT_ID,
            ...(Object.keys(properties).length > 0 ? { properties } : {}),
          }),
        });
        if (!res.ok) {
          report(`PostHog responded ${res.status}`);
        }
      });
    },
  };
}
