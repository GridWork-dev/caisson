// Unit tests for the Bedrock rented transport (ADR-0209). Same seam as the
// OpenRouter template tests: the guard ITSELF is the injection point — a subclass runs the REAL
// `assertAllowed` gate and returns a canned `Response`, proving request shapes, the SigV4 header
// wiring, and the fail-closed egress gate with zero network. Signature CORRECTNESS is pinned
// separately in sigv4.test.ts against the documented AWS vectors; here the recorded request's
// authorization header is re-derived with the same signer inputs (date parsed back from the
// recorded x-amz-date) and must match exactly — proving the transport feeds the signer the real
// method/url/headers/body it sends.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { AuthzError, InternalError, ValidationError } from "@caisson-sh/kernel";
import type { UsageMetering } from "@caisson-sh/kernel";
import { EgressGuard } from "@caisson-sh/local-privacy";
import { localOnlyPolicy } from "@caisson-sh/local-privacy";
import type { PrivacyPolicy } from "@caisson-sh/local-privacy";
import { createBedrockRentedTransport } from "./bedrock-transport.ts";
import { RentedInferenceBackend } from "./rented-backend.ts";
import { signSigV4 } from "./sigv4.ts";

const REGION = "us-east-1";
const HOST = `bedrock-runtime.${REGION}.amazonaws.com`;
const ACCESS_KEY_ID = "AKIDEXAMPLE";
const SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";
const EMBED_MODEL = "amazon.titan-embed-text-v2:0";
const COMPLETE_MODEL = "us.amazon.nova-lite-v1:0";

/** The deployer opt-in: the regional bedrock-runtime host as a `rented-backend` sink. */
function bedrockPolicy(): PrivacyPolicy {
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

/** A canned Titan v2 /invoke embedding body (extra provider fields included). */
function embedPayload(
  vector: number[],
  inputTextTokenCount: number | null = 5,
): Record<string, unknown> {
  return {
    embedding: vector,
    embeddingsByType: { float: vector },
    ...(inputTextTokenCount !== null ? { inputTextTokenCount } : {}),
  };
}

/** A canned Converse response body with the fields Bedrock actually sends. */
function completePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    metrics: { latencyMs: 120 },
    output: {
      message: { role: "assistant", content: [{ text: "hi there" }] },
    },
    stopReason: "end_turn",
    usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    ...overrides,
  };
}

function makeTransport(
  guard: EgressGuard,
  overrides: {
    region?: string;
    accessKeyId?: string;
    sessionToken?: string;
    dimensions?: number;
  } = {},
) {
  return createBedrockRentedTransport({
    guard,
    region: REGION,
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
    embeddingModelId: EMBED_MODEL,
    completionModelId: COMPLETE_MODEL,
    ...overrides,
  });
}

/** Parse the wire `x-amz-date` (`YYYYMMDDTHHMMSSZ`) back into a Date. */
function parseAmzDate(amzDate: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate);
  if (!m) throw new Error(`unexpected x-amz-date: ${amzDate}`);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

describe("createBedrockRentedTransport — construction (fail-closed config)", () => {
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

  test("a region for a host the deployer did not allowlist fails closed at composition", () => {
    const guard = new RecordingGuard(bedrockPolicy(), () => jsonResponse({}));
    expect(() => makeTransport(guard, { region: "eu-west-1" })).toThrow(
      AuthzError,
    );
    expect(guard.calls).toHaveLength(0);
  });

  test("empty credentials / a malformed region / non-positive dimensions fail closed", () => {
    const guard = new RecordingGuard(bedrockPolicy(), () => jsonResponse({}));
    expect(() => makeTransport(guard, { accessKeyId: " " })).toThrow(
      ValidationError,
    );
    expect(() =>
      makeTransport(guard, { region: "us-east-1/evil.com" }),
    ).toThrow(ValidationError);
    expect(() => makeTransport(guard, { dimensions: 0 })).toThrow(
      ValidationError,
    );
  });
});

