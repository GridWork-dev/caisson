// Unit tests for the Azure OpenAI rented transport (ADR-0209). Same seam as the
// OpenRouter template tests: the guard ITSELF is the injection point — a subclass runs the REAL
// `assertAllowed` gate and returns a canned `Response`, proving request shapes AND the fail-closed
// egress gate with zero network. The live wire is `live/rented-drivers.live.test.ts` (creds-gated).
import { describe, expect, test } from "bun:test";
import { AuthzError, InternalError, ValidationError } from "@caisson-sh/kernel";
import type { UsageMetering } from "@caisson-sh/kernel";
import { EgressGuard } from "@caisson-sh/local-privacy";
import { localOnlyPolicy } from "@caisson-sh/local-privacy";
import type { PrivacyPolicy } from "@caisson-sh/local-privacy";
import { createAzureOpenAIRentedTransport } from "./azure-openai-transport.ts";
import { EMBEDDING_DIM } from "./backend.ts";
import { RentedInferenceBackend } from "./rented-backend.ts";

const HOST = "caisson-test.openai.azure.com";
const ENDPOINT = `https://${HOST}`;
const API_KEY = "azure-test-key";
const EMBED_DEPLOYMENT = "text-embedding-3-small";
const CHAT_DEPLOYMENT = "gpt-4o-mini";

/** The deployer opt-in: the Azure resource host allowlisted as a `rented-backend` sink. */
function azurePolicy(): PrivacyPolicy {
  return localOnlyPolicy([{ host: HOST, kind: "rented-backend" }]);
}

interface RecordedCall {
  url: string;
  init: RequestInit;
}

/** Guard-level fetch double (the template pattern): real policy gate, canned response, no socket. */
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

/** A canned Azure /embeddings body (OpenAI-compatible dialect, extra fields included). */
function embedPayload(
  vector: number[],
  usage: Record<string, unknown> | null = { prompt_tokens: 5, total_tokens: 5 },
): Record<string, unknown> {
  return {
    object: "list",
    data: [{ object: "embedding", index: 0, embedding: vector }],
    model: "text-embedding-3-small",
    ...(usage !== null ? { usage } : {}),
  };
}

/** A canned Azure /chat/completions body with the fields Azure actually sends. */
function completePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "chatcmpl-abc123",
    object: "chat.completion",
    created: 1_750_000_000,
    model: "gpt-4o-mini-2024-07-18",
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
  overrides: {
    apiKey?: string;
    endpoint?: string;
    apiVersion?: string;
    dimensions?: number;
  } = {},
) {
  return createAzureOpenAIRentedTransport({
    guard,
    apiKey: API_KEY,
    endpoint: ENDPOINT,
    embeddingDeployment: EMBED_DEPLOYMENT,
    completionDeployment: CHAT_DEPLOYMENT,
    ...overrides,
  });
}

