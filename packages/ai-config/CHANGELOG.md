# @caisson/ai-config

## 0.3.0

### Minor Changes

- 8c53ca3: field-crypto ships a real GCP Cloud KMS driver (`createGcpKmsClient`) beside
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

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- 9558a46: Provider-lane validation hardening (ADR-0210): `superRefine` now matches ADR-0160's
  provider set — a `bedrock` lane may omit `apiKeyEnv`/`apiSecretEnv` to let the AWS SDK's
  default credential chain resolve creds, and an `azure-openai` lane rejects at parse time
  when `apiVersion` or `baseUrl` is missing instead of failing three layers downstream at
  SDK construction. No export, dependency, or manifest change; test coverage grows from 6 to
  15 cases (every provider enum member + both `keySource` values now round-trip).
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
