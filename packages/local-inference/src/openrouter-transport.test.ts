// Unit tests for the OpenRouter rented transport (ADR-0201 §2). NO NETWORK, no
// global stubs: the injection seam is the guard ITSELF — the transport routes every byte through
// `guard.fetch`, so a test subclass that runs the REAL `assertAllowed` gate and then returns a
// canned `Response` proves both the request shapes and the fail-closed egress gate without ever
// touching `globalThis.fetch` or opening a socket. The live wire stays exercised only by
// `live/rented.live.test.ts` (creds-gated, per the ADR-0201 live-test convention).
import { describe, expect, test } from "bun:test";
import { AuthzError, InternalError, ValidationError } from "@caisson-sh/kernel";
import type { UsageMetering } from "@caisson-sh/kernel";
import { EgressGuard } from "@caisson-sh/local-privacy";
import { localOnlyPolicy } from "@caisson-sh/local-privacy";
import type { PrivacyPolicy } from "@caisson-sh/local-privacy";
import { EMBEDDING_DIM } from "./backend.ts";
import { createOpenRouterRentedTransport } from "./openrouter-transport.ts";
import { RentedInferenceBackend } from "./rented-backend.ts";

const HOST = "openrouter.ai";
const BASE_URL = `https://${HOST}/api/v1`;
const API_KEY = "test-key";

/** The policy a deployer opts into for the hosted lane: openrouter.ai as a `rented-backend` sink. */
function openrouterPolicy(): PrivacyPolicy {
  return localOnlyPolicy([{ host: HOST, kind: "rented-backend" }]);
}

interface RecordedCall {
  url: string;
  init: RequestInit;
}

/**
 * The guard-level fetch double: `guard.fetch` IS the transport's only outbound seam, so overriding
 * it (after running the real `assertAllowed` gate, exactly like the base class) records the request
 * and returns a canned response — real policy enforcement, zero network.
 */
class RecordingGuard extends EgressGuard {
  readonly calls: RecordedCall[] = [];
  readonly #respond: () => Response;

  constructor(policy: PrivacyPolicy, respond: () => Response) {
    super(policy);
    this.#respond = respond;
  }

  override fetch(
    input: string | URL,
    init: RequestInit = {},
  ): Promise<Response> {
    // The REAL gate still decides — a blocked host throws AuthzError before anything is recorded.
    const url = this.assertAllowed(input);
    this.calls.push({ url: url.href, init });
    return Promise.resolve(this.#respond());
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A canned /embeddings body carrying the extra provider fields a lenient parse must tolerate. */
function embedPayload(
  vector: number[],
  // `null` = omit the usage object entirely (an explicit `undefined` would trip the JS default).
  usage: Record<string, unknown> | null = {
    prompt_tokens: 5,
    total_tokens: 5,
    cost: 0.0001,
  },
): Record<string, unknown> {
  return {
    object: "list",
    data: [{ object: "embedding", index: 0, embedding: vector }],
    model: "qwen/qwen3-embedding-8b",
    ...(usage !== null ? { usage } : {}),
  };
}

/** A canned /chat/completions body with the extra fields OpenRouter actually sends. */
function completePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "gen-abc123",
    object: "chat.completion",
    created: 1_750_000_000,
    model: "openai/gpt-4o-mini-2024-07-18",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: "hi there", refusal: null },
      },
    ],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    ...overrides,
  };
}

function makeTransport(
  guard: EgressGuard,
  overrides: { dimensions?: number; baseUrl?: string } = {},
) {
  return createOpenRouterRentedTransport({
    guard,
    apiKey: API_KEY,
    completionModel: "openai/gpt-4o-mini",
    embeddingModel: "qwen/qwen3-embedding-8b",
    ...overrides,
  });
}

