// Deterministic in-browser mirror of the @caisson/agent-trajectory contract for the "Replay a run"
// poke (ADR-0378 lock 2, flagship F-agent-trajectory). The package's own `project()` (replay.ts) has
// no runtime import beyond type-only references to schema.ts, so it is ALREADY browser-safe on its
// own — but the package exposes only one entry point (`exports["."]` in package.json), and that
// barrel (`src/index.ts`) also re-exports `store.pg.ts` / `run-state.pg.ts`, which pull
// `@caisson/tenancy-rls` and a Postgres driver. Importing "@caisson/agent-trajectory" from a client
// component would drag that whole graph into the browser bundle. So this file mirrors the two pure
// pieces byte-for-byte instead (`EVENT_KINDS` + the payload shapes from schema.ts, `project()` from
// replay.ts), and agent-trajectory-logic.test.ts pins the mirror against the real package under bun.
//
// Sources mirrored: packages/agent-trajectory/src/schema.ts (EVENT_KINDS, DigestRef, BillingStatus,
// the per-kind payload shapes, the model.usage credits/billingStatus invariant), packages/agent-
// trajectory/src/replay.ts (`project` — the deterministic fold; tool.* and model.call carry no
// projection state there, "recorded, replayable, not folded" per that file's own comment, mirrored
// verbatim below). No __golden__ fixture directory exists for this package (checked); parity is
// pinned directly against the real package's exported functions instead.

// --- Shapes (mirror of schema.ts) ---------------------------------------------------------------

/** The eleven event kinds — the closed vocabulary of the trajectory contract (schema.ts). */
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
export type EventKind = (typeof EVENT_KINDS)[number];

/** A reference to a sensitive body, never the body itself (AR-4, schema.ts `DigestRef`). */
export interface DigestRef {
  readonly digest: string;
  readonly byteLength: number;
  readonly encRef?: string;
}

export type BillingStatus = "metered" | "priced" | "estimated" | "unsupported";

interface RunStartedPayload {
  readonly agentId: string;
  readonly input?: DigestRef;
  readonly labels?: Readonly<Record<string, string>>;
}
interface RunFinishedPayload {
  readonly status: "completed" | "failed" | "cancelled";
  readonly output?: DigestRef;
  readonly reason?: string;
}
interface StepStartedPayload {
  readonly stepId: string;
  readonly parentStepId?: string;
  readonly depth: number;
  readonly label?: string;
}
interface StepFinishedPayload {
  readonly stepId: string;
  readonly status: "ok" | "error";
  readonly errorCode?: string;
}
interface ModelCallPayload {
  readonly stepId?: string;
  readonly provider: string;
  readonly model: string;
  readonly prompt: DigestRef;
}
export interface ModelUsagePayload {
  readonly stepId?: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly credits: number;
  readonly billingStatus: BillingStatus;
  readonly priceBookVersion?: string;
}
interface ToolProposedPayload {
  readonly stepId: string;
  readonly toolCallId: string;
  readonly name: string;
  readonly args: DigestRef;
}
interface ToolApprovedPayload {
  readonly toolCallId: string;
  readonly actor: string;
}
interface ToolDeniedPayload {
  readonly toolCallId: string;
  readonly actor: string;
  readonly reason?: string;
}
interface ToolResultPayload {
  readonly toolCallId: string;
  readonly ok: boolean;
  readonly result: DigestRef;
  readonly exitCode?: number;
}
interface CheckpointPayload {
  readonly checkpointId: string;
  readonly label?: string;
  readonly state?: DigestRef;
}

/** The event envelope, discriminated on `kind` (mirror of schema.ts's per-kind `event()` builder). */
export type TrajectoryEvent =
  | { kind: "run.started"; payload: RunStartedPayload }
  | { kind: "run.finished"; payload: RunFinishedPayload }
  | { kind: "step.started"; payload: StepStartedPayload }
  | { kind: "step.finished"; payload: StepFinishedPayload }
  | { kind: "model.call"; payload: ModelCallPayload }
  | { kind: "model.usage"; payload: ModelUsagePayload }
  | { kind: "tool.proposed"; payload: ToolProposedPayload }
  | { kind: "tool.approved"; payload: ToolApprovedPayload }
  | { kind: "tool.denied"; payload: ToolDeniedPayload }
  | { kind: "tool.result"; payload: ToolResultPayload }
  | { kind: "checkpoint"; payload: CheckpointPayload };
