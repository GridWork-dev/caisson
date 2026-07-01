// Client-safe BYOK provider list + type. NO server imports here: the "use client" byok-form imports
// this module, so it must not transitively drag @caisson/ai-kit / @caisson/field-crypto / node:crypto
// (Node-only) into the browser bundle. Server logic lives in ./byok.ts, which re-exports these.

/** Providers a buyer can bring a single-string API key for (bedrock/azure need multi-part creds). */
export const BYOK_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number];
