import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { withRequestSpan } from "./request-span.ts";

let exporter: InMemorySpanExporter;
let provider: BasicTracerProvider;

beforeEach(() => {
  // Another test file in this same bun-test process (observability.test.ts) may already have
  // registered a global tracer provider — the OTel API refuses a second registration unless the
  // first is disabled, so force a clean slate before installing this suite's provider.
  trace.disable();
  exporter = new InMemorySpanExporter();
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
});

afterEach(async () => {
  trace.disable();
  await provider.shutdown();
});

describe("withRequestSpan", () => {
  test("emits one span with method/route/status attributes", async () => {
    const handler = withRequestSpan(
      async () => new Response("ok", { status: 200 }),
    );
    const res = await handler(
      new Request("http://x.test/query", { method: "POST" }),
    );
    expect(res.status).toBe(200);

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe("POST /query");
    expect(span?.attributes["http.request.method"]).toBe("POST");
    expect(span?.attributes["http.route"]).toBe("/query");
    expect(span?.attributes["http.response.status_code"]).toBe(200);
  });

  test("scrubs a raw path with an id segment out of the span name and http.route", async () => {
    const handler = withRequestSpan(
      async () => new Response("ok", { status: 200 }),
    );
    await handler(
      new Request("http://x.test/users/3fa85f64-5717-4562-b3fc-2c963f66afa6"),
    );
    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe("GET /users/:id");
    expect(span?.attributes["http.route"]).toBe("/users/:id");
  });

  test("uses the caller's routeTemplate verbatim over the raw path", async () => {
    const handler = withRequestSpan(
      async () => new Response("ok", { status: 200 }),
      "/users/:id",
    );
    await handler(new Request("http://x.test/users/48291"));
    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe("GET /users/:id");
    expect(span?.attributes["http.route"]).toBe("/users/:id");
  });

  test("/health is never wrapped in a span", async () => {
    const handler = withRequestSpan(async () => new Response("ok"));
    await handler(new Request("http://x.test/health"));
    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  test("a thrown handler error is recorded on the span and rethrown", async () => {
    const handler = withRequestSpan(async () => {
      throw new Error("boom");
    });
    await expect(handler(new Request("http://x.test/issue"))).rejects.toThrow(
      "boom",
    );
    const [span] = exporter.getFinishedSpans();
    expect(span?.status.code).toBe(2); // SpanStatusCode.ERROR
    expect(span?.events.some((e) => e.name === "exception")).toBe(true);
  });

  test("a 5xx response marks the span as ERROR without throwing", async () => {
    const handler = withRequestSpan(
      async () => new Response("fail", { status: 500 }),
    );
    const res = await handler(new Request("http://x.test/webhook"));
    expect(res.status).toBe(500);
    const [span] = exporter.getFinishedSpans();
    expect(span?.status.code).toBe(2); // SpanStatusCode.ERROR
  });
});
