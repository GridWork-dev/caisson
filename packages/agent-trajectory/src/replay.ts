// Replay = a deterministic PROJECTION (SPEC verification): `project(events) -> RunProjection`.
// The SAME events always yield a BYTE-IDENTICAL projection regardless of arrival order — the fold
// sorts by `seq` first, so a shuffled batch (e.g. out-of-order stream delivery) resolves to one
// canonical result. This is the shape evals score and the audit chain can anchor; it is a pure
// function of the event log, never of wall-clock or map-iteration order.
import type { BillingStatus, DigestRef, TrajectoryEvent } from "./schema.ts";

/** One node in the run's step tree, children ordered by the seq of their `step.started`. */
export interface StepNode {
  readonly stepId: string;
  readonly parentStepId?: string;
  readonly depth: number;
  readonly label?: string;
  readonly status: "running" | "ok" | "error";
  readonly children: StepNode[];
}

/** Token/credit totals for one `billingStatus` band (integer units only). */
export interface UsageTotal {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  credits: number;
}

export interface CheckpointMark {
  readonly checkpointId: string;
  readonly label?: string;
  readonly seq: number;
}

export interface RunProjection {
  readonly runId: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "cancelled";
  readonly steps: StepNode[];
  /** One entry per billingStatus band, always all four keys in a fixed order (deterministic). */
  readonly usageTotals: Record<BillingStatus, UsageTotal>;
  readonly checkpoints: CheckpointMark[];
}

const zeroTotal = (): UsageTotal => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  credits: 0,
});

/**
 * Fold an event log to its canonical projection. Deterministic: events are sorted by `seq` (a
 * total order the append-only store guarantees is gapless), then folded; the output object is built
 * in a fixed key order so `JSON.stringify` of two projections of the same log is byte-identical.
 */
export function project(events: readonly TrajectoryEvent[]): RunProjection {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const runId = ordered[0]?.runId ?? "";

  let status: RunProjection["status"] = "pending";
  // Key order is the projection's byte order: metered → priced → estimated → unsupported
  // (the `priced` band landed with ADR-0360 U-4 — the one recorded projection-bytes change).
  const usageTotals: Record<BillingStatus, UsageTotal> = {
    metered: zeroTotal(),
    priced: zeroTotal(),
    estimated: zeroTotal(),
    unsupported: zeroTotal(),
  };
  const checkpoints: CheckpointMark[] = [];

  // Step tree built by insertion order (== seq order); status filled in by step.finished. The
  // internal node is mutable (status/children written during the fold); the public `StepNode` view
  // is readonly.
  interface MutableStepNode {
    stepId: string;
    parentStepId?: string;
    depth: number;
    label?: string;
    status: StepNode["status"];
    children: MutableStepNode[];
  }
  const nodes = new Map<string, MutableStepNode>();
  const roots: MutableStepNode[] = [];

  for (const e of ordered) {
    switch (e.kind) {
      case "run.started":
        status = "running";
        break;
      case "run.finished":
        status = e.payload.status;
        break;
      case "step.started": {
        const node: MutableStepNode = {
          stepId: e.payload.stepId,
          ...(e.payload.parentStepId !== undefined
            ? { parentStepId: e.payload.parentStepId }
            : {}),
          depth: e.payload.depth,
          ...(e.payload.label !== undefined ? { label: e.payload.label } : {}),
          status: "running",
          children: [],
        };
        nodes.set(node.stepId, node);
        const parent =
          e.payload.parentStepId !== undefined
            ? nodes.get(e.payload.parentStepId)
            : undefined;
        if (parent !== undefined) parent.children.push(node);
        else roots.push(node);
        break;
      }
      case "step.finished": {
        const node = nodes.get(e.payload.stepId);
        if (node !== undefined) node.status = e.payload.status;
        break;
      }
      case "model.usage": {
        const t = usageTotals[e.payload.billingStatus];
        t.inputTokens += e.payload.inputTokens;
        t.outputTokens += e.payload.outputTokens;
        t.cachedInputTokens += e.payload.cachedInputTokens;
        t.credits += e.payload.credits;
        break;
      }
      case "checkpoint":
        checkpoints.push({
          checkpointId: e.payload.checkpointId,
          ...(e.payload.label !== undefined ? { label: e.payload.label } : {}),
          seq: e.seq,
        });
        break;
      // model.call / tool.* carry no projection state in slice 1 (recorded, replayable, not folded).
      default:
        break;
    }
  }

  return { runId, status, steps: roots, usageTotals, checkpoints };
}