describe("createBedrockRentedTransport — request shapes + SigV4 wiring", () => {
  test("embed POSTs /model/{id}/invoke with the model id URL-encoded and a valid SigV4 header set", async () => {
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(embedPayload([0.1, 0.2])),
    );
    await makeTransport(guard, { dimensions: 512 }).embed({ text: "hello" });

    expect(guard.calls).toHaveLength(1);
    const call = guard.calls[0];
    if (!call) throw new Error("expected a recorded call");
    expect(call.url).toBe(
      `https://${HOST}/model/amazon.titan-embed-text-v2%3A0/invoke`,
    );
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    const body = String(call.init.body);
    expect(JSON.parse(body)).toEqual({ inputText: "hello", dimensions: 512 });
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/);
    expect(headers["x-amz-content-sha256"]).toBe(
      createHash("sha256").update(body, "utf8").digest("hex"),
    );
    // Re-derive the signature from the recorded request (date parsed back from the wire header):
    // an exact match proves the transport signed the same method/url/headers/body it sent.
    const amzDate = headers["x-amz-date"];
    if (amzDate === undefined) throw new Error("expected x-amz-date");
    const expected = signSigV4(
      {
        method: "POST",
        url: new URL(call.url),
        headers: { "content-type": "application/json" },
        body,
        region: REGION,
        service: "bedrock",
        date: parseAmzDate(amzDate),
      },
      { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    );
    expect(headers.authorization).toBe(expected.headers.authorization);
    expect(headers.authorization).toContain(
      "SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date,",
    );
  });

  test("embed omits `dimensions` from the body when not configured (Titan v1 compatibility)", async () => {
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(embedPayload([0.1])),
    );
    await makeTransport(guard).embed({ text: "x" });
    const body = JSON.parse(String(guard.calls[0]?.init.body)) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({ inputText: "x" });
  });

  test("complete POSTs /model/{id}/converse with Converse messages + inferenceConfig only when set", async () => {
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(completePayload()),
    );
    const transport = makeTransport(guard);
    await transport.complete({ prompt: "summarize", maxTokens: 16 });
    await transport.complete({ prompt: "summarize" });

    const first = guard.calls[0];
    if (!first) throw new Error("expected a recorded call");
    expect(first.url).toBe(
      `https://${HOST}/model/us.amazon.nova-lite-v1%3A0/converse`,
    );
    expect(JSON.parse(String(first.init.body))).toEqual({
      messages: [{ role: "user", content: [{ text: "summarize" }] }],
      inferenceConfig: { maxTokens: 16 },
    });
    const second = JSON.parse(String(guard.calls[1]?.init.body)) as Record<
      string,
      unknown
    >;
    expect("inferenceConfig" in second).toBe(false);
  });

  test("an STS session token is sent AND signed (x-amz-security-token in SignedHeaders)", async () => {
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(embedPayload([0.1])),
    );
    await makeTransport(guard, { sessionToken: "sts-session-token" }).embed({
      text: "x",
    });
    const headers = guard.calls[0]?.init.headers as Record<string, string>;
    expect(headers["x-amz-security-token"]).toBe("sts-session-token");
    expect(headers.authorization).toContain(
      "SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token,",
    );
  });
});

