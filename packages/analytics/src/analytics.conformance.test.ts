// Shared port-conformance harness: loops every `AnalyticsProvider` driver and asserts each satisfies
// the one-method port AND honors the fail-open contract — `capture` resolves whether the network
// succeeds, returns a non-2xx, or throws outright. New drivers extend the `drivers` array below.
import { afterEach, describe, expect, test } from "bun:test";
import {
  createCaptureAnalytics,
  type AnalyticsEvent,
  type AnalyticsProvider,
} from "./analytics.ts";
import { createGa4Analytics } from "./ga4.ts";
import { createPlausibleAnalytics } from "./plausible.ts";
import { createPostHogAnalytics } from "./posthog.ts";

const EVENT: AnalyticsEvent = {
  name: "signup_complete",
  distinctId: "acct_123",
  url: "https://caisson.sh/pricing",
  props: { plan: "compliance" },
};

const silent = (): void => {};

function fetchWith(status: number): typeof fetch {
  return (async (): Promise<Response> =>
    new Response(null, { status })) as unknown as typeof fetch;
}

function throwingFetch(): typeof fetch {
  return (async (): Promise<Response> => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
}

// Each network driver is built with an injected silent `onError` so a deliberately-failing fetch does
// not spam stderr during the suite. The capture driver ignores it.
const drivers: ReadonlyArray<[string, () => AnalyticsProvider]> = [
  ["capture", () => createCaptureAnalytics()],
  [
    "plausible",
    () => createPlausibleAnalytics({ domain: "caisson.sh", onError: silent }),
  ],
  [
    "posthog",
    () => createPostHogAnalytics({ apiKey: "phc_test", onError: silent }),
  ],
  [
    "ga4",
    () =>
      createGa4Analytics({
        measurementId: "G-TEST",
        apiSecret: "secret",
        onError: silent,
      }),
  ],
];

describe("AnalyticsProvider port conformance", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  for (const [name, build] of drivers) {
    test(`${name} satisfies the port (capture resolves on a 2xx)`, async () => {
      globalThis.fetch = fetchWith(202);
      const provider = build();
      expect(typeof provider.capture).toBe("function");
      await expect(provider.capture(EVENT)).resolves.toBeUndefined();
    });

    test(`${name} fails open on a non-2xx response (still resolves)`, async () => {
      globalThis.fetch = fetchWith(500);
      await expect(build().capture(EVENT)).resolves.toBeUndefined();
    });

    test(`${name} fails open when fetch throws (still resolves)`, async () => {
      globalThis.fetch = throwingFetch();
      await expect(build().capture(EVENT)).resolves.toBeUndefined();
    });
  }
});