// --- projectToolCalls — a SIBLING projection (ADR-0360 U-7) ------------------------------------
// Folds `tool.proposed`/`tool.approved`/`tool.denied`/`tool.result` into one scored-consumable
// list per toolCallId, ordered by proposal seq. This does NOT touch `project()`/`RunProjection` —
// tool.* events still carry no state in that fold (the comment above says so and stays true) — so
// every existing `project()` input keeps its existing byte-identical output. Same determinism
// discipline: sort by `seq` first, so shuffled arrival still folds to one canonical result.

/** One proposed tool call's outcome, folded from the approval + result events that named its
 *  `toolCallId` (if any arrived). Absent `approval`/`result` means the call is still in flight
 *  (parked awaiting approval, or approved-but-not-yet-settled) — a scorer treats that as "nothing
 *  to audit yet", not a violation. */
export interface ToolCallApproval {
  readonly outcome: "approved" | "denied";
  readonly actor: string;
  readonly seq: number;
  readonly reason?: string;
}

export interface ToolCallResultMark {
  readonly ok: boolean;
  readonly seq: number;
  readonly exitCode?: number;
}

export interface ToolCallProjection {
  readonly toolCallId: string;
  readonly stepId: string;
  readonly name: string;
  /** The tool's arguments, digest-referenced only (AR-4) — never the raw body. */
  readonly args: DigestRef;
  readonly proposedSeq: number;
  readonly approval?: ToolCallApproval;
  readonly result?: ToolCallResultMark;
}

/**
 * Fold a log's tool.proposed/approved/denied/result events into one entry per `toolCallId`,
 * ordered by proposal seq — the shape a trajectory-quality scorer (ADR-0360 U-7, `@caisson-sh/ai-
 * evals`) reads: which tool, what it argued (digest only), who approved/denied it and how, and
 * whether it succeeded. An approval/result event naming a `toolCallId` with no matching
 * `tool.proposed` (a malformed/partial log) is dropped rather than synthesizing a call — mirrors
 * `project()`'s own defensive handling of an orphaned `step.finished`.
 */
export function projectToolCalls(
  events: readonly TrajectoryEvent[],
): ToolCallProjection[] {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  interface MutableToolCall {
    toolCallId: string;
    stepId: string;
    name: string;
    args: DigestRef;
    proposedSeq: number;
    approval?: ToolCallApproval;
    result?: ToolCallResultMark;
  }
  const byId = new Map<string, MutableToolCall>();
  const order: string[] = [];

  for (const e of ordered) {
    switch (e.kind) {
      case "tool.proposed": {
        if (!byId.has(e.payload.toolCallId)) order.push(e.payload.toolCallId);
        byId.set(e.payload.toolCallId, {
          toolCallId: e.payload.toolCallId,
          stepId: e.payload.stepId,
          name: e.payload.name,
          args: e.payload.args,
          proposedSeq: e.seq,
        });
        break;
      }
      case "tool.approved": {
        const call = byId.get(e.payload.toolCallId);
        if (call !== undefined) {
          call.approval = {
            outcome: "approved",
            actor: e.payload.actor,
            seq: e.seq,
          };
        }
        break;
      }
      case "tool.denied": {
        const call = byId.get(e.payload.toolCallId);
        if (call !== undefined) {
          call.approval = {
            outcome: "denied",
            actor: e.payload.actor,
            seq: e.seq,
            ...(e.payload.reason !== undefined
              ? { reason: e.payload.reason }
              : {}),
          };
        }
        break;
      }
      case "tool.result": {
        const call = byId.get(e.payload.toolCallId);
        if (call !== undefined) {
          call.result = {
            ok: e.payload.ok,
            seq: e.seq,
            ...(e.payload.exitCode !== undefined
              ? { exitCode: e.payload.exitCode }
              : {}),
          };
        }
        break;
      }
      // run.*/step.*/model.*/checkpoint carry no tool-call state in this fold.
      default:
        break;
    }
  }

  return order.map((id) => {
    const call = byId.get(id);
    /* c8 ignore next 3 -- id came from byId's own keys, set in the same loop above */
    if (call === undefined) {
      throw new Error(
        `projectToolCalls: internal invariant violated for ${id}`,
      );
    }
    return call;
  });
}
