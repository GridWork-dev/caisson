# ADR-0204 — local-ai RentedTransport drivers: Azure OpenAI + Bedrock ship, Ollama is out of scope

**Status:** accepted · 2026-07-02 (edition-tails-ops kickoff — operator lock, picker round 2026-07-02).
**Relates:** ADR-0160 (ai inference driver expansion — deferred exactly this as Surface B), ADR-0201
(live-transports go-live — added `createOpenRouterRentedTransport`, the pattern template), ADR-0125/adapter-expansion 2C.

## Context

ADR-0160 shipped Bedrock/Azure/Ollama as ai-kit gateway providers (Surface A) and explicitly deferred the
sibling Surface B: per-provider drivers for `packages/local-ai`'s `RentedTransport` port
(`src/inference/rented-backend.ts`), the Local-first edition's rent-a-hosted-provider seam for
`embed`/`complete`. Stream-C's SWEEP re-flagged it as a queued follow-up. Today the port has exactly one
concrete provider driver (`createOpenRouterRentedTransport`, ADR-0201) plus the provider-agnostic
`createLiveRentedTransport`. Zero Bedrock/Azure/Ollama code exists under `packages/local-ai`.

## Decision

Build **both** enterprise drivers now, mirroring the OpenRouter driver's shape (typed config, egress-guard
chokepoint, response re-validation against the rented schemas, integer-unit metering, construction/wire
tests + self-skipping live proofs):

- `createAzureOpenAIRentedTransport` — api-key header auth against an Azure OpenAI resource
  (embeddings + chat completions deployments).
- `createBedrockRentedTransport` — **SigV4 signing hand-rolled on `node:crypto`** (HMAC-SHA256 chain over
  the canonical request, pinned against official AWS test vectors). No `@aws-sdk`/`@smithy` dependency:
  the Gate-2 SDK-import boundary confines vendor AI SDKs to `ai-config`/`ai-kit`, and SigV4 is a
  well-specified ~100-LOC deterministic algorithm.
- **Ollama does not get a rented driver.** It is a self-hosted, unmetered local target — the opposite of
  "rented" — and its Local-first path stays on ai-kit's existing OpenAI-compatible `ollama` case (or the
  generic `createLiveRentedTransport` for a buyer who insists). ADR-0160's deferred note only ever named
  Bedrock/Azure for Surface B.

This closes ADR-0160's "Deferred (not blocking)" bullet.

## Rejected

- **Azure-first, Bedrock on buyer demand** (the recon recommendation, mirroring ADR-0201's
  prove-when-a-sale-needs-it pattern) — operator locked full closure in one pass.
- **Defer entirely / generic-relay posture** — `createLiveRentedTransport` can front anything behind a
  buyer-run shim, but "bring your own relay" is not a sellable enterprise driver story for the edition.
- **`@aws-sdk`/`@smithy` signing dependency** — pulls a vendor SDK into a package the Gate-2 boundary
  deliberately keeps SDK-free; the stdlib implementation is small, testable, and dependency-quiet.
