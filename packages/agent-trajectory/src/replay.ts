// Replay = a deterministic PROJECTION (SPEC verification): `project(events) -> RunProjection`.
// The SAME events always yield a BYTE-IDENTICAL projection regardless of arrival order — the fold
// sorts by `seq` first, so a shuffled batch (e.g. out-of-order stream delivery) resolves to one
// canonical result. This is the shape evals score and the audit chain can anchor; it is a pure
// function of the event log, never of wall-clock or map-iteration order.
import type { BillingStatus, TrajectoryEvent } from "./schema.ts";

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
  /** One entry per billingStatus band, always all three keys in a fixed order (deterministic). */
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
  const usageTotals: Record<BillingStatus, UsageTotal> = {
    metered: zeroTotal(),
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
