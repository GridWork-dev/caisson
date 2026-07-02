// The guard (ADR-0063) — the enforced input/output chokepoint the AI Production Kit gateway calls
// around a provider call. Order: a cheap regex pre-screen (free) → the unconditional secret-shape
// gate (ADR-0215) → the configured `Moderator` under a deadline → PII redaction (input leg only).
// FAIL-CLOSED is the default: a moderator outage or timeout BLOCKS unless the policy explicitly sets
// `failOpen`. A block throws `GuardrailError` (422) and emits a metadata-only `guardrail.blocked`
// event to the kernel `EventSink` on a typed bus — no up-import of any edition (the Compliance WORM
// chain is a separate trust model, never this sink).
import { randomUUID } from "node:crypto";
import type { EventSink, OpsEvent } from "@caisson/kernel";
import {
  ConfigError,
  GuardrailError,
  guardrailBlockSchema,
  looksLikeSecret,
} from "@caisson/kernel";
import type { FieldCryptoContext } from "@caisson/field-crypto";
import type {
  GuardCategory,
  ModerationResult,
  Moderator,
} from "./moderator.ts";
import { moderateWithDeadline } from "./moderator.ts";
import type { PiiMode, PiiToken } from "./pii.ts";
import { redactPii, tokenizePii } from "./pii.ts";

const DEFAULT_TIMEOUT_MS = 2_000;

/** How PII is handled on the input leg. `tokenize` requires a bound field-crypto context. */
export interface PiiPolicy {
  readonly mode: PiiMode;
  readonly ctx?: FieldCryptoContext;
}

/** A resolved guard policy. `policyName` is the `forge.config` policy id — metadata, never content. */
export interface GuardPolicy {
  readonly policyName: string;
  readonly moderator: Moderator;
  /** Fail-closed unless explicitly `true` (ADR-0063). Honored ONLY for moderator outages/timeouts. */
  readonly failOpen?: boolean;
  readonly timeoutMs?: number;
  /** Cheap, always-on regex pre-screen run BEFORE the (possibly provider/model) moderator. */
  readonly cheapDeny?: readonly RegExp[];
  readonly pii?: PiiPolicy | null;
}

/** Per-call runtime: the tenant + sink, plus injectable clock/id for deterministic tests. */
export interface GuardRuntime {
  readonly tenantId: string;
  readonly sink: EventSink;
  readonly now?: () => Date;
  readonly newId?: () => string;
}

/** The input-leg outcome: the (possibly redacted) text + reversible tokens for `tokenize` mode. */
export interface GuardOutcome {
  readonly text: string;
  readonly tokens: readonly PiiToken[];
}

function emitBlock(
  stage: "input" | "output",
  category: GuardCategory,
  failClosed: boolean,
  policy: GuardPolicy,
  rt: GuardRuntime,
): void {
  const occurredAt = (rt.now?.() ?? new Date()).toISOString();
  // Validate against the shared schema so the bus only ever carries the metadata shape (.strict()).
  const block = guardrailBlockSchema.parse({
    blockId: rt.newId?.() ?? randomUUID(),
    tenantId: rt.tenantId,
    stage,
    category,
    policy: policy.policyName,
    failClosed,
    occurredAt,
  });
  const event: OpsEvent = {
    name: "guardrail.blocked",
    timestamp: block.occurredAt,
    tenantId: block.tenantId,
    attributes: {
      blockId: block.blockId,
      stage: block.stage,
      category: block.category,
      policy: block.policy,
      failClosed: block.failClosed,
    },
  };
  // Fire-and-forget: a telemetry-sink failure must NEVER mask the guardrail block itself.
  void Promise.resolve(rt.sink.emit(event)).catch(() => {});
}

function block(
  stage: "input" | "output",
  category: GuardCategory,
  failClosed: boolean,
  policy: GuardPolicy,
  rt: GuardRuntime,
): never {
  emitBlock(stage, category, failClosed, policy, rt);
  throw new GuardrailError(stage, category);
}

/** Run the cheap pre-screen then the configured moderator under a deadline. Blocks fail-closed. */
async function moderate(
  stage: "input" | "output",
  text: string,
  policy: GuardPolicy,
  rt: GuardRuntime,
): Promise<void> {
  if (policy.cheapDeny !== undefined) {
    for (const re of policy.cheapDeny) {
      // Stateless per call: a cheapDeny pattern authored with `g`/`y` carries a sticky
      // lastIndex, so after its first `.test()` match later requests search from that
      // offset and silently stop blocking the phrase (fail-open bypass, ADR-0063).
      // GuardPolicy is a plain caller-built interface with no compile seam to strip the
      // flags once, so reset the cursor before each test.
      re.lastIndex = 0;
      if (re.test(text)) block(stage, "moderation", false, policy, rt);
    }
  }
  // Unconditional credential-shape gate (ADR-0215) — runs BEFORE the (possibly outaged/provider)
  // moderator, reusing the ONE `looksLikeSecret` predicate (kernel). No policy field, no opt-out: a
  // raw credential in either leg never reaches a moderator call, live or not.
  if (looksLikeSecret(text)) block(stage, "secret", false, policy, rt);
  let result: ModerationResult;
  try {
    result = await moderateWithDeadline(
      policy.moderator,
      text,
      policy.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
  } catch {
    // Outage / timeout / driver throw → fail-closed unless the operator explicitly opted out.
    if (policy.failOpen === true) return;
    block(stage, "moderation", true, policy, rt);
  }
  if (result.flagged) block(stage, result.category, false, policy, rt);
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
  await moderate("input", text, policy, rt);
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
 * Guard an OUTPUT before it reaches the caller: moderate only (PII restoration via `detokenizePii`
 * is the gateway's call, using the tokens carried from `guardInput`). Throws `GuardrailError` 422.
 */
export async function guardOutput(
  text: string,
  policy: GuardPolicy,
  rt: GuardRuntime,
): Promise<void> {
  await moderate("output", text, policy, rt);
}
