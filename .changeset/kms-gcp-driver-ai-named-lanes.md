---
"@caisson/field-crypto": minor
"@caisson/ai-config": minor
"@caisson/ai-kit": minor
---

field-crypto ships a real GCP Cloud KMS driver (`createGcpKmsClient`) beside
the existing AWS driver: injected config, `ConfigError` fail-closed, per-tenant CryptoKey targeting
with an `additionalAuthenticatedData` scope binding, and version-scoped crypto-shred via
`destroyCryptoKeyVersion`. Registered in the shared `KmsClient` port-conformance suite; a self-skipping
`live/kms-gcp.live.test.ts` proves the real adapter stack end to end against a throwaway per-run
CryptoKey (GCP KeyRings/CryptoKeys can't be deleted, so the fixture KeyRing is pre-provisioned via
`CAISSON_KMS_GCP_KEY_RING`; only the CryptoKey and its primary version are minted/destroyed per run).

ai-config's provider lane enum gains three named OpenAI-compatible vendors — `groq`, `mistral`,
`together` — following the same `apiKeyEnv`-required rule as `openai`/
`openrouter`. ai-kit's `providerFor` wires all three over `createOpenAICompatible` with a hardcoded
default `baseUrl` per vendor (Groq `https://api.groq.com/openai/v1`, Mistral
`https://api.mistral.ai/v1`, Together `https://api.together.xyz/v1`, each overridable), and fails
closed when the named `apiKeyEnv` resolves to no value (these are paid vendor APIs, unlike the
`local`/`ollama` placeholder key).