describe("createOpenRouterRentedTransport — construction (fail-closed config)", () => {
  test("a host allowlisted as the WRONG kind (model-fetch) is refused at construction — the Bearer never leaves", () => {
    const guard = new RecordingGuard(
      localOnlyPolicy([{ host: HOST, kind: "model-fetch" }]),
      () => jsonResponse({}),
    );
    expect(() => makeTransport(guard)).toThrow(AuthzError);
    expect(guard.calls).toHaveLength(0);
  });

  test("a zero-egress (default) policy refuses construction outright", () => {
    const guard = new RecordingGuard(localOnlyPolicy([]), () =>
      jsonResponse({}),
    );
    expect(() => makeTransport(guard)).toThrow(AuthzError);
    expect(guard.calls).toHaveLength(0);
  });

  test("an empty apiKey fails closed (a blank Bearer would just 401 later)", () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse({}),
    );
    expect(() =>
      createOpenRouterRentedTransport({
        guard,
        apiKey: "  ",
        completionModel: "openai/gpt-4o-mini",
        embeddingModel: "qwen/qwen3-embedding-8b",
      }),
    ).toThrow(ValidationError);
  });

  test("a non-positive dimensions fails closed", () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse({}),
    );
    expect(() => makeTransport(guard, { dimensions: 0 })).toThrow(
      ValidationError,
    );
  });
});

describe("createOpenRouterRentedTransport — request shapes", () => {
  test("embed POSTs {baseUrl}/embeddings with Bearer auth + the default dimensions", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(embedPayload([0.1, 0.2, 0.3, 0.4])),
    );
    await makeTransport(guard).embed({ text: "hello" });

    expect(guard.calls).toHaveLength(1);
    const call = guard.calls[0];
    if (!call) throw new Error("expected a recorded call");
    expect(call.url).toBe(`${BASE_URL}/embeddings`);
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      model: "qwen/qwen3-embedding-8b",
      input: "hello",
      dimensions: EMBEDDING_DIM,
    });
  });

  test("a configured dimensions is forwarded on the wire (Matryoshka truncation param)", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(embedPayload([0.1, 0.2])),
    );
    await makeTransport(guard, { dimensions: 64 }).embed({ text: "x" });
    const body = JSON.parse(String(guard.calls[0]?.init.body)) as Record<
      string,
      unknown
    >;
    expect(body.dimensions).toBe(64);
  });

  test("complete POSTs {baseUrl}/chat/completions with the user message + max_tokens when set", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(completePayload()),
    );
    await makeTransport(guard).complete({ prompt: "summarize", maxTokens: 16 });

    const call = guard.calls[0];
    if (!call) throw new Error("expected a recorded call");
    expect(call.url).toBe(`${BASE_URL}/chat/completions`);
    const body = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "summarize" }],
      max_tokens: 16,
    });
  });

  test("complete omits max_tokens entirely when the caller did not set it", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(completePayload()),
    );
    await makeTransport(guard).complete({ prompt: "summarize" });
    const body = JSON.parse(String(guard.calls[0]?.init.body)) as Record<
      string,
      unknown
    >;
    expect("max_tokens" in body).toBe(false);
  });

  test("a trailing slash on baseUrl does not double up in the request path", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(embedPayload([0.1])),
    );
    await makeTransport(guard, { baseUrl: `${BASE_URL}/` }).embed({
      text: "x",
    });
    expect(guard.calls[0]?.url).toBe(`${BASE_URL}/embeddings`);
  });
});

