---
"@caisson/ai-config": patch
---

Provider-lane validation hardening (ADR-0210): `superRefine` now matches ADR-0160's
provider set — a `bedrock` lane may omit `apiKeyEnv`/`apiSecretEnv` to let the AWS SDK's
default credential chain resolve creds, and an `azure-openai` lane rejects at parse time
when `apiVersion` or `baseUrl` is missing instead of failing three layers downstream at
SDK construction. No export, dependency, or manifest change; test coverage grows from 6 to
15 cases (every provider enum member + both `keySource` values now round-trip).
