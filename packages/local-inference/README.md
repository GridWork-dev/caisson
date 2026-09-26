# @caisson-sh/local-inference

The Local-first edition's inference seam: one `InferenceBackend` port (`embed` / `complete`) with
three implementations sharing it — a deterministic offline stub, a guarded on-device ONNX backend,
and metered rented-backend transports (OpenRouter, Azure OpenAI, Bedrock) — all routed through the
`@caisson-sh/local-privacy` egress gate. A base primitive (Apache-2.0).

## What it gives you

- **One port, three backends.** `StubInferenceBackend` is a pure, network-free function of its
  input text (SHA-256-seeded PRNG → unit-norm vector) — the only backend CI ever exercises.
  `OnnxEmbeddingBackend` runs a MiniLM-class on-device model via transformers.js, hash-verified and
  first-run-fetched through the egress guard. `RentedInferenceBackend` wraps a metered
  `RentedTransport` (`createOpenRouterRentedTransport`, `createAzureOpenAIRentedTransport`,
  `createBedrockRentedTransport`) behind the same port.
- **`EMBEDDING_DIM` is the locked contract.** Every backend's `embed()` result is exactly this many
  floats — the width the shared `@caisson-sh/local-store` vec0 table is opened with; a mismatch throws
  at the store's dim-guard rather than silently padding or truncating.
- **Egress stays purpose-bound.** Both the ONNX and rented backends route their outbound calls
  through a `@caisson-sh/local-privacy` `EgressGuard`, re-exported here so a consumer never needs a
  second import for the same policy.

## Install

```bash
bun add @caisson-sh/local-inference
```

## Use

```ts
import {
  StubInferenceBackend,
  EMBEDDING_DIM,
} from "@caisson-sh/local-inference";

// the deterministic, offline backend every CI test exercises — no model, no socket
const backend = new StubInferenceBackend({ dim: EMBEDDING_DIM });

const vector = await backend.embed("the quick brown fox"); // Float32Array, unit-norm
const { text } = await backend.complete({
  prompt: "summarize: fox jumps",
  maxTokens: 32,
});
```

## Tests

`bun test packages/local-inference/src` — the stub is deterministic (same text ⇒ byte-identical
vector) and rejects a non-positive `dim`; the rented transports are exercised against a fake
`RentedTransport`/`MeterSink`, never a live model or a live network call.

License: Apache-2.0.