describe("createOpenRouterRentedTransport — lenient wire parse → strict mapping", () => {
  test("embed tolerates unknown provider fields and maps vector + integer usage", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(embedPayload([0.1, 0.2, 0.3, 0.4])),
    );
    const res = await makeTransport(guard).embed({ text: "hello" });
    expect(res.vector).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(res.usage).toEqual({ unit: "token", quantity: 5 });
  });

  test("a fractional total_tokens floors to an integer (ADR-0007: integer units only)", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(embedPayload([0.1], { total_tokens: 7.9 })),
    );
    const res = await makeTransport(guard).embed({ text: "x" });
    expect(res.usage.quantity).toBe(7);
    expect(Number.isInteger(res.usage.quantity)).toBe(true);
  });

  test("a missing usage object meters as 0 (never NaN, never a throw)", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(embedPayload([0.1], null)),
    );
    const res = await makeTransport(guard).embed({ text: "x" });
    expect(res.usage.quantity).toBe(0);
  });

  test("complete maps text + remote model label + integer usage through extra fields", async () => {
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(completePayload()),
    );
    const res = await makeTransport(guard).complete({ prompt: "hi" });
    expect(res.text).toBe("hi there");
    expect(res.model).toBe("openai/gpt-4o-mini-2024-07-18");
    expect(res.usage).toEqual({ unit: "token", quantity: 5 });
  });

  test("complete falls back to the configured model slug when the wire omits one", async () => {
    const payload = completePayload();
    delete payload.model;
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(payload),
    );
    const res = await makeTransport(guard).complete({ prompt: "hi" });
    expect(res.model).toBe("openai/gpt-4o-mini");
  });
});

describe("createOpenRouterRentedTransport — fail-closed boundaries", () => {
  test("a non-2xx throws InternalError with the status and NEVER the response body", async () => {
    // A hostile/misconfigured proxy could echo request headers (the Bearer key) in its error body.
    const leakMarker = "sk-or-leaked-key-material";
    const guard = new RecordingGuard(
      openrouterPolicy(),
      () => new Response(`upstream error: ${leakMarker}`, { status: 402 }),
    );
    let caught: unknown;
    try {
      await makeTransport(guard).embed({ text: "x" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InternalError);
    const ie = caught as InternalError;
    expect(ie.details?.status).toBe(402);
    expect(ie.message).not.toContain(leakMarker);
    expect(JSON.stringify(ie.details ?? {})).not.toContain(leakMarker);
  });

  test("a non-allowlisted host is blocked by the guard AT CONSTRUCTION — no transport, no request", () => {
    // The policy allowlists only openrouter.ai; pointing baseUrl elsewhere must fail closed
    // immediately (the purpose-bound gate runs at composition, before any Bearer request exists).
    const guard = new RecordingGuard(openrouterPolicy(), () =>
      jsonResponse(embedPayload([0.1])),
    );
    expect(() =>
      makeTransport(guard, { baseUrl: "https://evil.example.com/api/v1" }),
    ).toThrow(AuthzError);
    expect(guard.calls).toHaveLength(0); // the block fired pre-network
  });
});

describe("createOpenRouterRentedTransport — end-to-end through RentedInferenceBackend", () => {
  function collectingMeter() {
    const records: UsageMetering[] = [];
    return {
      records,
      sink: (record: UsageMetering) => {
        records.push(record);
      },
    };
  }

  test("embed + complete each emit exactly one integer metered record", async () => {
    const vector = Array.from(
      { length: EMBEDDING_DIM },
      (_, i) => (i + 1) / (EMBEDDING_DIM + 1),
    );
    let next: Response = jsonResponse(embedPayload(vector));
    const guard = new RecordingGuard(openrouterPolicy(), () => next);
    const meter = collectingMeter();
    const backend = new RentedInferenceBackend({
      endpoint: BASE_URL,
      guard,
      transport: makeTransport(guard),
      meter: meter.sink,
      tenantId: "tenant-a",
      feature: "local-ai.rented-inference",
      model: "openrouter/qwen/qwen3-embedding-8b",
    });

    const vec = await backend.embed("hello");
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(EMBEDDING_DIM);
    expect(meter.records).toHaveLength(1);
    expect(meter.records[0]?.unit).toBe("token");
    expect(meter.records[0]?.quantity).toBe(5);
    expect(Number.isInteger(meter.records[0]?.quantity)).toBe(true);

    next = jsonResponse(completePayload());
    const out = await backend.complete({ prompt: "summarize" });
    expect(out.text).toBe("hi there");
    expect(out.model).toBe("openai/gpt-4o-mini-2024-07-18");
    expect(meter.records).toHaveLength(2);
    expect(Number.isInteger(meter.records[1]?.quantity)).toBe(true);
  });
});
