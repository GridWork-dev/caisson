/**
 * Import-boundary rules (ADR-0022, Gate 2) — the FAST STATIC layer. The provider-SDK boundary
 * (ADR-0011): only `ai-config` + `ai-kit` may import a provider SDK directly; everything else
 * routes inference through `ai-config`. Foundations' base strict config spreads this array (index.js).
 *
 * LIMITS (why this is a backstop, not the whole gate, per ADR-0022): `no-restricted-imports` is
 * STATIC-ONLY — it does not catch `await import("openai")`, `require("openai")`, transitive deps,
 * or published .js that is never linted. A denylist of provider SDKs is also unwinnable by
 * construction (new SDKs ship constantly). dependency-cruiser (real module graph, dynamic +
 * transitive reachability) is the authoritative provider-SDK layer; this catches the obvious case
 * fast, in-editor.
 */

/** Prohibited provider SDKs. Keep current — a stale denylist is a hole (ADR-0022). */
export const PROVIDER_SDKS = [
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
];

const restrictedPatterns = PROVIDER_SDKS.map((name) => ({
  group: [name, `${name}/*`],
  message:
    "Provider SDKs may only be imported by @caisson/ai-config and @caisson/ai-kit (ADR-0011). Route inference through @caisson/ai-config. (dependency-cruiser backstops dynamic/transitive imports.)",
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
