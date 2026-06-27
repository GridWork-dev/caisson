/**
 * Import-boundary rules (ADR-0022, Gate 2). The provider-SDK boundary (ADR-0011): only
 * `ai-config` + `ai-kit` may import a provider SDK directly; everything else routes inference
 * through `ai-config`. Foundations' base strict config spreads this array (see index.js).
 *
 * Flat-config order matters: the global ban comes first, the ai-config/ai-kit exemption later
 * (a later matching config wins).
 */

/** The prohibited provider SDKs. Extend here when a new provider is added to ai-config. */
export const PROVIDER_SDKS = [
  "openai",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@aws-sdk/client-bedrock-runtime",
  "@mistralai/mistralai",
  "cohere-ai",
  "ollama",
];

const restrictedPatterns = PROVIDER_SDKS.map((name) => ({
  group: [name, `${name}/*`],
  message:
    "Provider SDKs may only be imported by @stack/ai-config and @stack/ai-kit (ADR-0011). Route inference through @stack/ai-config.",
}));

/** Packages exempt from the provider-SDK ban (the AI config seam itself). */
const PROVIDER_EXEMPT = [
  "packages/ai-config/**",
  "packages/ai-kit/**",
  "apps/ai-kit/**",
];

/** @type {import("eslint").Linter.Config[]} */
export const boundaries = [
  {
    name: "stack/provider-sdk-boundary",
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: restrictedPatterns }],
    },
  },
  {
    name: "stack/provider-sdk-boundary-exempt",
    files: PROVIDER_EXEMPT,
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default boundaries;