describe("createBedrockRentedTransport — lenient wire parse → strict mapping", () => {
  test("embed maps the Titan vector + integer usage through extra provider fields", async () => {
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(embedPayload([0.1, 0.2, 0.3, 0.4])),
    );
    const res = await makeTransport(guard).embed({ text: "hello" });
    expect(res.vector).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(res.usage).toEqual({ unit: "token", quantity: 5 });
  });

  test("a fractional inputTextTokenCount floors; a missing one meters as 0 (ADR-0007)", async () => {
    let payload = embedPayload([0.1], null);
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(payload),
    );
    const transport = makeTransport(guard);
    expect((await transport.embed({ text: "x" })).usage.quantity).toBe(0);
    payload = { embedding: [0.1], inputTextTokenCount: 7.9 };
    expect((await transport.embed({ text: "x" })).usage.quantity).toBe(7);
  });

  test("complete joins the Converse text blocks and labels with the configured model id", async () => {
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(
        completePayload({
          output: {
            message: {
              role: "assistant",
              content: [{ text: "hi " }, { toolUse: {} }, { text: "there" }],
            },
          },
        }),
      ),
    );
    const res = await makeTransport(guard).complete({ prompt: "hi" });
    expect(res.text).toBe("hi there");
    expect(res.model).toBe(COMPLETE_MODEL);
    expect(res.usage).toEqual({ unit: "token", quantity: 5 });
  });

  test("a Converse response with no text content fails closed (never an empty success)", async () => {
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(
        completePayload({
          output: {
            message: { role: "assistant", content: [{ toolUse: {} }] },
          },
        }),
      ),
    );
    expect(makeTransport(guard).complete({ prompt: "hi" })).rejects.toThrow(
      InternalError,
    );
  });
});

describe("createBedrockRentedTransport — fail-closed boundaries", () => {
  test("a non-2xx surfaces sanitized AWS diagnostics without leaking credentials", async () => {
    const sessionToken = "bedrock-sts-session-token";
    const guard = new RecordingGuard(bedrockPolicy(), () =>
      jsonResponse(
        {
          __type: "AccessDeniedException",
          message: `Model access denied for ${ACCESS_KEY_ID}`,
          signedHeaders: {
            authorization: `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/scope`,
            "content-type": "application/json",
            host: HOST,
            "x-amz-content-sha256": "bedrock-body-hash",
            "x-amz-date": "20260725T120000Z",
            "x-amz-security-token": sessionToken,
          },
          secretAccessKey: SECRET_ACCESS_KEY,
          sessionToken,
        },
        403,
      ),
    );
    let caught: unknown;
    try {
      await makeTransport(guard, { sessionToken }).embed({ text: "x" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InternalError);
    const ie = caught as InternalError;
    expect(ie.details?.status).toBe(403);
    expect(ie.details?.action).toBe("invoke");
    expect(ie.details?.awsType).toBe("AccessDeniedException");
    expect(ie.details?.awsMessage).toBe("Model access denied for [REDACTED]");
    expect(ie.message).toContain("HTTP 403");
    expect(ie.message).toContain("AccessDeniedException");
    expect(ie.message).toContain("Model access denied");
    expect(ie.details?.body).toContain("AccessDeniedException");
    const diagnostic = `${ie.message}\n${JSON.stringify(ie.details ?? {})}`;
    expect(diagnostic).not.toContain(ACCESS_KEY_ID);
    expect(diagnostic).not.toContain(SECRET_ACCESS_KEY);
    expect(diagnostic).not.toContain(sessionToken);
    expect(diagnostic).not.toContain("AWS4-HMAC-SHA256");
    expect(diagnostic).not.toContain("application/json");
    expect(diagnostic).not.toContain(HOST);
    expect(diagnostic).not.toContain("bedrock-body-hash");
    expect(diagnostic).not.toContain("20260725T120000Z");
  });
});

describe("createBedrockRentedTransport — end-to-end through RentedInferenceBackend", () => {
  test("embed + complete each emit exactly one integer metered record", async () => {
    // dim=4 end-to-end: the transport forwards dimensions=4 and the backend locks the same width.
    let next: Response = jsonResponse(embedPayload([0.1, 0.2, 0.3, 0.4]));
    const guard = new RecordingGuard(bedrockPolicy(), () => next);
    const records: UsageMetering[] = [];
    const backend = new RentedInferenceBackend({
      endpoint: `https://${HOST}`,
      guard,
      transport: makeTransport(guard, { dimensions: 4 }),
      meter: (record) => {
        records.push(record);
      },
      tenantId: "tenant-a",
      feature: "local-ai.rented-inference",
      model: `bedrock/${EMBED_MODEL}`,
      dim: 4,
    });

    const vec = await backend.embed("hello");
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(4);
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
