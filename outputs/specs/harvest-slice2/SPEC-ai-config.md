# SPEC — `@caisson/ai-config` (provider-lane validation hardening)

**Status: LOCKED — ADR-0210, harvest slice-2 wave, 2026-07-02 operator picker.** Hardening
within the existing ADR-0160/0162 scope; carries no new decision beyond ADR-0210's lock.

- **Package:** `packages/ai-config` (`kind: base`, `tier: oss`, Apache-2.0). No edition/license
  change; no new package.
- **Type:** HARDEN IN PLACE — fixes two live schema bugs + closes a coverage gap in the
  package's own suite. Zero API surface change (same exports, same `ProviderConfig` shape).
- **Tags:** none (validation-only; no secret value is ever read or persisted here).

## Goal (WHAT + WHY)

ADR-0160 added `bedrock`/`azure-openai`/`ollama` to the provider enum, but the Zod
`superRefine` in `config.ts` was never updated to match: it still enforces the pre-0160
"every non-tenant lane names `apiKeyEnv`" rule unconditionally, which (a) makes the AWS
default-credential-chain Bedrock lane ADR-0160 decision 4 explicitly authorizes
**schema-unreachable**, and (b) never enforces the `apiVersion`/`baseUrl` Azure requires
(ADR-0160 decision 3), so a malformed Azure lane only fails downstream at SDK construction
in `ai-kit/providers.ts`. Both are correctness bugs against a locked ADR, not new decisions.

## Scope

**In:** the `ProviderConfigSchema.superRefine` branch in `config.ts`; new test cases in
`config.test.ts` only. **Out:** `providers.ts` (ai-kit, unchanged — it already implements the
default-chain + Azure behavior the schema should have been enforcing), `AiSettingsSchema`,
the public exports, any registry/manifest change.

## Design

- **Bedrock exemption.** The existing check `cfg.keySource !== "tenant" && cfg.apiKeyEnv ===
undefined → issue` gains a third guard clause `&& cfg.provider !== "bedrock"`. A bedrock
  lane may legally omit `apiKeyEnv` (and `apiSecretEnv`) to let the AWS SDK's default
  credential chain resolve creds (ADR-0160 decision 4); every other provider still requires
  `apiKeyEnv` on a non-tenant lane, unchanged.
- **Azure required-fields branch.** A new `if (cfg.provider === "azure-openai")` block adds
  two issues when absent: `apiVersion === undefined` → `ctx.addIssue({ path: ["apiVersion"],
message: "azure-openai requires apiVersion" })`, and `baseUrl === undefined` → same shape on
  `path: ["baseUrl"]`. Mirrors ADR-0160 decision 3 ("`model` addresses a deployment;
  `apiVersion` is required" — `baseUrl` is the resource endpoint, also required to reach it).
- **No new types, no new fields** — `region`/`apiVersion`/`apiSecretEnv` already exist on the
  schema (ADR-0160 decision 4); this only changes which combinations `superRefine` accepts.
- **Coverage additions** (own-suite only, no new fixtures elsewhere): bedrock round-trip with
  region-only (no `apiKeyEnv`/`apiSecretEnv`) parses clean; bedrock with an explicit two-part
  credential parses clean; azure-openai with `apiVersion`+`baseUrl` parses clean; azure-openai
  missing `apiVersion` rejects; azure-openai missing `baseUrl` rejects; ollama round-trip
  (mirrors `local`, requires nothing new); `keySource: "tenant"` positive round-trip (no
  `apiKeyEnv`); `keySource: "tenant"` + a named `apiKeyEnv` rejects (existing lines 53-60 logic,
  currently zero test coverage repo-wide).

## Tasks

1. Add the bedrock guard clause to the first `superRefine` issue (config.ts:61-67) + one
   positive test (bedrock region-only parses) + one test confirming a _non_-bedrock env lane
   still rejects a missing `apiKeyEnv` (regression guard). Verify: `bun test
packages/ai-config/src`.
2. Add the azure-openai required-fields `superRefine` branch + 3 tests (valid round-trip,
   missing-`apiVersion` rejects, missing-`baseUrl` rejects). Verify: `bun test
packages/ai-config/src`.
3. Add the remaining own-suite gaps: bedrock two-part-credential round-trip, ollama
   round-trip, `keySource: "tenant"` positive round-trip, `keySource: "tenant"` +
   `apiKeyEnv` negative (existing logic, new coverage). Verify: `bun test
packages/ai-config/src` (suite grows from 6 to ~13-14 cases, all green).
4. `bun run check` (turbo + `tooling/` standards gate) green at the repo level; add a
   changeset naming `@caisson/ai-config: patch`. Verify: `bun run check`.

## Verify (goal-backward)

- A bedrock lane with only `provider`/`model`/`region` (no `apiKeyEnv`) now parses —
  ADR-0160 decision 4's default-credential-chain lane is reachable, matching `providers.ts:155-156`.
- An azure-openai lane missing `apiVersion` or `baseUrl` now rejects at config-parse time,
  not at SDK construction three layers downstream.
- Every provider in the enum (`openai`/`anthropic`/`google`/`openrouter`/`local`/`bedrock`/
  `azure-openai`/`ollama`) and both `keySource` values have at least one round-trip test.
- `bun run check` green; no export, dependency, or manifest change (confirm via `git diff
--stat` touching only `config.ts` + `config.test.ts` + the changeset).

## Effort: S (~2-3 hrs). Value: MEDIUM (closes 2 live ADR-0160 compliance bugs + a coverage gap; no new surface).
