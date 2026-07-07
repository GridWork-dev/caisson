// Per-driver request-shape + fail-open + fail-closed-config tests. Each network driver has its outbound
// request captured through a mocked `fetch`; the round-trip asserted here is event -> the exact
// provider wire shape (endpoint, auth placement, body fields), so a mapping regression is caught.
import { afterEach, describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson/kernel";
import { createCaptureAnalytics, type AnalyticsEvent } from "./analytics.ts";
import { createGa4Analytics } from "./ga4.ts";
import { createPlausibleAnalytics } from "./plausible.ts";
import { createPostHogAnalytics } from "./posthog.ts";

const EVENT: AnalyticsEvent = {
  name: "add_to_cart",
  distinctId: "acct_9",
  url: "https://caisson.sh/marketplace",
  props: { module: "audit-worm" },
};

interface Captured {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

function mockFetch(status: number): { calls: Captured[]; fetch: typeof fetch } {
  const calls: Captured[] = [];
  const fn = (async (url: unknown, init?: unknown): Promise<Response> => {
    calls.push({ url: String(url), init: (init ?? {}) as Captured["init"] });
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { calls, fetch: fn };
}

function bodyOf(c: Captured): Record<string, unknown> {
  return JSON.parse(c.init.body ?? "{}") as Record<string, unknown>;
}

describe("capture driver", () => {
  test("records events in order, read-only", async () => {
    const a = createCaptureAnalytics();
    await a.capture(EVENT);
    await a.capture({ name: "checkout" });
    expect(a.captured.map((e) => e.name)).toEqual(["add_to_cart", "checkout"]);
  });
});

describe("Plausible driver", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("POSTs /api/event with name, url, domain, props + a User-Agent", async () => {
    const m = mockFetch(202);
    globalThis.fetch = m.fetch;
    await createPlausibleAnalytics({ domain: "caisson.sh" }).capture(EVENT);

    expect(m.calls[0]?.url).toBe("https://plausible.io/api/event");
    expect(m.calls[0]?.init.headers?.["user-agent"]).toContain("caisson");
    expect(bodyOf(m.calls[0] as Captured)).toEqual({
      name: "add_to_cart",
      url: "https://caisson.sh/marketplace",
      domain: "caisson.sh",
      props: { module: "audit-worm" },
    });
  });

  test("defaults url to the site root when the event carries none", async () => {
    const m = mockFetch(202);
    globalThis.fetch = m.fetch;
    await createPlausibleAnalytics({ domain: "caisson.sh" }).capture({
      name: "pageview",
    });
    expect(bodyOf(m.calls[0] as Captured).url).toBe("https://caisson.sh/");
  });

  test("honors a self-hosted apiHost", async () => {
    const m = mockFetch(202);
    globalThis.fetch = m.fetch;
    await createPlausibleAnalytics({
      domain: "caisson.sh",
      apiHost: "https://plausible.internal/",
    }).capture(EVENT);
    expect(m.calls[0]?.url).toBe("https://plausible.internal/api/event");
  });

  test("throws ConfigError on an empty domain", () => {
    expect(() => createPlausibleAnalytics({ domain: "" })).toThrow(ConfigError);
  });
});

describe("PostHog driver", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("POSTs /capture/ with api_key + event + distinct_id in the body", async () => {
    const m = mockFetch(200);
    globalThis.fetch = m.fetch;
    await createPostHogAnalytics({ apiKey: "phc_abc" }).capture(EVENT);

    expect(m.calls[0]?.url).toBe("https://us.i.posthog.com/capture/");
    const body = bodyOf(m.calls[0] as Captured);
    expect(body.api_key).toBe("phc_abc");
    expect(body.event).toBe("add_to_cart");
    expect(body.distinct_id).toBe("acct_9");
    expect(body.properties).toEqual({
      module: "audit-worm",
      $current_url: "https://caisson.sh/marketplace",
    });
  });

  test("uses the server sentinel distinct_id when the event carries none", async () => {
    const m = mockFetch(200);
    globalThis.fetch = m.fetch;
    await createPostHogAnalytics({ apiKey: "phc_abc" }).capture({
      name: "ping",
    });
    expect(bodyOf(m.calls[0] as Captured).distinct_id).toBe("server");
  });

  test("throws ConfigError on an empty apiKey", () => {
    expect(() => createPostHogAnalytics({ apiKey: "" })).toThrow(ConfigError);
  });
});

describe("GA4 driver", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("POSTs /mp/collect with measurement_id + api_secret in the query and one event", async () => {
    const m = mockFetch(204);
    globalThis.fetch = m.fetch;
    await createGa4Analytics({
      measurementId: "G-XYZ",
      apiSecret: "shh",
    }).capture(EVENT);

    const url = new URL(m.calls[0]?.url ?? "");
    expect(url.origin + url.pathname).toBe(
      "https://www.google-analytics.com/mp/collect",
    );
    expect(url.searchParams.get("measurement_id")).toBe("G-XYZ");
    expect(url.searchParams.get("api_secret")).toBe("shh");
    expect(bodyOf(m.calls[0] as Captured)).toEqual({
      client_id: "acct_9",
      events: [
        {
          name: "add_to_cart",
          params: {
            module: "audit-worm",
            page_location: "https://caisson.sh/marketplace",
          },
        },
      ],
    });
  });

  test("throws ConfigError when measurementId or apiSecret is empty", () => {
    expect(() =>
      createGa4Analytics({ measurementId: "", apiSecret: "shh" }),
    ).toThrow(ConfigError);
    expect(() =>
      createGa4Analytics({ measurementId: "G-XYZ", apiSecret: "" }),
    ).toThrow(ConfigError);
  });
});

describe("fail-open reporting", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("a non-2xx response is reported via onError, not thrown", async () => {
    const m = mockFetch(503);
    globalThis.fetch = m.fetch;
    const seen: string[] = [];
    await createPostHogAnalytics({
      apiKey: "phc_abc",
      onError: (d) => seen.push(d),
    }).capture(EVENT);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("503");
  });
});
