// The ONE boundary-policy data source (consolidation C24). Three enforcement engines read this
// file and stay otherwise separate (ADR-0022): ESLint no-restricted-imports (boundaries.js, fast
// static), dependency-cruiser (.dependency-cruiser.cjs, real module graph — dynamic/transitive),
// and @caisson/standards-gate (SPDX/license authority; its EDITION_NAMES is parity-pinned to
// BUNDLE_META_NAMES by test rather than imported, so its pre-install fs-only pass stays
// dependency-free). CJS + zero imports on purpose: the cruiser config is CJS and this package
// ships in the OSS mirror, so the data must load everywhere without a build.
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
 * Bundle/edition meta-package workspace DIRS under `packages/` that exist on disk — the graph
 * layer's isolation + down-only targets. The four ADR-0257 legacy editions minus the deleted
 * `local-ai`, plus the five ADR-0257/0258 bundle roots.
 */
const BUNDLE_META_DIRS = [
  "compliance",
  "ai-kit",
  "agent-dev",
  "ai-production",
  "local-first",
  "agentic-dev",
  "provenance",
  "everything",
];

/**
 * Bundle/edition meta-package NAMES — the SPDX gate's class. A superset of BUNDLE_META_DIRS:
 * historical `kind:"edition"` entries stay served forever (ADR-0006 append-only ledger), so the
 * deleted `local-ai` workspace keeps its NAME row here even though it has no dir.
 */
const BUNDLE_META_NAMES = [
  "@caisson/compliance",
  "@caisson/ai-kit",
  "@caisson/local-ai",
  "@caisson/agent-dev",
  "@caisson/ai-production",
  "@caisson/local-first",
  "@caisson/agentic-dev",
  "@caisson/provenance",
  "@caisson/everything",
];

module.exports = {
  PROVIDER_SDKS,
  PROVIDER_SDK_RE,
  BUNDLE_META_DIRS,
  BUNDLE_META_NAMES,
};