type TrajectoryEventBase = {
  readonly eventId: string;
  readonly runId: string;
  readonly seq: number;
  readonly version: number;
  readonly occurredAt: string;
};
export type Event = TrajectoryEventBase & TrajectoryEvent;

// --- project() (exact mirror of packages/agent-trajectory/src/replay.ts) -----------------------

export interface StepNode {
  readonly stepId: string;
  readonly parentStepId?: string;
  readonly depth: number;
  readonly label?: string;
  readonly status: "running" | "ok" | "error";
  readonly children: StepNode[];
}
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
  readonly usageTotals: Record<BillingStatus, UsageTotal>;
  readonly checkpoints: CheckpointMark[];
}

const zeroTotal = (): UsageTotal => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  credits: 0,
});

export function project(events: readonly Event[]): RunProjection {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const runId = ordered[0]?.runId ?? "";

  let status: RunProjection["status"] = "pending";
  const usageTotals: Record<BillingStatus, UsageTotal> = {
    metered: zeroTotal(),
    priced: zeroTotal(),
    estimated: zeroTotal(),
    unsupported: zeroTotal(),
  };
  const checkpoints: CheckpointMark[] = [];

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
      // model.call / tool.* carry no projection state in slice 1 (recorded, replayable, not
      // folded) — the exact boundary replay.ts documents on its own `project()`.
      default:
        break;
    }
  }

  return { runId, status, steps: roots, usageTotals, checkpoints };
}

/** Reorder for the replay check: reverse arrival order, exactly the permutation replay.test.ts
 *  asserts folds identically (`project()` sorts by `seq` before folding, so order never matters). */
export function reversedArrival(events: readonly Event[]): Event[] {
  return [...events].reverse();
}

// --- the model.usage credits/billingStatus invariant (exact mirror of schema.ts's superRefine) --

export interface UsageValidation {
  readonly ok: boolean;
  readonly message?: string;
}

/** Mirror of `ModelUsagePayload`'s superRefine in schema.ts — the ONE invariant this poke's tamper
 *  can break: credits are only a legal claim on a billing-grade band. Message text is verbatim. */
export function validateUsage(payload: ModelUsagePayload): UsageValidation {
  if (
    payload.credits > 0 &&
    payload.billingStatus !== "metered" &&
    payload.billingStatus !== "priced"
  ) {
    return {
      ok: false,
      message: `credits must be 0 when billingStatus is "${payload.billingStatus}" (only metered/priced carry credit claims)`,
    };
  }
  return { ok: true };
}

// --- the poke model (baked sample run + state operations) ---------------------------------------

const DIGEST_INPUT = "4f3c2a1e".repeat(8);
const DIGEST_PROMPT = "9b7d1f60".repeat(8);
const DIGEST_ARGS_1 = "1a2b3c4d".repeat(8);
const DIGEST_RESULT_1 = "c0ffee01".repeat(8);
const DIGEST_ARGS_2 = "5e6f7a8b".repeat(8);
const DIGEST_STATE = "de0adbe1".repeat(8);
const DIGEST_OUTPUT = "f00dfeed".repeat(8);

const AT = "2026-07-21T09:00:00.000Z";
const RUN_ID = "run-sample-a1c9";

/** The credits committed by the recorded sample event (before any tamper). */
export const RECORDED_METERED_CREDITS = 5;

