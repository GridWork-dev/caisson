// @caisson/ai-kit — the AI Production Kit edition (ADR-0059). The metered inference gateway: one
// `infer(lane, input, opts)` chokepoint composing the four base primitives — prompt-registry
// (resolve + render), ai-meter (reserve/reconcile + caps/breaker), guardrails (input/output
// moderation + PII redact/restore), ai-config (lane → provider) — behind Vercel AI SDK v5. The ONLY
// package that imports a provider SDK (the Gate-2 carve-out, ADR-0011/0022); the SDK stays hidden
// behind `infer()`, so it is swappable. An edition is a composition, never a fork (ADR-0003) — it
// never imports another edition.

// The gateway + the provider-registry resolver (AI-SDK core only — no vendor SDK here).
export { buildRegistryResolver, infer } from "./gateway.ts";
export type {
  GuardConfig,
  InferInput,
  InferOptions,
  InferResult,
  ModelResolver,
} from "./gateway.ts";

// The live provider transport (the real `@ai-sdk/*` adapters; the one path not exercised in CI).
export { defaultProviders } from "./providers.ts";
