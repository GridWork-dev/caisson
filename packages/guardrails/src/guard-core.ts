// Runtime-neutral guard core shared by the synchronous Node entry and the async WebCrypto entry.
// Blocking events are metadata-only; the guarded text never reaches the event sink.
import type { EventSink, OpsEvent } from "@caisson/kernel";
import {
  GuardrailError,
  guardrailBlockSchema,
  looksLikeSecret,
} from "@caisson/kernel";
import type {
  GuardCategory,
  ModerationResult,
  Moderator,
} from "./moderator.ts";
import { moderateWithDeadline } from "./moderator.ts";

const DEFAULT_TIMEOUT_MS = 2_000;

/** Policy fields shared by every runtime-specific guard. */
export interface GuardPolicyBase {
  readonly policyName: string;
  readonly moderator: Moderator;
  readonly failOpen?: boolean;
  readonly timeoutMs?: number;
  readonly cheapDeny?: readonly RegExp[];
}

/** Per-call tenant/event dependencies, with injectable time/id for deterministic tests. */
export interface GuardRuntime {
  readonly tenantId: string;
  readonly sink: EventSink;
  readonly now?: () => Date;
  readonly newId?: () => string;
}

function emitBlock(
  stage: "input" | "output",
  category: GuardCategory,
  failClosed: boolean,
  policy: GuardPolicyBase,
  runtime: GuardRuntime,
): void {
  const occurredAt = (runtime.now?.() ?? new Date()).toISOString();
  const block = guardrailBlockSchema.parse({
    blockId: runtime.newId?.() ?? crypto.randomUUID(),
    tenantId: runtime.tenantId,
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
  void Promise.resolve(runtime.sink.emit(event)).catch(() => {});
}

function block(
  stage: "input" | "output",
  category: GuardCategory,
  failClosed: boolean,
  policy: GuardPolicyBase,
  runtime: GuardRuntime,
): never {
  emitBlock(stage, category, failClosed, policy, runtime);
  throw new GuardrailError(stage, category);
}

/** Run the cheap and secret gates, then the configured moderator under its deadline. */
export async function moderateGuard(
  stage: "input" | "output",
  text: string,
  policy: GuardPolicyBase,
  runtime: GuardRuntime,
): Promise<void> {
  if (policy.cheapDeny !== undefined) {
    for (const pattern of policy.cheapDeny) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        block(stage, "moderation", false, policy, runtime);
      }
    }
  }
  if (looksLikeSecret(text)) {
    block(stage, "secret", false, policy, runtime);
  }
  let result: ModerationResult;
  try {
    result = await moderateWithDeadline(
      policy.moderator,
      text,
      policy.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
  } catch {
    if (policy.failOpen === true) return;
    block(stage, "moderation", true, policy, runtime);
  }
  if (result.flagged) {
    block(stage, result.category, false, policy, runtime);
  }
}

/** Guard an output before it reaches the caller. */
export async function guardOutput(
  text: string,
  policy: GuardPolicyBase,
  runtime: GuardRuntime,
): Promise<void> {
  await moderateGuard("output", text, policy, runtime);
}
