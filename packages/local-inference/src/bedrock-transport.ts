// src/inference/bedrock-transport.ts — the AWS Bedrock RENTED transport (ADR-0209, mapping the
// ADR-0064 `RentedTransport` port). Same discipline as the OpenRouter
// template (ADR-0201), but AWS-native on both axes:
//
//   AUTH  — SigV4, hand-rolled on node:crypto (`sigv4.ts`, pinned against the documented AWS test
//           vectors). No @aws-sdk/@smithy dependency: the SDK-import boundary confines
//           vendor SDKs to ai-config/ai-kit (ADR-0209). Signed headers per request:
//           content-type;host;x-amz-content-sha256;x-amz-date (+ x-amz-security-token for STS).
//   WIRE  — bedrock-runtime's two model-agnostic-enough routes:
//             embed    → POST /model/{embeddingModelId}/invoke   (Titan-style body:
//                        `{inputText, dimensions?}` → `{embedding, inputTextTokenCount}`)
//             complete → POST /model/{completionModelId}/converse (the uniform Converse API:
//                        `{messages, inferenceConfig?}` → `{output.message.content[], usage}`)
//
// The same two disciplines as every rented transport:
//   1. EGRESS — every request routes through `guard.fetchAs("rented-backend", …)` (→ kernel
//      `fetchWithTimeout`; the native `AbortSignal.timeout` is forbidden on Bun), PURPOSE-BOUND to
//      the `rented-backend` sink kind. The deployer must allowlist the regional host
//      (bedrock-runtime.{region}.amazonaws.com); the gate also runs at construction. Config is
//      EXPLICIT options only — the transport reads no env.
//   2. ERROR HYGIENE — a non-2xx surfaces bounded AWS diagnostics after deep credential scrubbing;
//      SigV4 headers, access keys, secret keys, and session tokens are never echoed.
//
// Lenient wire parse → strict mapping (the template posture); usage maps to integer token units
// (`Math.floor`, ADR-0007). NOTE the dim seam: Titan embed v2 supports dimensions 256/512/1024 —
// NOT this package's 384 default — so `dimensions` here has NO default and is only forwarded when
// set; align it with `RentedBackendConfig.dim` and the local-store vec0 `dim` explicitly.
import {
  InternalError,
  ValidationError,
  scrubDeep,
  scrubForEgress,
} from "@caisson-sh/kernel";
import type { FetchTimeoutOptions } from "@caisson-sh/kernel";
import { z } from "zod";
import type { RentedTransport } from "./rented-backend.ts";
import { signSigV4 } from "./sigv4.ts";
import type { SigV4Credentials } from "./sigv4.ts";
import type { EgressGuard } from "@caisson-sh/local-privacy";

/** The bedrock-runtime credential-scope service code. */
const SERVICE = "bedrock";

/** AWS region codes are bare lowercase tokens; anything else would corrupt the derived hostname. */
const REGION_RE = /^[a-z0-9-]+$/;

/** Keep an upstream error useful without allowing an unbounded provider body into an exception. */
const MAX_ERROR_BODY_CHARS = 4_096;

/** Request headers covered by the Bedrock SigV4 signature; values never enter diagnostics. */
const SIGV4_HEADER_KEYS: ReadonlySet<string> = new Set([
  "authorization",
  "content-type",
  "host",
  "x-amz-content-sha256",
  "x-amz-date",
  "x-amz-security-token",
]);
const SIGV4_HEADER_LINE =
  /(^|[\r\n])([ \t]*(?:authorization|content-type|host|x-amz-content-sha256|x-amz-date|x-amz-security-token)[ \t]*:[ \t]*)[^\r\n]*/gim;

// ── Lenient wire schemas (untrusted third-party JSON — unknown fields pass, template posture) ──

/** Titan-style InvokeModel embedding response. */
const titanEmbedWireSchema = z.object({
  embedding: z.array(z.number()).min(1),
  inputTextTokenCount: z.number().optional(),
});

/** Converse response: text content blocks + provider-reported token usage. */
const converseWireSchema = z.object({
  output: z.object({
    message: z.object({
      content: z.array(z.object({ text: z.string().optional() })).min(1),
    }),
  }),
  usage: z.object({ totalTokens: z.number().optional() }).optional(),
});

/** AWS service-error fields; other provider metadata stays available in the scrubbed `body`. */
const bedrockErrorWireSchema = z.object({
  __type: z.string().trim().min(1).max(512).optional(),
  message: z.string().trim().min(1).max(2_048).optional(),
  Message: z.string().trim().min(1).max(2_048).optional(),
});

