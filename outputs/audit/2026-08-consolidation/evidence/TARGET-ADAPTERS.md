# Targeted evidence — LLM/provider adapter surface

## Count reconciliation

The prior “8 adapters” count describes the eight branch groups in
`packages/ai-kit/src/providers.ts:107-202`. The public provider vocabulary contains 11 identities
(`packages/ai-config/src/config.ts:24-37`). Across audited implementation units there are 14
concrete adapters/backends plus the `RentedInferenceBackend` decorator.

## `ai-kit` branch groups

Shared caller/proof facts:

- `providerFor` is reached through `defaultProviders` and `buildByokResolver` at
  `packages/ai-kit/src/byok-resolver.ts:63-66,112`.
- No application wires that resolver. The site imports BYOK persistence/schema only at
  `apps/site/lib/byok.ts:20` and `apps/site/lib/site-migrations.ts:30`.
- Every identity has construction/endpoint/deadline tests at
  `packages/ai-kit/src/providers.test.ts:59-203`; OpenRouter alone has current real-provider chat
  and embedding proof (`packages/ai-kit/live/gateway.live.test.ts:1-11` and
  `packages/ai-kit/live/embed.live.test.ts:1-10`).
- Buyer docs promise the provider vocabulary at
  `apps/site/content/docs/base/ai-config.mdx:49-62` and `apps/site/lib/stack-fit.ts:153-162`.
- `packages/ai-kit` is an explicit KEEP/out-of-scope package under ADR-0397
  (`knowledge/decisions/ADR-0397-reference-app-retirement-and-dissolved-meta-deletion.md:24-25`).

All `providers.ts` rows below refer to `packages/ai-kit/src/providers.ts`.

| Unit                  | Implementation / physical span                  | Last meaningful change                        | Buyer/site deletion impact                                                     | Disposition |
| --------------------- | ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| OpenAI                | `providers.ts:107-108` / 2 lines                | `93c0a789` — AI SDK v7                        | Breaks documented public provider API; current site inference does not call it | KEEP-frozen |
| Anthropic             | `providers.ts:109-110` / 2 lines                | `93c0a789` — AI SDK v7                        | Same                                                                           | KEEP-frozen |
| Google                | `providers.ts:111-112` / 2 lines                | `93c0a789` — AI SDK v7                        | Same                                                                           | KEEP-frozen |
| OpenRouter            | `providers.ts:118-125` / 8 lines                | `f4e888aa` — live chat-completions correction | Breaks sole real-provider proof                                                | KEEP        |
| Groq/Mistral/Together | `providers.ts:126-153` / 28-line grouped branch | `8c53ca32` — adapter wave                     | Breaks three documented compatible identities                                  | KEEP-frozen |
| local/Ollama          | `providers.ts:154-173` / 20-line grouped branch | `f4e888aa` — fail-closed compatible lane      | Breaks local compatible API                                                    | KEEP-frozen |
| Bedrock               | `providers.ts:174-189` / 16 lines               | `20420496` — Bedrock driver                   | Breaks documented cloud-provider API                                           | KEEP-frozen |
| Azure OpenAI          | `providers.ts:190-202` / 13 lines               | `93c0a789` — chat transport pin               | Breaks documented enterprise provider API                                      | KEEP-frozen |

Registry/bundle note: `ai-kit` is a delisted dissolved meta, but its code remains because of live
site BYOK imports. This audit does not propose package, registry, or bundle changes. The mismatch
between AI-Production gateway copy and current bundle members is a delivery-truth follow-up, not a
consolidation cut.

## Local inference and embedding units

| Unit                               | Implementation/LOC                                                            | Callers and tests                                                                                                                                                               | Registry/bundle/revenue                                                | Last meaningful change                         | Disposition |
| ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- | ----------- |
| `OnnxEmbeddingBackend`             | `packages/local-inference/src/onnx-backend.ts:170-290` in a 290-line file     | No production constructor; gated real proof at `packages/local-inference/live/onnx.live.test.ts:89-214`                                                                         | In live $249 local-inference SKU; Local-first + Everything             | `f669d4ac` — real-package demo transition      | KEEP        |
| `RentedInferenceBackend` decorator | `packages/local-inference/src/rented-backend.ts:140-234`                      | Common guard/meter/validation; tests `packages/local-inference/src/rented-backend.test.ts:72-240`                                                                               | Same $249 SKU/bundles                                                  | `81703822` — initial six-bundle implementation | KEEP        |
| Generic live rented transport      | `packages/local-inference/src/rented-backend.ts:255-302` (48 lines)           | No production caller/live endpoint; construction gate tests `packages/local-inference/src/rented-backend.test.ts:242-266`                                                       | Public custom-wire export in sold package                              | `81703822`                                     | KEEP-frozen |
| OpenRouter rented transport        | `packages/local-inference/src/openrouter-transport.ts:91-189`                 | Unit plus real embed/complete/meter proof `packages/local-inference/live/rented.live.test.ts:73-125`                                                                            | Explicit sold driver                                                   | `81703822`                                     | KEEP        |
| Azure rented transport             | `packages/local-inference/src/azure-openai-transport.ts:70-175`               | Unit plus credential-gated proof `packages/local-inference/live/rented-drivers.live.test.ts:52-80`                                                                              | Explicit sold enterprise driver                                        | `81703822`                                     | KEEP        |
| Bedrock rented transport           | `packages/local-inference/src/bedrock-transport.ts:214-366` plus SigV4 helper | Unit/SigV4 plus real AWS proof `packages/local-inference/live/rented-drivers.live.test.ts:140-168`                                                                              | Explicit sold enterprise driver                                        | `36dd6ed1` — scrubbed diagnostics              | KEEP        |
| `createCloudEmbedder`              | `packages/local-store/src/embed-scrub-guard.ts:98-134` in a 134-line file     | No production caller/live proof; doubled tests `packages/local-store/src/egress-guard.test.ts:81-168`; buyer example `apps/site/content/docs/local-first/local-store.mdx:76-98` | Public export in $99 local-store; Local-first, Agentic-Dev, Everything | `deb160cd` implementation; `b0e66b60` rename   | KEEP-frozen |

Package proof for local-inference: `packages/local-inference/manifest.ts:6-15`,
`registry/index.json:7936-7958`, `registry/ledger.jsonl:846`, and
`packages/local-first/manifest.ts:20-28`.

## Refute verdict

- Generic rented transport deletion was refuted by its distinct buyer-owned `/embed`/`/complete`
  protocol and public export.
- Cloud embedder deletion/fold was refuted by its buyer example and different response/dimensions/
  retry contract from the docs service adapter.
- Cross-package same-vendor folds were refuted: AI SDK `ProviderV4` gateway adapters and
  privacy-gated `RentedTransport` adapters implement different contracts.

No adapter DELETE/FOLD survived. External buyer-import telemetry remains unavailable.