/** A one-run narrative touching all eleven kinds (a second `tool.proposed` for the denied call). */
export const SAMPLE_RUN: readonly Event[] = [
  {
    eventId: "11111111-1111-4111-8111-000000000000",
    runId: RUN_ID,
    seq: 0,
    version: 1,
    occurredAt: AT,
    kind: "run.started",
    payload: {
      agentId: "agent-github-triage",
      input: { digest: DIGEST_INPUT, byteLength: 214 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000001",
    runId: RUN_ID,
    seq: 1,
    version: 1,
    occurredAt: AT,
    kind: "step.started",
    payload: { stepId: "s1", depth: 0, label: "triage-issue" },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000002",
    runId: RUN_ID,
    seq: 2,
    version: 1,
    occurredAt: AT,
    kind: "model.call",
    payload: {
      stepId: "s1",
      provider: "anthropic",
      model: "claude-sonnet-5",
      prompt: { digest: DIGEST_PROMPT, byteLength: 1840 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000003",
    runId: RUN_ID,
    seq: 3,
    version: 1,
    occurredAt: AT,
    kind: "model.usage",
    payload: {
      stepId: "s1",
      provider: "anthropic",
      model: "claude-sonnet-5",
      inputTokens: 812,
      outputTokens: 96,
      cachedInputTokens: 240,
      credits: RECORDED_METERED_CREDITS,
      billingStatus: "metered",
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000004",
    runId: RUN_ID,
    seq: 4,
    version: 1,
    occurredAt: AT,
    kind: "tool.proposed",
    payload: {
      stepId: "s1",
      toolCallId: "call-1",
      name: "label_issue",
      args: { digest: DIGEST_ARGS_1, byteLength: 48 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000005",
    runId: RUN_ID,
    seq: 5,
    version: 1,
    occurredAt: AT,
    kind: "tool.approved",
    payload: { toolCallId: "call-1", actor: "policy:auto-approve" },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000006",
    runId: RUN_ID,
    seq: 6,
    version: 1,
    occurredAt: AT,
    kind: "tool.result",
    payload: {
      toolCallId: "call-1",
      ok: true,
      result: { digest: DIGEST_RESULT_1, byteLength: 12 },
      exitCode: 0,
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000007",
    runId: RUN_ID,
    seq: 7,
    version: 1,
    occurredAt: AT,
    kind: "tool.proposed",
    payload: {
      stepId: "s1",
      toolCallId: "call-2",
      name: "close_repo",
      args: { digest: DIGEST_ARGS_2, byteLength: 20 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000008",
    runId: RUN_ID,
    seq: 8,
    version: 1,
    occurredAt: AT,
    kind: "tool.denied",
    payload: {
      toolCallId: "call-2",
      actor: "policy:auto-approve",
      reason: "not allowlisted",
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000009",
    runId: RUN_ID,
    seq: 9,
    version: 1,
    occurredAt: AT,
    kind: "checkpoint",
    payload: {
      checkpointId: "c1",
      label: "after-tools",
      state: { digest: DIGEST_STATE, byteLength: 3072 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000010",
    runId: RUN_ID,
    seq: 10,
    version: 1,
    occurredAt: AT,
    kind: "step.finished",
    payload: { stepId: "s1", status: "ok" },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000011",
    runId: RUN_ID,
    seq: 11,
    version: 1,
    occurredAt: AT,
    kind: "run.finished",
    payload: {
      status: "completed",
      output: { digest: DIGEST_OUTPUT, byteLength: 96 },
    },
  },
];

export type TamperMove = "none" | "inflate" | "invariant";

export interface PokeState {
  readonly events: readonly Event[];
  readonly tamper: TamperMove;
}

export function initialState(): PokeState {
  return { events: SAMPLE_RUN, tamper: "none" };
}

function withUsage(
  events: readonly Event[],
  mutate: (p: ModelUsagePayload) => ModelUsagePayload,
): Event[] {
  return events.map((e) =>
    e.kind === "model.usage" ? { ...e, payload: mutate(e.payload) } : e,
  );
}

/** Tamper move 1: inflate a schema-valid field. The event stays well-formed; the projected total
 *  no longer matches what the run recorded. */
export function inflateCredits(state: PokeState): PokeState {
  return {
    events: withUsage(state.events, (p) => ({
      ...p,
      credits: p.credits * 100,
    })),
    tamper: "inflate",
  };
}

/** Tamper move 2: break the credits/billingStatus invariant itself — the exact shape schema.ts's
 *  `ModelUsagePayload` refinement rejects at the ingestion boundary. */
export function breakInvariant(state: PokeState): PokeState {
  return {
    events: withUsage(state.events, (p) => ({
      ...p,
      billingStatus: "estimated",
    })),
    tamper: "invariant",
  };
}

export function reset(): PokeState {
  return initialState();
}

function usagePayload(events: readonly Event[]): ModelUsagePayload {
  const e = events.find(
    (ev): ev is Event & { kind: "model.usage" } => ev.kind === "model.usage",
  );
  if (e === undefined)
    throw new Error("sample run always carries a model.usage event");
  return e.payload;
}

export interface ReplayResult {
  readonly projection: RunProjection;
  /** True when replaying the reversed-arrival order folds to a byte-identical projection. */
  readonly orderIndependent: boolean;
  readonly usage: UsageValidation;
}

/** Replay the current log twice (recorded order + reversed arrival) and check the model.usage
 *  invariant on the current (possibly tampered) event — mirrors what `project()` actually computes
 *  and what `TrajectoryStore.append`'s `parseStrict` gate actually rejects; the two never overlap
 *  (`project()` never re-validates, `append` never re-projects), and this poke shows both honestly. */
export function evaluate(state: PokeState): ReplayResult {
  const ordered = project(state.events);
  const reversed = project(reversedArrival(state.events));
  return {
    projection: ordered,
    orderIndependent: JSON.stringify(ordered) === JSON.stringify(reversed),
    usage: validateUsage(usagePayload(state.events)),
  };
}

export interface VerdictLine {
  readonly state: "ok" | "fail";
  readonly text: string;
}

/** The headline verdict, computed from the replay result, never asserted copy (ADR-0375: no em
 *  dashes). */
export function verdictLine(r: ReplayResult, state: PokeState): VerdictLine {
  if (!r.orderIndependent) {
    return {
      state: "fail",
      text: "Reversed-arrival replay produced a different projection. project() should never do this.",
    };
  }
  if (!r.usage.ok) {
    return {
      state: "fail",
      text: r.usage.message ?? "model.usage failed validation.",
    };
  }
  const metered = r.projection.usageTotals.metered.credits;
  if (state.tamper === "inflate" && metered !== RECORDED_METERED_CREDITS) {
    return {
      state: "fail",
      text: `usageTotals.metered.credits reads ${metered}. The run recorded ${RECORDED_METERED_CREDITS}.`,
    };
  }
  return {
    state: "ok",
    text: "Replayed recorded order and reversed arrival: byte-identical projection.",
  };
}

/**
 * Short display form of a digest (same presentation helper as audit-worm-poke.tsx's `shortHash`).
 */
export function shortDigest(digest: string): string {
  return `${digest.slice(0, 6)}…${digest.slice(-4)}`;
}

/** One-line human summary per event kind, for the timeline strip. Every field read here is real
 *  (schema.ts's payload shape for that kind) — no invented labels. */
export function eventSummary(event: Event): string {
  switch (event.kind) {
    case "run.started":
      return `agent ${event.payload.agentId}`;
    case "run.finished":
      return `status ${event.payload.status}`;
    case "step.started":
      return `${event.payload.label ?? event.payload.stepId} (depth ${event.payload.depth})`;
    case "step.finished":
      return `${event.payload.stepId} → ${event.payload.status}`;
    case "model.call":
      return `${event.payload.provider}/${event.payload.model}`;
    case "model.usage":
      return `${event.payload.provider}/${event.payload.model}, ${event.payload.inputTokens}in/${event.payload.outputTokens}out, ${event.payload.credits}cr (${event.payload.billingStatus})`;
    case "tool.proposed":
      return `${event.payload.name} (${event.payload.toolCallId})`;
    case "tool.approved":
      return `approved by ${event.payload.actor}`;
    case "tool.denied":
      return `denied by ${event.payload.actor}${event.payload.reason ? `, ${event.payload.reason}` : ""}`;
    case "tool.result":
      return `${event.payload.toolCallId} → ${event.payload.ok ? "ok" : "error"}`;
    case "checkpoint":
      return `${event.payload.label ?? event.payload.checkpointId}`;
    default:
      return "";
  }
}

/** The DigestRef carried by this event, if any (the field varies by kind, schema.ts) — never the
 *  body it references. */
export function eventDigest(event: Event): DigestRef | undefined {
  switch (event.kind) {
    case "run.started":
      return event.payload.input;
    case "run.finished":
      return event.payload.output;
    case "model.call":
      return event.payload.prompt;
    case "tool.proposed":
      return event.payload.args;
    case "tool.result":
      return event.payload.result;
    case "checkpoint":
      return event.payload.state;
    default:
      return undefined;
  }
}
