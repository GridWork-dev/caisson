# @caisson/ai-config

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
