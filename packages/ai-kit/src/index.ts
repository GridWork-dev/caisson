// @caisson/ai-kit — the AI Production Kit edition (ADR-0059). The metered inference gateway: one
// `infer(lane, input, opts)` chokepoint composing the four base primitives — prompt-registry
// (resolve + render), ai-meter (reserve/reconcile + caps/breaker), guardrails (input/output
// moderation + PII redact/restore), ai-config (lane → provider) — behind Vercel AI SDK v5. The ONLY
// package that imports a provider SDK (the Gate-2 carve-out, ADR-0011/0022); the SDK stays hidden
// behind `infer()`, so it is swappable. An edition is a composition, never a fork (ADR-0003) — it
// never imports another edition.

// The gateway + the provider-registry resolver (AI-SDK core only — no vendor SDK here).
export { buildRegistryResolver, infer, inferStream } from "./gateway.ts";
export type {
  GuardConfig,
  InferInput,
  InferOptions,
  InferResult,
  InferStreamOptions,
  InferStreamResult,
  InferStreamSettled,
  ModelResolver,
} from "./gateway.ts";

// The live provider transport (the real `@ai-sdk/*` adapters; the one path not exercised in CI).
export {
  DEFAULT_PROVIDER_TIMEOUT_MS,
  defaultProviders,
  providerFor,
} from "./providers.ts";

// Metered embeddings (ADR-0213): the same reserve-before/reconcile-after chokepoint as infer(), for
// a buyer-facing RAG/semantic-search embeddings surface.
export { buildEmbeddingRegistryResolver, embed, embedMany } from "./embed.ts";
export type {
  EmbeddingModelResolver,
  EmbedManyResult,
  EmbedOptions,
  EmbedResult,
} from "./embed.ts";

// structuredGenerate<T>(): the structured-output-or-throw wrapper around infer() — the canonical
// default path for a typed value, throwing instead of silently returning an empty/unparseable result.
export {
  StructuredGenerateError,
  structuredGenerate,
} from "./structured-generate.ts";
export type {
  StructuredGenerateReason,
  StructuredGenerateResult,
} from "./structured-generate.ts";

// Per-tenant encrypted BYOK (ADR-0162): the encrypted key store + the BYOK-aware resolver.
export {
  TENANT_AI_CREDENTIAL_SCHEMA_SQL,
  getTenantProviderKey,
  putTenantProviderKey,
} from "./byok-store.ts";
export { buildByokResolver, laneKeySource } from "./byok-resolver.ts";
export type {
  ByokResolverOptions,
  TenantKeyResolver,
} from "./byok-resolver.ts";