describe("createAzureOpenAIRentedTransport — construction (fail-closed config)", () => {
  test("a host allowlisted as the WRONG kind (model-fetch) is refused at construction", () => {
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

  test("a non-allowlisted endpoint fails closed at composition — no request exists", () => {
    const guard = new RecordingGuard(azurePolicy(), () => jsonResponse({}));
    expect(() =>
      makeTransport(guard, { endpoint: "https://evil.example.com" }),
    ).toThrow(AuthzError);
    expect(guard.calls).toHaveLength(0);
  });

  test("an empty apiKey / apiVersion / non-positive dimensions fail closed", () => {
    const guard = new RecordingGuard(azurePolicy(), () => jsonResponse({}));
    expect(() => makeTransport(guard, { apiKey: "  " })).toThrow(
      ValidationError,
    );
    expect(() => makeTransport(guard, { apiVersion: " " })).toThrow(
      ValidationError,
    );
    expect(() => makeTransport(guard, { dimensions: 0 })).toThrow(
      ValidationError,
    );
  });
});

describe("createAzureOpenAIRentedTransport — request shapes", () => {
  test("embed POSTs the per-deployment embeddings route with api-version + api-key header", async () => {
    const guard = new RecordingGuard(azurePolicy(), () =>
      jsonResponse(embedPayload([0.1, 0.2, 0.3, 0.4])),
    );
    await makeTransport(guard).embed({ text: "hello" });

    expect(guard.calls).toHaveLength(1);
    const call = guard.calls[0];
    if (!call) throw new Error("expected a recorded call");
    expect(call.url).toBe(
      `${ENDPOINT}/openai/deployments/${EMBED_DEPLOYMENT}/embeddings?api-version=2024-10-21`,
    );
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    // Azure auth is the api-key header — no Bearer anywhere in the request.
    expect(headers["api-key"]).toBe(API_KEY);
    expect(headers.authorization).toBeUndefined();
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    // No `model` field — the deployment in the URL IS the model.
    expect(body).toEqual({ input: "hello", dimensions: EMBEDDING_DIM });
  });

  test("complete POSTs the chat deployment route; max_tokens only when set; api-version override + trailing slash normalize", async () => {
    const guard = new RecordingGuard(azurePolicy(), () =>
      jsonResponse(completePayload()),
    );
    const transport = makeTransport(guard, {
      endpoint: `${ENDPOINT}/`,
      apiVersion: "2025-01-01-preview",
    });
    await transport.complete({ prompt: "summarize", maxTokens: 16 });
    await transport.complete({ prompt: "summarize" });

    const first = guard.calls[0];
    if (!first) throw new Error("expected a recorded call");
    expect(first.url).toBe(
      `${ENDPOINT}/openai/deployments/${CHAT_DEPLOYMENT}/chat/completions?api-version=2025-01-01-preview`,
    );
    const body = JSON.parse(String(first.init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      messages: [{ role: "user", content: "summarize" }],
      max_tokens: 16,
    });
    const second = JSON.parse(String(guard.calls[1]?.init.body)) as Record<
      string,
      unknown
    >;
    expect("max_tokens" in second).toBe(false);
  });
});

describe("createAzureOpenAIRentedTransport — lenient wire parse → strict mapping", () => {
  test("embed tolerates unknown provider fields and maps vector + integer usage", async () => {
    const guard = new RecordingGuard(azurePolicy(), () =>
      jsonResponse(embedPayload([0.1, 0.2, 0.3, 0.4])),
    );
    const res = await makeTransport(guard).embed({ text: "hello" });
    expect(res.vector).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(res.usage).toEqual({ unit: "token", quantity: 5 });
  });

  test("a fractional total_tokens floors; a missing usage meters as 0 (ADR-0007)", async () => {
    let payload = embedPayload([0.1], { total_tokens: 7.9 });
    const guard = new RecordingGuard(azurePolicy(), () =>
      jsonResponse(payload),
    );
    const transport = makeTransport(guard);
    expect((await transport.embed({ text: "x" })).usage.quantity).toBe(7);
    payload = embedPayload([0.1], null);
    expect((await transport.embed({ text: "x" })).usage.quantity).toBe(0);
  });

  test("complete maps text + remote model label; falls back to the deployment name", async () => {
    let payload = completePayload();
    const guard = new RecordingGuard(azurePolicy(), () =>
      jsonResponse(payload),
    );
    const transport = makeTransport(guard);
    const res = await transport.complete({ prompt: "hi" });
    expect(res.text).toBe("hi there");
    expect(res.model).toBe("gpt-4o-mini-2024-07-18");
    expect(res.usage).toEqual({ unit: "token", quantity: 5 });

    payload = completePayload();
    delete payload.model;
    const fallback = await transport.complete({ prompt: "hi" });
    expect(fallback.model).toBe(CHAT_DEPLOYMENT);
  });
});

describe("createAzureOpenAIRentedTransport — fail-closed boundaries", () => {
  test("a non-2xx throws InternalError with the status and NEVER the response body", async () => {
    // A hostile/misconfigured proxy could echo the api-key header in its error body.
    const leakMarker = "azure-leaked-key-material";
    const guard = new RecordingGuard(
      azurePolicy(),
      () => new Response(`upstream error: ${leakMarker}`, { status: 429 }),
    );
    let caught: unknown;
    try {
      await makeTransport(guard).embed({ text: "x" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InternalError);
    const ie = caught as InternalError;
    expect(ie.details?.status).toBe(429);
    expect(ie.message).not.toContain(leakMarker);
    expect(JSON.stringify(ie.details ?? {})).not.toContain(leakMarker);
  });
});

describe("createAzureOpenAIRentedTransport — end-to-end through RentedInferenceBackend", () => {
  test("embed + complete each emit exactly one integer metered record", async () => {
    const vector = Array.from(
      { length: EMBEDDING_DIM },
      (_, i) => (i + 1) / (EMBEDDING_DIM + 1),
    );
    let next: Response = jsonResponse(embedPayload(vector));
    const guard = new RecordingGuard(azurePolicy(), () => next);
    const records: UsageMetering[] = [];
    const backend = new RentedInferenceBackend({
      endpoint: ENDPOINT,
      guard,
      transport: makeTransport(guard),
      meter: (record) => {
        records.push(record);
      },
      tenantId: "tenant-a",
      feature: "local-ai.rented-inference",
      model: `azure/${CHAT_DEPLOYMENT}`,
    });

    const vec = await backend.embed("hello");
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(EMBEDDING_DIM);
    expect(records).toHaveLength(1);
    expect(records[0]?.unit).toBe("token");
    expect(Number.isInteger(records[0]?.quantity)).toBe(true);

    next = jsonResponse(completePayload());
    const out = await backend.complete({ prompt: "summarize" });
    expect(out.text).toBe("hi there");
    expect(records).toHaveLength(2);
    expect(Number.isInteger(records[1]?.quantity)).toBe(true);
  });
});
