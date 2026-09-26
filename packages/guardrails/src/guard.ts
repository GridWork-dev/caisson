// The guard (ADR-0063) — the enforced input/output chokepoint the AI Production Kit gateway calls
// around a provider call. Order: a cheap regex pre-screen (free) → the unconditional secret-shape
// gate (ADR-0215) → the configured `Moderator` under a deadline → PII redaction (input leg only).
// FAIL-CLOSED is the default: a moderator outage or timeout BLOCKS unless the policy explicitly sets
// `failOpen`. A block throws `GuardrailError` (422) and emits a metadata-only `guardrail.blocked`
// event to the kernel `EventSink` on a typed bus — no up-import of any edition (the Compliance WORM
// chain is a separate trust model, never this sink).
import { ConfigError } from "@caisson-sh/kernel";
import type { FieldCryptoContext } from "@caisson-sh/field-crypto";
import type { Moderator } from "./moderator.ts";
import type { PiiMode, PiiToken } from "./pii.ts";
import { redactPii, tokenizePii } from "./pii.ts";
import type { GuardPolicyBase, GuardRuntime } from "./guard-core.ts";
import { moderateGuard } from "./guard-core.ts";

export type { GuardRuntime } from "./guard-core.ts";

/** How PII is handled on the input leg. `tokenize` requires a bound field-crypto context. */
export interface PiiPolicy {
  readonly mode: PiiMode;
  readonly ctx?: FieldCryptoContext;
}

/** A resolved guard policy. `policyName` is the `forge.config` policy id — metadata, never content. */
export interface GuardPolicy extends GuardPolicyBase {
  readonly policyName: string;
  readonly moderator: Moderator;
  /** Fail-closed unless explicitly `true` (ADR-0063). Honored ONLY for moderator outages/timeouts. */
  readonly failOpen?: boolean;
  readonly timeoutMs?: number;
  /** Cheap, always-on regex pre-screen run BEFORE the (possibly provider/model) moderator. */
  readonly cheapDeny?: readonly RegExp[];
  readonly pii?: PiiPolicy | null;
}

/** The input-leg outcome: the (possibly redacted) text + reversible tokens for `tokenize` mode. */
export interface GuardOutcome {
  readonly text: string;
  readonly tokens: readonly PiiToken[];
}

/**
 * Guard an INPUT before it reaches the model: moderate, then redact PII. Returns the sanitized text
 * (and reversible tokens for `tokenize` mode). Throws `GuardrailError` 422 on a block.
 */
export async function guardInput(
  text: string,
  policy: GuardPolicy,
  rt: GuardRuntime,
): Promise<GuardOutcome> {
  // A PII context bound to another tenant is a wiring error — reject before moderation or any
  // telemetry so a cross-tenant seal can never be reached.
  if (
    policy.pii?.ctx !== undefined &&
    policy.pii.ctx.tenantId !== rt.tenantId
  ) {
    throw new ConfigError(
      "guardrails: PII field-crypto context is bound to a different tenant than the guard runtime",
    );
  }
  await moderateGuard("input", text, policy, rt);
  const pii = policy.pii;
  if (pii === undefined || pii === null) return { text, tokens: [] };
  if (pii.mode === "tokenize") {
    if (pii.ctx === undefined) {
      throw new ConfigError(
        "guardrails: PII tokenize mode requires a field-crypto context",
      );
    }
    const { redacted, tokens } = tokenizePii(text, pii.ctx);
    return { text: redacted, tokens };
  }
  return { text: redactPii(text, pii.mode).redacted, tokens: [] };
}

/**
 * Guard an OUTPUT before it reaches the caller. Moderation only — the `pii` field is accepted so
 * an input policy object stays source-compatible on the output leg, but output text is never
 * rewritten.
 */
export async function guardOutput(
  text: string,
  policy: GuardPolicy,
  rt: GuardRuntime,
): Promise<void> {
  await moderateGuard("output", text, policy, rt);
}
