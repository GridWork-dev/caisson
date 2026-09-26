# @caisson-sh/guardrails

A content-safety layer for AI features: moderate input and output text, redact or reversibly
tokenize PII, and block anything that looks like a leaked credential — all fail-closed by
default, so an outage blocks a call instead of silently letting it through unchecked.

- **Layer:** base

## What it gives you

- **`guardInput` / `guardOutput`** — the enforced chokepoint around a model call. A blocked input
  throws before the call ever happens (no spend, no round-trip); a blocked output throws after,
  still visible to the caller as a typed error rather than a silent pass-through.
- **A swappable moderator.** Three drivers ship out of the box: `local` (a zero-network regex
  denylist, the cheap default), `provider` (wraps an injected moderation check), and `custom` (your
  own hook). Fail-closed by default — a moderator timeout or outage blocks the call unless a policy
  explicitly opts into fail-open.
- **An unconditional secret-shape pre-screen.** Runs before the moderator on every call, independent
  of policy — text that looks like a credential (an API key, a token) is blocked regardless of what
  the moderator would say.
- **A PII engine.** `detectPii` / `redactPii` find and mask common PII kinds; `tokenizePii` /
  `detokenizePii` do the same reversibly — the model only ever sees an opaque placeholder, and the
  original value is restored for the caller afterward from an encrypted context.
- **A dark-pattern evaluator for marketing copy.** `evaluateFtc4P` scores static UI/marketing text
  against the FTC's "4 Ps" presentation dimensions (an evaluator you run at copy-review time, not a
  live request-path check).
- **A claim-ceiling gate.** `assertClaimAllowed` / `claimTier` check a marketing or product claim
  string against the evidence backing it, so a claim can't outrun what's actually been measured.

## Usage

```ts
import {
  guardInput,
  guardOutput,
  localModerator,
} from "@caisson-sh/guardrails";

const policy = {
  policyName: "default",
  moderator: localModerator(["forbidden phrase"]),
};
const runtime = { tenantId: accountId, sink: eventSink };

const { text: safeInput, tokens } = await guardInput(userText, policy, runtime);
// ... send safeInput to the model ...
await guardOutput(modelReply, policy, runtime); // throws if the reply is flagged
```

## Test

```sh
bun test packages/guardrails/src
```
