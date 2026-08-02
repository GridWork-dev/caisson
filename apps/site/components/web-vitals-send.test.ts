// Beacon-path coverage for the lazy half of the web-vitals pair. The library itself is mocked:
// its reporters only fire off real PerformanceObserver entries, which never exist outside a
// browser, so the mock captures the callbacks and this file drives them directly. That leaves the
// bits that ARE ours under test — the env gate, the batch key shape PostHog's built-in Web Vitals
// dashboard reads, and the flush-exactly-once contract.
//
// `mock.module` is process-wide and never torn down; this is the only web-vitals consumer in the
// site test run, so a bare factory (no real-module spread) is safe here.
import { afterEach, expect, mock, test } from "bun:test";
import type { Metric } from "web-vitals";

const reporters: ((metric: Metric) => void)[] = [];
const register = (cb: (metric: Metric) => void): void =>
  void reporters.push(cb);
mock.module("web-vitals", () => ({
  onCLS: register,
  onFCP: register,
  onINP: register,
  onLCP: register,
  onTTFB: register,
}));

const { startWebVitals } = await import("./web-vitals-send.ts");

const KEY_VAR = "NEXT_PUBLIC_POSTHOG_KEY";
const HOST_VAR = "NEXT_PUBLIC_POSTHOG_HOST";

/** v6 metric shape — `navigationId` is required as of web-vitals 6, so this fixture doubles as a
 * compile-time pin on the major we are on. */
function metric(
  name: Metric["name"],
  value: number,
  rating: Metric["rating"],
): Metric {
  return {
    name,
    value,
    rating,
    delta: value,
    id: `v6-${name}`,
    entries: [],
    navigationType: "navigate",
    navigationId: 1,
  };
}

interface Browser {
  beacons: { url: string; body: string }[];
  fire: (type: string) => void;
  hide: () => void;
}

const GLOBAL_KEYS = ["document", "window", "navigator"] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();

/** Minimal stand-ins for the three browser globals this module touches — no jsdom needed, the unit
 * under test is a batch-and-beacon closure, not a DOM tree. */
function stubBrowser(): Browser {
  const beacons: { url: string; body: string }[] = [];
  const listeners = new Map<string, (() => void)[]>();
  const addEventListener = (type: string, fn: () => void): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  };

  const documentStub = { addEventListener, visibilityState: "visible" };
  const values: Record<string, unknown> = {
    document: documentStub,
    window: {
      addEventListener,
      location: {
        href: "https://caisson.sh/pricing?ref=x",
        pathname: "/pricing",
      },
    },
    navigator: {
      sendBeacon: (url: string, body: string): boolean => {
        beacons.push({ url, body });
        return true;
      },
    },
  };

  for (const key of GLOBAL_KEYS) {
    if (!saved.has(key)) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    }
    Object.defineProperty(globalThis, key, {
      value: values[key],
      configurable: true,
      writable: true,
    });
  }
  return {
    beacons,
    fire: (type) => (listeners.get(type) ?? []).forEach((f) => f()),
    hide: () => {
      documentStub.visibilityState = "hidden";
    },
  };
}

afterEach(() => {
  reporters.length = 0;
  for (const key of GLOBAL_KEYS) {
    const descriptor = saved.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  saved.clear();
  delete process.env[KEY_VAR];
  delete process.env[HOST_VAR];
});

test("registers all five reporters and beacons the batch once at pagehide", () => {
  process.env[KEY_VAR] = "phc_test";
  process.env[HOST_VAR] = "https://ph.example";
  const browser = stubBrowser();

  startWebVitals();
  expect(reporters).toHaveLength(5);

  reporters[0]!(metric("LCP", 1234.5, "good"));
  reporters[1]!(metric("CLS", 0.42, "poor"));
  expect(browser.beacons).toHaveLength(0); // nothing sent until the page is hidden

  browser.fire("pagehide");
  expect(browser.beacons).toHaveLength(1);

  const [beacon] = browser.beacons;
  expect(beacon!.url).toBe("https://ph.example/capture/");
  const payload = JSON.parse(beacon!.body) as {
    api_key: string;
    event: string;
    distinct_id: string;
    properties: Record<string, unknown>;
  };
  expect(payload.api_key).toBe("phc_test");
  expect(payload.event).toBe("$web_vitals");
  expect(payload.distinct_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(payload.properties).toMatchObject({
    $web_vitals_LCP_value: 1234.5,
    $web_vitals_LCP_rating: "good",
    $web_vitals_CLS_value: 0.42,
    $web_vitals_CLS_rating: "poor",
    $process_person_profile: false,
    $pathname: "/pricing",
    $lib: "caisson-web-vitals",
  });
});

test("flushes on visibilitychange->hidden, and a later pagehide does not double-send", () => {
  process.env[KEY_VAR] = "phc_test";
  process.env[HOST_VAR] = "https://ph.example";
  const browser = stubBrowser();

  startWebVitals();
  reporters[0]!(metric("LCP", 1234.5, "good"));

  // visibilityState stays "visible" here, so the handler must not flush yet.
  browser.fire("visibilitychange");
  expect(browser.beacons).toHaveLength(0);

  browser.hide();
  browser.fire("visibilitychange");
  expect(browser.beacons).toHaveLength(1); // hidden path actually flushed

  browser.fire("pagehide");
  expect(browser.beacons).toHaveLength(1); // no double-send
});

test("sends nothing when no metric was ever recorded", () => {
  process.env[KEY_VAR] = "phc_test";
  const browser = stubBrowser();

  startWebVitals();
  browser.fire("pagehide");
  expect(browser.beacons).toHaveLength(0);
});

test("env gate: no PostHog key means no reporter is ever registered", () => {
  delete process.env[KEY_VAR];
  stubBrowser();

  startWebVitals();
  expect(reporters).toHaveLength(0);
});