interface BedrockErrorDiagnostic {
  readonly body: string;
  readonly awsType?: string;
  readonly awsMessage?: string;
}

function truncateDiagnostic(text: string): string {
  if (text.length <= MAX_ERROR_BODY_CHARS) return text;
  return `${text.slice(0, MAX_ERROR_BODY_CHARS)}… [truncated]`;
}

/**
 * Scrub both generic credential shapes and the exact credentials configured for this transport.
 * The exact-value pass covers test/nonstandard keys that do not match a known public token shape.
 */
function scrubDiagnosticText(
  text: string,
  credentials: readonly string[],
): string {
  let scrubbed = text;
  for (const credential of credentials) {
    if (credential !== "") {
      scrubbed = scrubbed.replaceAll(credential, "[REDACTED]");
    }
  }
  scrubbed = scrubbed.replace(SIGV4_HEADER_LINE, "$1$2[REDACTED]");
  return scrubForEgress(scrubbed);
}

/** Deep-redact any structured echo of the signed request header block. */
function scrubSigV4Headers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSigV4Headers);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SIGV4_HEADER_KEYS.has(key.toLowerCase())
          ? "[REDACTED]"
          : scrubSigV4Headers(child),
      ]),
    );
  }
  return value;
}

async function readBedrockErrorDiagnostic(
  response: Response,
  credentials: readonly string[],
): Promise<BedrockErrorDiagnostic> {
  let rawBody: string;
  try {
    rawBody = await response.text();
  } catch {
    return { body: "[response body unavailable]" };
  }
  if (rawBody === "") return { body: "[empty response body]" };

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      body: truncateDiagnostic(scrubDiagnosticText(rawBody, credentials)),
    };
  }

  const scrubbedBody = scrubSigV4Headers(scrubDeep(parsedBody));
  const serializedBody = JSON.stringify(scrubbedBody);
  const body = truncateDiagnostic(
    scrubDiagnosticText(
      serializedBody ?? "[unserializable response body]",
      credentials,
    ),
  );
  const awsError = bedrockErrorWireSchema.safeParse(scrubbedBody);
  if (!awsError.success) return { body };

  const awsType =
    awsError.data.__type === undefined
      ? undefined
      : scrubDiagnosticText(awsError.data.__type, credentials);
  const wireMessage = awsError.data.message ?? awsError.data.Message;
  const awsMessage =
    wireMessage === undefined
      ? undefined
      : scrubDiagnosticText(wireMessage, credentials);
  return {
    body,
    ...(awsType !== undefined ? { awsType } : {}),
    ...(awsMessage !== undefined ? { awsMessage } : {}),
  };
}

/** Config for the Bedrock rented transport (ADR-0209). Explicit options only — no env reads. */
export interface BedrockRentedTransportConfig {
  /** The egress guard — every request routes through `guard.fetchAs("rented-backend", …)`,
   *  re-gating the host AND its sanctioned sink kind per call. */
  guard: EgressGuard;
  /** AWS region, e.g. `us-east-1` (derives the host `bedrock-runtime.{region}.amazonaws.com`,
   *  which must be an allowlisted `rented-backend` sink). */
  region: string;
  /** AWS access key id. Never logged, never echoed in errors. */
  accessKeyId: string;
  /** AWS secret access key. Never logged, never echoed in errors. */
  secretAccessKey: string;
  /** STS session token for temporary credentials — signed as `x-amz-security-token` when set. */
  sessionToken?: string;
  /** Embedding model id for `/invoke`, e.g. `amazon.titan-embed-text-v2:0`. */
  embeddingModelId: string;
  /** Completion model id for `/converse`, e.g. `us.amazon.nova-lite-v1:0`. */
  completionModelId: string;
  /**
   * Embedding width, forwarded as the Titan v2 `dimensions` body field ONLY when set (Titan v1
   * rejects the field; Titan v2 supports 256/512/1024 — not this package's 384 default). MUST
   * equal the local-store vec0 `dim` / `RentedBackendConfig.dim` you configure alongside it.
   */
  dimensions?: number;
  /** Per-call deadline (ms) for the guarded chokepoint. */
  timeoutMs?: number;
}

/**
 * Build a {@link RentedTransport} over AWS Bedrock (ADR-0209). Drops into
 * `RentedInferenceBackend` wherever the OpenRouter transport would — same guard gate, same strict
 * re-validation, same integer metering; only auth (SigV4) and wire dialect (InvokeModel/Converse)
 * differ.
 */
