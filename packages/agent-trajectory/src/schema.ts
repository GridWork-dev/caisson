// The trajectory contract (SPEC agent-runtime scope-item-1). One append-only event schema every
// governed run emits into: `run → step → model call → tool proposal → approval → tool result →
// checkpoint`. Zod `.strict()` at every boundary (unknown keys rejected); integer credit/usage units
// only (never floats, ADR-0007); `crypto.randomUUID()` ids.
//
// PAYLOAD DISCIPLINE (AR-4, binding): normalized metadata is inline; anything sensitive — prompt
// text, tool argument bodies, tool result bodies, checkpoint state — is carried ONLY as a
// `DigestRef` (`{ digest: sha256-hex, byteLength, encRef? }`), never as raw content. The trajectory
// log is safe to persist, replay, and anchor without leaking the bodies it references. Field
// classification is documented in the README (the contract RFC).
import { z } from "zod";

/** Lowercase sha256 hex — the only shape a `DigestRef.digest` may take. */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** A non-negative integer (tokens, credits, byte lengths, seq, depth). Never a float. */
const intNonneg = z.number().int().nonnegative();

/**
 * A reference to a sensitive body that is NEVER inlined into the trajectory: its content-address
 * (`digest`), its size (`byteLength`), and optionally where the encrypted bytes live (`encRef` — an
 * opaque pointer into an at-rest store; the trajectory carries no key material). This is the one
 * shape sensitive content may take in any payload.
 */
export const DigestRef = z
  .object({
    digest: z.string().regex(SHA256_HEX, "must be lowercase sha256 hex"),
    byteLength: intNonneg,
    encRef: z.string().min(1).optional(),
  })
  .strict();
export type DigestRef = z.infer<typeof DigestRef>;

/**
 * Usage honesty (AR-3): how much to trust the token/credit numbers on a `model.usage` event.
 * `metered` — the numbers ARE the ledger's (ai-kit gateway). `estimated` — real counts from a
 * trusted adapter (e.g. a Claude Code transcript) but not price-normalized, so not billing-grade.
 * `unsupported` — the surface has no validated usage contract; NO token claims are made.
 */
export const BillingStatus = z.enum(["metered", "estimated", "unsupported"]);
export type BillingStatus = z.infer<typeof BillingStatus>;

/** The eleven event kinds — the closed vocabulary of the trajectory contract. */
export const EVENT_KINDS = [
  "run.started",
  "run.finished",
  "step.started",
  "step.finished",
  "model.call",
  "model.usage",
  "tool.proposed",
  "tool.approved",
  "tool.denied",
  "tool.result",
  "checkpoint",
] as const;

const runStatus = z.enum(["completed", "failed", "cancelled"]);
const stepStatus = z.enum(["ok", "error"]);
const nonEmpty = z.string().min(1);

// --- Per-kind payloads (all `.strict()`; sensitive bodies as DigestRef only) -------------------

const RunStartedPayload = z
  .object({
    agentId: nonEmpty,
    /** The run's opening input, referenced by digest — never the prompt text itself. */
    input: DigestRef.optional(),
    labels: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const RunFinishedPayload = z
  .object({
    status: runStatus,
    /** The final output, referenced by digest — never the body. */
    output: DigestRef.optional(),
    reason: nonEmpty.optional(),
  })
  .strict();

const StepStartedPayload = z
  .object({
    stepId: nonEmpty,
    /** Absent at the root; present for a nested (e.g. subagent) step. */
    parentStepId: nonEmpty.optional(),
    /** Depth in the step tree; 0 at the root. Integer. */
    depth: intNonneg,
    label: nonEmpty.optional(),
  })
  .strict();

const StepFinishedPayload = z
  .object({
    stepId: nonEmpty,
    status: stepStatus,
    errorCode: nonEmpty.optional(),
  })
  .strict();

const ModelCallPayload = z
  .object({
    stepId: nonEmpty.optional(),
    provider: nonEmpty,
    model: nonEmpty,
    /** The rendered prompt, referenced by digest ONLY — never inlined (AR-4). */
    prompt: DigestRef,
  })
  .strict();

const ModelUsagePayload = z
  .object({
    stepId: nonEmpty.optional(),
    provider: nonEmpty,
    model: nonEmpty,
    inputTokens: intNonneg,
    outputTokens: intNonneg,
    cachedInputTokens: intNonneg.default(0),
    /** Integer credit units charged (ADR-0007). 0 when not billing-grade (estimated/unsupported). */
    credits: intNonneg,
    billingStatus: BillingStatus,
  })
  .strict();

const ToolProposedPayload = z
  .object({
    stepId: nonEmpty,
    toolCallId: nonEmpty,
    name: nonEmpty,
    /** Tool arguments, referenced by digest ONLY — never the arg bodies (AR-4). */
    args: DigestRef,
  })
  .strict();

const ToolApprovedPayload = z
  .object({
    toolCallId: nonEmpty,
    /** Who approved — a human id or an automated policy id. */
    actor: nonEmpty,
  })
  .strict();

const ToolDeniedPayload = z
  .object({
    toolCallId: nonEmpty,
    actor: nonEmpty,
    reason: nonEmpty.optional(),
  })
  .strict();

const ToolResultPayload = z
  .object({
    toolCallId: nonEmpty,
    ok: z.boolean(),
    /** The tool's output, referenced by digest ONLY — never the result body (AR-4). */
    result: DigestRef,
    exitCode: z.number().int().optional(),
  })
  .strict();

const CheckpointPayload = z
  .object({
    checkpointId: nonEmpty,
    label: nonEmpty.optional(),
    /** Serialized run state, referenced by digest ONLY — never inlined. */
    state: DigestRef.optional(),
  })
  .strict();

/**
 * The event envelope: `{ eventId, runId, seq, version, occurredAt, kind, payload }`, one strict
 * object per kind so the payload type is pinned by the discriminator. `seq` is a monotonic 0-based
 * integer per run (the append-only store enforces no gaps/rewrites); `version` starts at 1.
 */
function event<K extends (typeof EVENT_KINDS)[number], P extends z.ZodTypeAny>(
  kind: K,
  payload: P,
) {
  return z
    .object({
      eventId: z.string().uuid(),
      runId: nonEmpty,
      seq: intNonneg,
      version: z.number().int().positive(),
      occurredAt: z.string().datetime(),
      kind: z.literal(kind),
      payload,
    })
    .strict();
}

export const TrajectoryEvent = z.discriminatedUnion("kind", [
  event("run.started", RunStartedPayload),
  event("run.finished", RunFinishedPayload),
  event("step.started", StepStartedPayload),
  event("step.finished", StepFinishedPayload),
  event("model.call", ModelCallPayload),
  event("model.usage", ModelUsagePayload),
  event("tool.proposed", ToolProposedPayload),
  event("tool.approved", ToolApprovedPayload),
  event("tool.denied", ToolDeniedPayload),
  event("tool.result", ToolResultPayload),
  event("checkpoint", CheckpointPayload),
]);
export type TrajectoryEvent = z.infer<typeof TrajectoryEvent>;

/** The current contract version stamped on newly-authored events (`version` field). */
export const TRAJECTORY_VERSION = 1;
