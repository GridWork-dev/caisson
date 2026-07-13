// The reference app's LOCAL model — a minimal hand-rolled `LanguageModelV2` (zero network, zero
// provider secret). The gateway takes the backing model as an INJECTED `resolveModel` (ADR-0059),
// so the demo wires this echo model and production wires `buildRegistryResolver` over the real
// `@ai-sdk/*` adapters (`defaultProviders`) with no change to the gateway. The live transport stays
// the one path a test never exercises.
//
// It is hand-rolled (not `ai/test`'s `MockLanguageModelV2`) on purpose: the SDK's test doubles pull
// `vitest` in transitively, which a Next/webpack production build cannot resolve. apps/ai-kit is
// provider-SDK-exempt, so importing the `@ai-sdk/provider` contract here is allowed (ADR-0011/0022).
import type { LanguageModelV3 } from "@ai-sdk/provider";

/** A local model that also records its `doGenerate` invocations, so a caller can assert the
 *  provider was NOT reached on a fail-closed path (empty wallet, tripped breaker, guardrail block). */
export type LocalModel = LanguageModelV3 & {
  readonly doGenerateCalls: readonly unknown[];
};

/** Fixed usage so the integer money math is deterministic: 10 input + 20 output tokens. */
const MOCK_USAGE = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
} as const;

/** Build a local echo model that returns `text` and reports `MOCK_USAGE` on every call. */
export function mockModel(text: string): LocalModel {
  const doGenerateCalls: unknown[] = [];
  return {
    specificationVersion: "v3",
    provider: "caisson-demo",
    modelId: "local-mock",
    supportedUrls: {},
    doGenerateCalls,
    async doGenerate(options) {
      doGenerateCalls.push(options);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: MOCK_USAGE,
        warnings: [],
      };
    },
    async doStream() {
      // The gateway ships request/response first (ADR-0059); the demo never streams.
      throw new Error("the demo model does not support streaming");
    },
  };
}