export function createBedrockRentedTransport(
  config: BedrockRentedTransportConfig,
): RentedTransport {
  const fail = (field: string): never => {
    throw new ValidationError(
      `bedrock rented transport requires a non-empty ${field}`,
      { field },
    );
  };
  if (config.accessKeyId.trim() === "") fail("accessKeyId");
  if (config.secretAccessKey.trim() === "") fail("secretAccessKey");
  if (config.embeddingModelId.trim() === "") fail("embeddingModelId");
  if (config.completionModelId.trim() === "") fail("completionModelId");
  if (!REGION_RE.test(config.region)) {
    // Hygiene, not the security boundary — the guard's allowlist decides what egresses; this just
    // rejects a region that could never form a real bedrock-runtime hostname.
    throw new ValidationError(
      "bedrock rented transport region must be a bare AWS region code",
      { received: config.region },
    );
  }
  if (
    config.dimensions !== undefined &&
    (!Number.isInteger(config.dimensions) || config.dimensions <= 0)
  ) {
    throw new ValidationError(
      "bedrock rented transport dimensions must be a positive integer",
      { received: config.dimensions },
    );
  }
  const baseUrl = `https://bedrock-runtime.${config.region}.amazonaws.com`;
  // Fail at composition, not first call: the regional host must be sanctioned as a
  // `rented-backend` sink SPECIFICALLY (mirrors the RentedInferenceBackend construction gate).
  config.guard.assertAllowedFor(baseUrl, "rented-backend");
  const credentials: SigV4Credentials = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    ...(config.sessionToken !== undefined && config.sessionToken !== ""
      ? { sessionToken: config.sessionToken }
      : {}),
  };
  const diagnosticCredentials = [
    config.accessKeyId,
    config.secretAccessKey,
    config.sessionToken ?? "",
  ];
  const options: FetchTimeoutOptions | undefined =
    config.timeoutMs !== undefined
      ? { timeoutMs: config.timeoutMs }
      : undefined;

  const post = async (
    modelId: string,
    action: "invoke" | "converse",
    payload: unknown,
  ): Promise<unknown> => {
    const body = JSON.stringify(payload);
    const url = new URL(
      `/model/${encodeURIComponent(modelId)}/${action}`,
      baseUrl,
    );
    const signed = signSigV4(
      {
        method: "POST",
        url,
        headers: { "content-type": "application/json" },
        body,
        region: config.region,
        service: SERVICE,
        date: new Date(),
      },
      credentials,
    );
    // `guard.fetchAs` is the chokepoint: the allowlist AND sink-kind gates fire BEFORE any socket
    // opens, so a signed request can only ever reach a `rented-backend`-sanctioned host.
    const res = await config.guard.fetchAs(
      "rented-backend",
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...signed.headers },
        body,
      },
      options,
    );
    if (!res.ok) {
      const diagnostic = await readBedrockErrorDiagnostic(
        res,
        diagnosticCredentials,
      );
      const summary =
        diagnostic.awsType !== undefined
          ? `${diagnostic.awsType}${diagnostic.awsMessage !== undefined ? `: ${diagnostic.awsMessage}` : ""}`
          : (diagnostic.awsMessage ?? diagnostic.body);
      throw new InternalError(
        `bedrock rented call failed (HTTP ${res.status}, ${action}): ${summary}`,
        {
          status: res.status,
          action,
          ...diagnostic,
        },
      );
    }
    return res.json();
  };

  return {
    async embed(input) {
      const wire = titanEmbedWireSchema.parse(
        await post(config.embeddingModelId, "invoke", {
          inputText: input.text,
          ...(config.dimensions !== undefined
            ? { dimensions: config.dimensions }
            : {}),
        }),
      );
      return {
        vector: wire.embedding,
        usage: {
          unit: "token",
          quantity: Math.floor(wire.inputTextTokenCount ?? 0),
        },
      };
    },
    async complete(input) {
      const wire = converseWireSchema.parse(
        await post(config.completionModelId, "converse", {
          messages: [{ role: "user", content: [{ text: input.prompt }] }],
          ...(input.maxTokens !== undefined
            ? { inferenceConfig: { maxTokens: input.maxTokens } }
            : {}),
        }),
      );
      const text = wire.output.message.content
        .map((block) => block.text ?? "")
        .join("");
      if (text === "") {
        // Converse can return non-text blocks (tool use etc.); a rented `complete` without any
        // text is a fail-closed condition, not an empty success.
        throw new InternalError("bedrock completion returned no text", {});
      }
      return {
        text,
        // Converse responses carry no model label; the strict shape wants one — use the config id.
        model: config.completionModelId,
        usage: {
          unit: "token",
          quantity: Math.floor(wire.usage?.totalTokens ?? 0),
        },
      };
    },
  };
}
