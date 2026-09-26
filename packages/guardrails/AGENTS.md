# AGENTS — @caisson-sh/guardrails

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or the AI
Production Kit gateway must know to enforce content safety correctly (ADR-0063).

## Invariants (do not violate)

- **Fail-closed is the default.** A moderator error, timeout, or thrown custom hook BLOCKS — the
  guard throws `GuardrailError` (422) with `failClosed: true`. `failOpen` is honored **only when
  explicitly set on the policy**, and **only for outages/timeouts** — a positive moderation verdict
  always blocks regardless of `failOpen`.
- **Cheap before expensive.** `cheapDeny` regexes run BEFORE the (possibly provider/model) moderator;
  an obvious hit blocks without spending a provider call.
- **Metadata only on the bus.** A block emits `guardrail.blocked` to the kernel `EventSink` carrying
  `{ stage, category, policy, failClosed, blockId }` — NEVER the flagged content, matched text, or
  PII. `GuardrailError.details` is `{ stage, category }` only. Echoing content would defeat the
  redaction the guard exists to enforce.
- **No outbound call here.** Guardrails is a port boundary. The `provider` driver wraps an INJECTED
  check; the app's real adapter performs the HTTP call with `fetchWithTimeout` (kernel floor) and
  CI injects a test double. The live transport stays the only un-exercised path.
- **No edition up-import.** This is a base primitive (ADR-0003). It emits to the kernel sink; it
  never reaches into the Compliance WORM audit-chain (a different trust + retention model).

## Moderator port

`Moderator.moderate(text) → ModerationResult` (`{ flagged, category }`). Drivers: `localModerator`
(regex, zero network), `providerModerator(check)` (injected), `customModerator(hook)`. Build the live
instance from the `forge.config` block validated by `moderatorPolicySchema` (`.strict()`). Run a
moderator under a deadline with `moderateWithDeadline(moderator, text, timeoutMs)` — a rejection
(timeout/throw) is the fail-closed signal the guard catches.

## PII engine

`detectPii(text)` runs four detectors (email / US-SSN / credit-card with a Luhn check / phone) over a
deterministic overlap resolver. Three modes:

- `redactPii(text, "mask")` → `[KIND]`, irreversible.
- `redactPii(text, "hash")` → `[KIND:<12-hex sha256>]`, irreversible, stable per value.
- `tokenizePii(text, ctx)` → REVERSIBLE: seals each hit via field-crypto `sealField` under
  `PII_COLUMN_CONTEXT` and leaves an opaque placeholder; `detokenizePii(text, tokens, ctx)` restores
  via `openField`. This is the redact-before-egress / restore-on-return round-trip. The sole
  reversible path is field-crypto — never a bespoke crypto path. `tokenize` requires a bound
  `FieldCryptoContext` (the same tenant context must open what it sealed).

## Guard usage

`guardInput(text, policy, runtime)` → moderates, then redacts PII (returns sanitized text + reversible
tokens for `tokenize` mode). `guardOutput(text, policy, runtime)` → moderates only; PII restoration
(`detokenizePii`) is the gateway's call using the tokens carried from the input leg. `runtime` carries
the `tenantId` + `EventSink` (plus injectable `now`/`newId` for deterministic tests).

## Out of scope

No provider-SDK import (the gateway `@caisson-sh/ai-kit` owns that boundary, ADR-0011/0059). No live
moderation/model/network call — the moderator transport is a port, test-doubled in CI. Presidio/NER
and a managed moderation backend stay deferred behind these ports (optional add-ons, ADR-0063).
