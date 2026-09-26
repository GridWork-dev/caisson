// live/rented-drivers.live.test.ts — LIVE proofs of the Azure OpenAI + Bedrock rented transports
// (ADR-0209, over the ADR-0064 rented-backend seam). Lives OUTSIDE ./src so the default
// suite (`bun test ./src`) and CI's secret-free runners never run it; runs only via
// `bun run test:live` AND each suite self-skips without its provider credentials (the ADR-0201
// live-test convention, mirroring live/rented.live.test.ts).
//
// What each proves that the unit doubles never could:
//   - Azure: the per-deployment route + api-version + api-key header are accepted by a real
//     resource, and text-embedding-3-* honors the 384 `dimensions` down-projection;
//   - Bedrock: the HAND-ROLLED SigV4 signature (sigv4.ts) is accepted by real AWS — the one thing
//     the documented vectors cannot prove end-to-end — plus Titan v2 512-dim embed and Converse;
//   - both: the metered lane stays integer end-to-end against real provider usage (ADR-0007).
import { describe, expect, test } from "bun:test";
import {
  EMBEDDING_DIM,
  createAzureOpenAIRentedTransport,
  createBedrockRentedTransport,
  createEgressGuard,
  localOnlyPolicy,
} from "../src/index.ts";
import type { RentedTransport } from "../src/index.ts";

const TIMEOUT_MS = 60_000;

// ── Azure OpenAI (skips without the full AZURE_OPENAI_* set) ──────────────────────────────────

const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY ?? "";
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT ?? "";
const AZURE_EMBED = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "";
const AZURE_CHAT = process.env.AZURE_OPENAI_COMPLETION_DEPLOYMENT ?? "";
const AZURE_LIVE =
  AZURE_KEY !== "" &&
  AZURE_ENDPOINT !== "" &&
  AZURE_EMBED !== "" &&
  AZURE_CHAT !== "";

function azureTransport(): RentedTransport {
  const host = new URL(AZURE_ENDPOINT).hostname;
  return createAzureOpenAIRentedTransport({
    guard: createEgressGuard(
      localOnlyPolicy([{ host, kind: "rented-backend" }]),
    ),
    apiKey: AZURE_KEY,
    endpoint: AZURE_ENDPOINT,
    embeddingDeployment: AZURE_EMBED,
    completionDeployment: AZURE_CHAT,
    dimensions: EMBEDDING_DIM,
    timeoutMs: TIMEOUT_MS,
  });
}

describe("Azure OpenAI rented transport — LIVE (skips without AZURE_OPENAI_* creds)", () => {
  test.skipIf(!AZURE_LIVE)(
    "embed returns an EMBEDDING_DIM-wide vector with integer usage",
    async () => {
      const res = await azureTransport().embed({
        text: "caisson live azure rented-transport proof",
      });
      expect(res.vector.length).toBe(EMBEDDING_DIM);
      expect(res.usage.unit).toBe("token");
      expect(Number.isInteger(res.usage.quantity)).toBe(true);
      expect(res.usage.quantity).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );

  test.skipIf(!AZURE_LIVE)(
    "complete returns non-empty text with integer usage",
    async () => {
      const res = await azureTransport().complete({
        prompt: "Reply with the single word: caisson",
        maxTokens: 16,
      });
      expect(res.text.trim().length).toBeGreaterThan(0);
      expect(Number.isInteger(res.usage.quantity)).toBe(true);
      expect(res.usage.quantity).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );
});

// ── AWS Bedrock (skips without AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) ─────────────────────

const AWS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? "";
const AWS_SECRET = process.env.AWS_SECRET_ACCESS_KEY ?? "";
const AWS_SESSION = process.env.AWS_SESSION_TOKEN ?? "";
const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
const BEDROCK_EMBED =
  process.env.CAISSON_LIVE_BEDROCK_EMBEDDING_MODEL ??
  "amazon.titan-embed-text-v2:0";
const BEDROCK_CHAT =
  process.env.CAISSON_LIVE_BEDROCK_COMPLETION_MODEL ??
  "us.amazon.nova-lite-v1:0";
// Titan v2 supports 256/512/1024 — NOT the package's 384 default (see bedrock-transport.ts).
const BEDROCK_DIM = 512;
const BEDROCK_LIVE = AWS_KEY_ID !== "" && AWS_SECRET !== "";

function requireBedrockSetting(value: string, envVar: string): string {
  if (value.trim() === "") {
    throw new Error(
      `Bedrock live test requires a non-empty ${envVar} in the environment`,
    );
  }
  return value;
}

function bedrockTransport(): RentedTransport {
  const region = requireBedrockSetting(AWS_REGION, "AWS_REGION");
  const embeddingModelId = requireBedrockSetting(
    BEDROCK_EMBED,
    "CAISSON_LIVE_BEDROCK_EMBEDDING_MODEL",
  );
  const completionModelId = requireBedrockSetting(
    BEDROCK_CHAT,
    "CAISSON_LIVE_BEDROCK_COMPLETION_MODEL",
  );
  return createBedrockRentedTransport({
    guard: createEgressGuard(
      localOnlyPolicy([
        {
          host: `bedrock-runtime.${region}.amazonaws.com`,
          kind: "rented-backend",
        },
      ]),
    ),
    region,
    accessKeyId: AWS_KEY_ID,
    secretAccessKey: AWS_SECRET,
    ...(AWS_SESSION !== "" ? { sessionToken: AWS_SESSION } : {}),
    embeddingModelId,
    completionModelId,
    dimensions: BEDROCK_DIM,
    timeoutMs: TIMEOUT_MS,
  });
}

// If either live leg returns an AWS service error, check Bedrock model-access grants plus the
// configured model id/region in the environment against the defaults above, then re-run:
//   cd packages/local-inference && bun run test:live
describe("Bedrock rented transport — LIVE (skips without AWS_* creds)", () => {
  test.skipIf(!BEDROCK_LIVE)(
    "embed returns the requested Titan v2 width with integer usage (SigV4 accepted by real AWS)",
    async () => {
      const res = await bedrockTransport().embed({
        text: "caisson live bedrock rented-transport proof",
      });
      expect(res.vector.length).toBe(BEDROCK_DIM);
      expect(res.usage.unit).toBe("token");
      expect(Number.isInteger(res.usage.quantity)).toBe(true);
      expect(res.usage.quantity).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );

  test.skipIf(!BEDROCK_LIVE)(
    "complete returns non-empty text with integer usage",
    async () => {
      const res = await bedrockTransport().complete({
        prompt: "Reply with the single word: caisson",
        maxTokens: 16,
      });
      expect(res.text.trim().length).toBeGreaterThan(0);
      expect(Number.isInteger(res.usage.quantity)).toBe(true);
      expect(res.usage.quantity).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );
});
