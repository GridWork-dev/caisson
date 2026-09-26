// The ONE boundary-policy data source (consolidation C24). Two enforcement engines read this
// file and stay otherwise separate (ADR-0022): oxlint no-restricted-imports (fast static, parity-
// pinned by test) and dependency-cruiser (.dependency-cruiser.cjs, real module graph —
// dynamic/transitive). CJS + zero imports on purpose: the cruiser config is CJS, so the data must
// load everywhere without a build.
"use strict";

/** Prohibited provider SDKs (ADR-0011/0022 Gate 2). Keep current — a stale denylist is a hole. */
const PROVIDER_SDKS = [
  // OpenAI + Azure
  "openai",
  "@azure/openai",
  // Anthropic (incl. cloud-vendor SDKs)
  "@anthropic-ai/sdk",
  "@anthropic-ai/bedrock",
  "@anthropic-ai/vertex-sdk",
  // Google Gemini — @google/genai is the current GA SDK; generative-ai is deprecated (both banned)
  "@google/genai",
  "@google/generative-ai",
  // AWS Bedrock
  "@aws-sdk/client-bedrock-runtime",
  // Others
  "@mistralai/mistralai",
  "cohere-ai",
  "groq-sdk",
  "replicate",
  "together-ai",
  "ollama",
  // Vercel AI SDK family (Apache-2.0 — license-clean, so it passes Gate 1/1b; confined here
  // PURELY by composition, ADR-0011/0022 Gate 2): the `ai` core + the first-party provider
  // adapters are the gateway's inference path and live behind @caisson/ai-kit's `infer()`. Only
  // @caisson/ai-config + @caisson/ai-kit may import them; every other package routes through the
  // gateway so the backing SDK stays swappable.
  "ai",
  "@ai-sdk/openai",
  "@ai-sdk/openai-compatible",
  "@ai-sdk/anthropic",
  "@ai-sdk/google",
  "@ai-sdk/openrouter",
  "@ai-sdk/amazon-bedrock",
  "@ai-sdk/azure",
];

/** node_modules path regex covering exactly PROVIDER_SDKS. `ai` is trailing-slash-anchored so it
 *  matches `node_modules/ai/…` but never `airtable`/`ai-*` siblings. */
const PROVIDER_SDK_RE = `node_modules/(${PROVIDER_SDKS.map((name) =>
  name === "ai" ? "ai/" : name,
).join("|")})`;

/**
 * Composition-package workspace DIRS under `packages/` — the graph layer's isolation + down-only
 * targets. Each composes base packages into a larger kit; nothing else may depend on one, and none
 * may depend on another.
 */
const BUNDLE_META_DIRS = ["compliance", "ai-kit", "agent-dev"];

module.exports = {
  PROVIDER_SDKS,
  PROVIDER_SDK_RE,
  BUNDLE_META_DIRS,
};
