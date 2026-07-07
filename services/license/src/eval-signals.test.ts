// eval-signals tests: the config loader (pure) + the RDAP/enrichment parsing and fail-closed
// behavior. DNS is stubbed (injected mxResolver) and `fetch` is mocked, so no real network.
import { afterEach, describe, expect, test } from "bun:test";
import {
  type EvalSignalsConfig,
  type MxResolver,
  loadEvalSignalsConfig,
  resolveDomainSignals,
} from "./eval-signals.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetch(
  handler: (url: string) => Response | Promise<Response>,
): void {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(url));
  }) as unknown as typeof fetch;
}

const CONFIG: EvalSignalsConfig = {
  rdapBaseUrl: "https://rdap.example",
  enrichmentUrl: "https://enrich.example/score",
  enrichmentToken: "secret",
  timeoutMs: 1000,
  dnsTries: 1,
};

const mxTrue: MxResolver = async () => true;

describe("loadEvalSignalsConfig", () => {
  test("defaults: features off, sane timeout", () => {
    const c = loadEvalSignalsConfig({});
    expect(c.rdapBaseUrl).toBe("");
    expect(c.enrichmentUrl).toBe("");
    expect(c.timeoutMs).toBe(4000);
  });
  test("accepts https URLs", () => {
    const c = loadEvalSignalsConfig({
      EVAL_RDAP_URL: "https://rdap.org",
      EVAL_ENRICHMENT_URL: "https://x.example",
    });
    expect(c.rdapBaseUrl).toBe("https://rdap.org");
  });
  test("rejects a non-https RDAP URL (security floor)", () => {
    expect(() =>
      loadEvalSignalsConfig({ EVAL_RDAP_URL: "http://rdap.org" }),
    ).toThrow();
  });
});

describe("resolveDomainSignals", () => {
  test("parses RDAP registration age + enrichment risk", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const registered = "2025-01-01T00:00:00.000Z"; // exactly 365 days before `now`
    mockFetch((url) => {
      if (url.includes("rdap.example")) {
        return Response.json({
          events: [{ eventAction: "registration", eventDate: registered }],
        });
      }
      return Response.json({ risk: 42 });
    });
    const s = await resolveDomainSignals("acme.io", CONFIG, now, mxTrue);
    expect(s.mx).toBe(true);
    expect(s.ageDays).toBe(365);
    expect(s.enrichmentRisk).toBe(42);
  });

  test("features off (empty URLs) ⇒ age + enrichment undefined, no fetch", async () => {
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      return Promise.reject(new Error("should not be called"));
    }) as unknown as typeof fetch;
    const off: EvalSignalsConfig = {
      ...CONFIG,
      rdapBaseUrl: "",
      enrichmentUrl: "",
    };
    const s = await resolveDomainSignals("acme.io", off, new Date(), mxTrue);
    expect(called).toBe(false);
    expect(s.ageDays).toBeUndefined();
    expect(s.enrichmentRisk).toBeUndefined();
    expect(s.mx).toBe(true);
  });

  test("fail-closed: a throwing fetch ⇒ age + enrichment undefined (never a pass)", async () => {
    mockFetch(() => {
      throw new Error("network down");
    });
    const s = await resolveDomainSignals("acme.io", CONFIG, new Date(), mxTrue);
    expect(s.ageDays).toBeUndefined();
    expect(s.enrichmentRisk).toBeUndefined();
  });

  test("fail-closed: RDAP 404 / missing registration event ⇒ age undefined", async () => {
    mockFetch((url) => {
      if (url.includes("rdap.example"))
        return new Response("nope", { status: 404 });
      return Response.json({ events: [] }); // enrichment endpoint stub (unused shape)
    });
    const s = await resolveDomainSignals("acme.io", CONFIG, new Date(), mxTrue);
    expect(s.ageDays).toBeUndefined();
  });

  test("clamps an out-of-range enrichment risk into 0..100", async () => {
    mockFetch((url) => {
      if (url.includes("rdap.example"))
        return new Response("x", { status: 404 });
      return Response.json({ risk: 250 });
    });
    const s = await resolveDomainSignals("acme.io", CONFIG, new Date(), mxTrue);
    expect(s.enrichmentRisk).toBe(100);
  });
});
