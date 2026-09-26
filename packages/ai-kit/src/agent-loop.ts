// The bounded tool loop (the agent-runtime loop slice, ADR-0360 U-1) — the caller-owned per-step harness the
// v7 seam spike blessed as pattern (d): one `generateText` per step (`stopWhen: stepCountIs(1)`,
// `responseMessages` threaded forward), with reserve-before-step and settle-after-step in THIS
// module's own try/catch — NEVER in an SDK lifecycle callback (`onStepEnd` swallows throws;
// `SPIKE-v7-seam.md` findings a/b are binding).
//
// Governance per step: every model step AND tool step reserves through ai-meter before execution
// (a tool step takes a zero-credit reservation — empty messages, maxOutputTokens 0 — which still
// runs the breaker/caps gate). A reserve failure (402) or a REQUIRED trajectory-append failure
// PREVENTS the step — the fail-closed inversion of ADR-0351 rider 1; the gateway's slice-1
// recorder stays fail-soft, but every append in THIS loop is envelope truth and fail-closed.
// Budget is enforced caller-side per step (`stopWhen` counts steps, not spend): a step whose
// reservation estimate would cross the remaining budget fails the run with 402 semantics before
// any provider spend.
//
// Tools are declared to the SDK schema-only (no `execute`): the model proposes, the SDK validates
// input against `inputSchema`, and THIS loop executes between steps — reserve → execute → settle,
// with `tool.proposed`/`tool.result` appended around the execution (args/results as DigestRef only,
// AR-4).
//
// APPROVAL GATING (ADR-0360 U-3, S3): a `LoopTool` marked `approvalRequired` parks the run instead
// of executing — `tool.proposed` is appended, `RunStateStore.park` records the pending toolCallId +
// a resumable snapshot (`ParkedState`: the conversation, the step's remaining proposed calls, and
// step/credit counters), and `runToolLoop` returns `status: "parked"`. `resumeToolLoop` (below)
// re-hydrates that snapshot after an external approval and continues the SAME run — see
// `approval.ts` for `approveToolCall`/`denyToolCall`, the operator-facing entrypoints that transition
// the run-state CAS and enqueue the resume job.
//
// Guard boundary (documented, deliberate): the opening prompt is input-guarded (moderation + PII)
// before any spend, and the final text is output-guarded before it is returned. Intermediate
// tool-conversation traffic is digest-referenced in the trajectory but not re-guarded per step —
// see `LoopTool.approvalRequired` below for what that means for a tool author.
//
// ACCEPTED RESIDUALS (2026-07-17 SHIP audit, recorded): (F3) reserve and settle are separate
// transactions — a settle/refund transaction that itself fails leaves an orphaned hold, classified
// `"settle"` so an out-of-band reconciler (the closing dependency; usage_event idempotency makes
// its retries safe) can sweep it. (F5) the memory TrajectoryStore is tenant-blind — acceptable for
// tests/single-process; the S3 PG store carries tenant RLS. `ToolLoopResult.failure.message` may
// carry raw provider/tool error text — in-process only, never persisted; callers treat as sensitive.
//
// S3 residual (recorded, mirrors F5's shape): `ParkedState.messages`/`calls` persist the actual
// conversation + tool-call bodies in `agent_run_state.parked_state` — NOT digest-referenced. This is
// deliberate and does not weaken AR-4: AR-4's digest-only discipline binds the append-only
// TRAJECTORY LOG specifically (the substrate meant to be safely persisted/replayed/anchored); the
// run-state table is operational, mutable, never replayed or scored, and a real cross-process
// resume is impossible without the actual bodies (the trajectory log alone cannot reconstruct them).
// A future encrypted-body-store could replace the inline snapshot with a `DigestRef.encRef` pointer
// without changing this loop's shape.
import { createHash, randomUUID } from "node:crypto";
import {
  generateText,
  stepCountIs,
  tool,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { z } from "zod";
import type { AiSettings } from "@caisson-sh/ai-config";
import { resolveProvider } from "@caisson-sh/ai-config";
import {
  TRAJECTORY_VERSION,
  type RunStateStore,
  type TrajectoryEvent,
  type TrajectoryStore,
} from "@caisson-sh/agent-trajectory";
import {
  BUNDLED_PRICE_BOOK,
  CREDIT_CONVERSION,
  computeCost,
  estimateUsage,
  reconcile,
  reserve,
  resolvePriceEntry,
} from "@caisson-sh/ai-meter";
import type { MeterConfig, ReconcileResult, Usage } from "@caisson-sh/ai-meter";
import { guardInput, guardOutput } from "@caisson-sh/guardrails";
import { withTenant } from "@caisson-sh/tenancy-rls";
import type { Transactor } from "@caisson-sh/tenancy-rls";
import { ConflictError, parseStrict } from "@caisson-sh/kernel";
import type { CreditConversion } from "@caisson-sh/kernel";
import type { GuardConfig, ModelResolver } from "./gateway.ts";
import { canPersistUsage, normalizeLanguageUsage } from "./usage.ts";

const ZERO_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
};

/** A tool the LOOP executes (never the SDK): schema for the model, execute for the harness. */
export interface LoopTool {
  readonly description: string;
  readonly inputSchema: z.ZodType;
  /** Executed by the loop between steps, after its own zero-credit breaker-gated reservation. */
  readonly execute: (input: unknown) => Promise<unknown>;
  /**
   * When true (ADR-0360 S3), the loop NEVER calls `execute` itself: the run parks (appends
   * `tool.proposed`, records durable run-state) and waits for an external `approveToolCall`/
   * `denyToolCall` decision. Requires `RunToolLoopOptions.runState` — omitting it while a gated
   * tool is invoked is a caller config error (`ToolLoopFailureCode: "tool"`).
   *
   * Guard boundary (documented, deliberate): only the opening prompt (input) and the final text
   * (output) are guarded (moderation + PII). Intermediate tool output — this tool's `execute`
   * result — is appended straight into model context UN-GUARDED; it is digest-referenced in the
   * trajectory but not re-guarded per step. Any tool with side effects or egress (writes data,
   * calls an external system, spends money) should set `approvalRequired: true` — the approval
   * seam is the gate for tool content, not per-step guarding.
   */
  readonly approvalRequired?: boolean;
}

export interface RunToolLoopOptions {
  readonly tx: Transactor;
  readonly accountId: string;
  readonly settings: AiSettings;
  readonly resolveModel: ModelResolver;
  readonly guard: GuardConfig;
  readonly meter?: MeterConfig;
  readonly lane: string;
  /** Stamped on `run.started` (the trajectory's agent identity). */
  readonly agentId: string;
  /** The opening user prompt — input-guarded before any spend. */
  readonly prompt: string;
  readonly tools: Readonly<Record<string, LoopTool>>;
  /** Hard step ceiling (int > 0). A run that still wants tools at the ceiling fails `step-ceiling`. */
  readonly maxSteps: number;
  /** Integer credit budget across the whole run; crossing it mid-run is a 402-shaped failure. */
  readonly creditBudget: number;
  /** REQUIRED envelope store — every append here is fail-closed (append failure stops the run). */
  readonly store: TrajectoryStore;
  /**
   * The durable run-state store (ADR-0360 S3). REQUIRED only when at least one tool carries
   * `approvalRequired: true` — a gated tool invoked without it fails the run fail-closed rather
   * than silently executing.
   */
  readonly runState?: RunStateStore;
  /**
   * The run's identity AND the idempotency root: per-step meter call ids derive from it, so a
   * same-runId retry settles exactly once. SECURITY (audit F2): this MUST be server-controlled —
   * never derived from client/untrusted input — or a replayed runId turns idempotent no-ops into
   * free inference. Omit to get a server-random uuid.
   */
  readonly runId?: string;
  readonly maxOutputTokens?: number;
  readonly abortSignal?: AbortSignal;
}

export type ToolLoopFailureCode =
  | "budget-exceeded"
  | "reserve-402"
  | "trajectory-append"
  | "provider"
  | "tool"
  | "guard"
  | "step-ceiling"
  /** A settle/refund transaction failed AFTER its reserve committed: the hold is orphaned until
   * the out-of-band reconciler sweeps it (audit F3). Distinct so orphans are discoverable. */
  | "settle";

export interface ToolLoopResult {
  readonly runId: string;
  readonly status: "completed" | "failed" | "parked";
  readonly stepsUsed: number;
  /** Settled ledger actuals summed across every step (integer credits). */
  readonly creditsSpent: number;
  /** The final model text on completion; "" on failure or park. */
  readonly text: string;
  readonly failure?: { code: ToolLoopFailureCode; message: string };
  /** Present only when `status === "parked"` — the toolCallId awaiting approval. */
  readonly toolCallId?: string;
}

/** Content-address a JSON-serializable body (AR-4: digests travel, bodies never do). */
function digestOf(value: unknown): { digest: string; byteLength: number } {
  const canonical = JSON.stringify(value) ?? "null";
  return {
    digest: createHash("sha256").update(canonical).digest("hex"),
    byteLength: Buffer.byteLength(canonical, "utf8"),
  };
}

/** Flatten a ModelMessage's content to text for the reservation estimate (chars/4 heuristic). */
function messageText(m: ModelMessage): string {
  if (typeof m.content === "string") return m.content;
  return m.content
    .map((part) =>
      "text" in part && typeof part.text === "string"
        ? part.text
        : JSON.stringify(part),
    )
    .join("\n");
}

class LoopFailure extends Error {
  constructor(
    readonly code: ToolLoopFailureCode,
    message: string,
  ) {
    super(message);
  }
}

/** Thrown (never a normal return) when the loop parks on a gated tool — the outer try/catch in
 *  `runToolLoop`/`resumeToolLoop` converts this into a `status: "parked"` result, NOT a failure:
 *  the run is paused, not finished, so `run.finished` must never be appended for this outcome. */
class LoopParked extends Error {
  constructor(readonly toolCallId: string) {
    super(`parked pending approval of tool call ${toolCallId}`);
  }
}

/** A proposed SDK tool call, reduced to the minimal structural shape the loop's tool machinery
 *  needs — both the live `ai` SDK result and the JSON-round-tripped `ParkedState.calls` satisfy it. */
interface PlainToolCall {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: unknown;
}

/**
 * The opaque resumable snapshot (ADR-0360 S3) a parked run stashes in `RunStateStore.parkedState`.
 * `messages`/`calls` carry the REAL conversation + proposed tool-call bodies (see the file-header
 * S3 residual note on why this is not digest-only, unlike the trajectory log). Validated with
 * `parseStrict` on read — a persistence boundary, even though this process wrote it.
 */
interface ParkedState {
  readonly stepId: string;
  /** Every tool call the model proposed in the parked step, in SDK order. */
  readonly calls: readonly PlainToolCall[];
  /** Index into `calls` of the call that triggered the park. */
  readonly callIndex: number;
  readonly messages: readonly ModelMessage[];
  readonly stepsUsed: number;
  readonly creditsSpent: number;
}

const ParkedStateSchema = z
  .object({
    stepId: z.string().min(1),
    calls: z.array(
      z
        .object({
          toolCallId: z.string().min(1),
          toolName: z.string().min(1),
          input: z.unknown(),
        })
        .strict(),
    ),
    callIndex: z.number().int().nonnegative(),
    // The `ai` SDK's ModelMessage union is deep and version-pinned elsewhere (the v7 seam spike);
    // re-encoding it in Zod here would drift independently. Structural array-of-objects is the
    // useful boundary check — the SDK itself validates message shape when `generateText` runs.
    messages: z.array(z.record(z.string(), z.unknown())),
    stepsUsed: z.number().int().nonnegative(),
    creditsSpent: z.number().int().nonnegative(),
  })
  .strict();

/** Everything the step machinery needs, threaded through the extracted helpers below instead of
 *  closed-over `let`s — the SAME context serves a fresh run AND a resumed one. */
interface Engine {
  readonly runId: string;
  readonly tx: Transactor;
  readonly accountId: string;
  readonly lane: string;
  readonly meter?: MeterConfig;
  readonly tools: Readonly<Record<string, LoopTool>>;
  readonly cfg: { readonly provider: string; readonly model: string };
  readonly runState?: RunStateStore;
  readonly append: (
    kind: TrajectoryEvent["kind"],
    payload: unknown,
  ) => Promise<void>;
  readonly currentSeq: () => number;
  readonly settleStep: (
    callId: string,
    reservedCredits: number,
    windowKey: string,
    usage: Usage,
    usageReported: boolean,
  ) => Promise<ReconcileResult>;
  readonly finishRun: (
    status: "completed" | "failed",
    reason?: string,
  ) => Promise<void>;
}

/** Mutable per-run progress, shared by reference across every helper (the resumed path primes it
 *  from `ParkedState` instead of zero-values). */
interface LoopState {
  readonly messages: ModelMessage[];
  creditsSpent: number;
  stepsUsed: number;
  finalText: string;
}

/** Fail-closed envelope appends starting at `startSeq` (0 for a fresh run, `resumeSeq` on resume):
 *  ANY append failure is a run-stopping `trajectory-append` failure (ADR-0351 rider-1 inversion). */
function createAppender(
  store: TrajectoryStore,
  runId: string,
  startSeq: number,
): {
  append: Engine["append"];
  currentSeq: () => number;
} {
  let seq = startSeq;
  return {
    async append(kind, payload) {
      const event = {
        eventId: randomUUID(),
        runId,
        seq,
        version: TRAJECTORY_VERSION,
        occurredAt: new Date().toISOString(),
        kind,
        payload,
      } as TrajectoryEvent;
      try {
        await store.append(event);
      } catch (err) {
        throw new LoopFailure(
          "trajectory-append",
          `required append (${kind}, seq ${String(seq)}) failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      seq += 1;
    },
    currentSeq: () => seq,
  };
}

/** Reserve (zero-credit, breaker-gated) → execute → settle for ONE already-proposed, non-gated (or
 *  just-approved) tool call. Appends `tool.result` and pushes the resulting tool-result message. */
async function runOneToolCall(
  engine: Engine,
  toolCallKey: string,
  toolCallId: string,
  impl: LoopTool,
  call: PlainToolCall,
  stepId: string,
  state: LoopState,
): Promise<void> {
  // The tool step's own reservation: zero credits, but the BREAKER gate still runs (the caps
  // evaluation is a no-op on a zero-spend reserve) — an open breaker 402s HERE, before the tool
  // executes.
  let toolReserved;
  try {
    toolReserved = await withTenant(engine.tx, engine.accountId, (t) =>
      reserve(t, {
        accountId: engine.accountId,
        callId: toolCallKey,
        provider: engine.cfg.provider,
        model: engine.cfg.model,
        lane: engine.lane,
        messages: [],
        maxOutputTokens: 0,
        ...(engine.meter !== undefined ? { config: engine.meter } : {}),
      }),
    );
  } catch (err) {
    await engine.append("tool.result", {
      toolCallId,
      ok: false,
      result: digestOf("reserve failed"),
    });
    await engine.append("step.finished", {
      stepId,
      status: "error",
      errorCode: "reserve-402",
    });
    throw new LoopFailure(
      "reserve-402",
      err instanceof Error ? err.message : String(err),
    );
  }

  let output: unknown;
  try {
    output = await impl.execute(call.input);
  } catch (err) {
    try {
      await engine.settleStep(
        toolCallKey,
        toolReserved.reservedCredits,
        toolReserved.windowKey,
        ZERO_USAGE,
        true,
      );
    } catch (settleErr) {
      throw new LoopFailure(
        "settle",
        `tool refund failed (orphaned reservation ${toolCallKey}): ${settleErr instanceof Error ? settleErr.message : String(settleErr)}`,
      );
    }
    await engine.append("tool.result", {
      toolCallId,
      ok: false,
      result: digestOf(err instanceof Error ? err.message : String(err)),
    });
    await engine.append("step.finished", {
      stepId,
      status: "error",
      errorCode: "tool",
    });
    throw new LoopFailure(
      "tool",
      `tool "${call.toolName}" failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Settle the zero-credit tool reservation at reserved (usage unreported) — the usage_event row
  // is the tool step's audit trail.
  try {
    await engine.settleStep(
      toolCallKey,
      toolReserved.reservedCredits,
      toolReserved.windowKey,
      ZERO_USAGE,
      false,
    );
  } catch (settleErr) {
    throw new LoopFailure(
      "settle",
      `tool settle failed (orphaned reservation ${toolCallKey}): ${settleErr instanceof Error ? settleErr.message : String(settleErr)}`,
    );
  }
  await engine.append("tool.result", {
    toolCallId,
    ok: true,
    result: digestOf(output),
  });
  state.messages.push({
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId,
        toolName: call.toolName,
        output: { type: "json", value: output as never },
      },
    ],
  });
}

/**
 * Process `calls[startIndex..]` for one step: propose → allowlist check → gate check →
 * (execute XOR park). A gated tool PARKS the run (durable run-state + `LoopParked` throw) instead
 * of executing — used both for a step's FRESH tool-call batch (`startIndex: 0`) and for the
 * REMAINDER of a batch after a resumed call finishes (`startIndex: parked.callIndex + 1`).
 */
async function runToolCallBatch(
  engine: Engine,
  stepId: string,
  stepCallId: string,
  calls: readonly PlainToolCall[],
  startIndex: number,
  state: LoopState,
): Promise<void> {
  for (let i = startIndex; i < calls.length; i += 1) {
    const call = calls[i];
    if (call === undefined) continue;
    const toolCallId = call.toolCallId;
    const toolCallKey = `${stepCallId}:${toolCallId}`;
    await engine.append("tool.proposed", {
      stepId,
      toolCallId,
      name: call.toolName,
      args: digestOf(call.input),
    });

    const impl = engine.tools[call.toolName];
    if (impl === undefined) {
      await engine.append("tool.result", {
        toolCallId,
        ok: false,
        result: digestOf("tool not allowlisted"),
      });
      await engine.append("step.finished", {
        stepId,
        status: "error",
        errorCode: "tool",
      });
      throw new LoopFailure(
        "tool",
        `model proposed unknown tool "${call.toolName}"`,
      );
    }

    if (impl.approvalRequired === true) {
      if (engine.runState === undefined) {
        await engine.append("step.finished", {
          stepId,
          status: "error",
          errorCode: "tool",
        });
        throw new LoopFailure(
          "tool",
          `tool "${call.toolName}" requires approval but no runState store was configured`,
        );
      }
      const parkedState: ParkedState = {
        stepId,
        calls,
        callIndex: i,
        messages: [...state.messages],
        stepsUsed: state.stepsUsed,
        creditsSpent: state.creditsSpent,
      };
      await engine.runState.park({
        runId: engine.runId,
        toolCallId,
        resumeSeq: engine.currentSeq(),
        parkedState,
      });
      throw new LoopParked(toolCallId);
    }

    await runOneToolCall(
      engine,
      toolCallKey,
      toolCallId,
      impl,
      call,
      stepId,
      state,
    );
  }
}

/** Build the schema-only SDK tool declarations — the loop, not the SDK, executes (governed
 *  interposition). Shared by the fresh path and resume (both need the SAME `tools` schema set). */
function buildSdkTools(tools: Readonly<Record<string, LoopTool>>): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, t]) => [
      name,
      tool({ description: t.description, inputSchema: t.inputSchema }),
    ]),
  );
}

/**
 * The step-by-step engine (steps `startStep..maxSteps`), shared by a fresh run (`startStep: 1`)
 * and a resumed one (`startStep: <the step after the one that parked>`). Returns a `"completed"`
 * result on natural stop; throws `LoopFailure`/`LoopParked` otherwise (the caller's try/catch
 * converts those into `"failed"`/`"parked"` results).
 */
async function runSteps(
  engine: Engine,
  opts: {
    readonly resolveModel: ModelResolver;
    readonly lane: string;
    readonly maxSteps: number;
    readonly creditBudget: number;
    readonly maxOutputTokens?: number;
    readonly abortSignal?: AbortSignal;
    readonly guard: GuardConfig;
  },
  sdkTools: ToolSet,
  priceEntry: ReturnType<typeof resolvePriceEntry>,
  conversion: CreditConversion,
  startStep: number,
  state: LoopState,
): Promise<ToolLoopResult> {
  for (let step = startStep; step <= opts.maxSteps; step += 1) {
    const stepId = `s${String(step)}`;
    const stepCallId = `${engine.runId}:${stepId}`;
    await engine.append("step.started", { stepId, depth: 0 });
    state.stepsUsed = step;

    // Caller-side budget gate BEFORE the reservation debits anything: the step's own estimate
    // must fit the remaining budget (stopWhen counts steps, not spend — spike constraint 4).
    const estMessages = state.messages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: messageText(m),
    }));
    const estUsage = estimateUsage(estMessages, opts.maxOutputTokens);
    const est = computeCost(estUsage, priceEntry, conversion);
    // Fail-closed form: a NaN on either side must trip the guard, so the comparison asserts the
    // SAFE condition and negates it (the `!(x <= bound)` class) rather than testing overflow.
    if (!(state.creditsSpent + est.credits <= opts.creditBudget)) {
      await engine.append("step.finished", {
        stepId,
        status: "error",
        errorCode: "budget-exceeded",
      });
      throw new LoopFailure(
        "budget-exceeded",
        `step ${String(step)} estimate (${String(est.credits)} credits) would exceed the remaining budget (${String(opts.creditBudget - state.creditsSpent)} of ${String(opts.creditBudget)})`,
      );
    }

    // model.call is appended BEFORE the reserve (review BL-01): its payload has no dependency on
    // the reservation, and keeping the reserve→settle window free of REQUIRED appends means an
    // append failure can never orphan a committed debit.
    await engine.append("model.call", {
      stepId,
      provider: engine.cfg.provider,
      model: engine.cfg.model,
      prompt: digestOf(state.messages.map((m) => messageText(m))),
    });

    // Reserve (fail-closed 402): debit-before-spend for the model step.
    let reserved;
    try {
      reserved = await withTenant(engine.tx, engine.accountId, (t) =>
        reserve(t, {
          accountId: engine.accountId,
          callId: stepCallId,
          provider: engine.cfg.provider,
          model: engine.cfg.model,
          lane: opts.lane,
          messages: state.messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: messageText(m),
          })),
          ...(opts.maxOutputTokens !== undefined
            ? { maxOutputTokens: opts.maxOutputTokens }
            : {}),
          ...(engine.meter !== undefined ? { config: engine.meter } : {}),
        }),
      );
    } catch (err) {
      await engine.append("step.finished", {
        stepId,
        status: "error",
        errorCode: "reserve-402",
      });
      throw new LoopFailure(
        "reserve-402",
        err instanceof Error ? err.message : String(err),
      );
    }

    // The provider call — one SDK step exactly (pattern d). Failure refunds the reservation. The
    // output bound is ALWAYS passed and is the SAME number the estimate priced.
    let result;
    try {
      const model = await opts.resolveModel(opts.lane, engine.accountId);
      result = await generateText({
        model,
        messages: state.messages,
        tools: sdkTools,
        stopWhen: stepCountIs(1),
        maxOutputTokens: estUsage.outputTokens,
        ...(opts.abortSignal !== undefined
          ? { abortSignal: opts.abortSignal }
          : {}),
      });
    } catch (err) {
      try {
        await engine.settleStep(
          stepCallId,
          reserved.reservedCredits,
          reserved.windowKey,
          ZERO_USAGE,
          true,
        );
      } catch (settleErr) {
        await engine.append("step.finished", {
          stepId,
          status: "error",
          errorCode: "settle",
        });
        throw new LoopFailure(
          "settle",
          `refund failed after provider error (orphaned reservation ${stepCallId}): ${settleErr instanceof Error ? settleErr.message : String(settleErr)}`,
        );
      }
      await engine.append("step.finished", {
        stepId,
        status: "error",
        errorCode: "provider",
      });
      throw new LoopFailure(
        "provider",
        err instanceof Error ? err.message : String(err),
      );
    }

    // Settle at provider-reported usage, or at the reservation estimate when unreported.
    const normalized = normalizeLanguageUsage(result.usage);
    const reported =
      normalized !== null &&
      canPersistUsage(
        normalized,
        engine.cfg.provider,
        engine.cfg.model,
        engine.meter,
      )
        ? normalized
        : null;
    let reconciled: ReconcileResult;
    try {
      reconciled = await engine.settleStep(
        stepCallId,
        reserved.reservedCredits,
        reserved.windowKey,
        reported ?? estUsage,
        reported !== null,
      );
    } catch (settleErr) {
      await engine.append("step.finished", {
        stepId,
        status: "error",
        errorCode: "settle",
      });
      throw new LoopFailure(
        "settle",
        `settle failed (orphaned reservation ${stepCallId}): ${settleErr instanceof Error ? settleErr.message : String(settleErr)}`,
      );
    }
    state.creditsSpent += reconciled.actualCredits;

    await engine.append("model.usage", {
      stepId,
      provider: engine.cfg.provider,
      model: engine.cfg.model,
      inputTokens: (reported ?? estUsage).inputTokens,
      outputTokens: (reported ?? estUsage).outputTokens,
      cachedInputTokens: (reported ?? estUsage).cachedInputTokens,
      credits: reconciled.actualCredits,
      billingStatus: "metered",
    });

    state.messages.push(...result.responseMessages);

    if (result.finishReason !== "tool-calls") {
      // Natural stop: output-guard the final text, then complete.
      try {
        await guardOutput(result.text, opts.guard.policy, opts.guard.runtime);
      } catch (err) {
        await engine.append("step.finished", {
          stepId,
          status: "error",
          errorCode: "guard",
        });
        throw new LoopFailure(
          "guard",
          err instanceof Error ? err.message : String(err),
        );
      }
      state.finalText = result.text;
      await engine.append("step.finished", { stepId, status: "ok" });
      await engine.finishRun("completed");
      return {
        runId: engine.runId,
        status: "completed",
        stepsUsed: state.stepsUsed,
        creditsSpent: state.creditsSpent,
        text: state.finalText,
      };
    }

    // Tool phase: propose → gate → execute-or-park, per proposed call.
    await runToolCallBatch(
      engine,
      stepId,
      stepCallId,
      result.toolCalls.map((c) => ({
        toolCallId: c.toolCallId,
        toolName: c.toolName,
        input: c.input,
      })),
      0,
      state,
    );
    await engine.append("step.finished", { stepId, status: "ok" });
  }

  // Ceiling reached with the model still asking for tools: bounded means bounded.
  throw new LoopFailure(
    "step-ceiling",
    `run did not complete within maxSteps (${String(opts.maxSteps)})`,
  );
}

/**
 * Run a bounded, governed tool loop. Deterministic seam: the model comes from `resolveModel`
 * (a mock in tests — zero network), money moves only through ai-meter's reserve/reconcile
 * (idempotent per step on `"<runId>:s<step>"` call ids, so a crashed-and-retried step settles
 * exactly once), and the full run is an append-only trajectory in `store`.
 */
export async function runToolLoop(
  opts: RunToolLoopOptions,
): Promise<ToolLoopResult> {
  if (!Number.isInteger(opts.maxSteps) || opts.maxSteps <= 0)
    throw new RangeError("maxSteps must be a positive integer");
  if (!Number.isInteger(opts.creditBudget) || opts.creditBudget <= 0)
    throw new RangeError("creditBudget must be a positive integer (credits)");

  const { tx, accountId, store } = opts;
  const runId = opts.runId ?? randomUUID();
  const cfg = resolveProvider(opts.settings, opts.lane);
  const priceEntry = resolvePriceEntry(
    opts.meter?.priceBook ?? BUNDLED_PRICE_BOOK,
    cfg.provider,
    cfg.model,
  );
  const conversion = opts.meter?.conversion ?? CREDIT_CONVERSION;
  const { append, currentSeq } = createAppender(store, runId, 0);

  // Input-guard the opening prompt BEFORE any append or spend (a block costs nothing).
  let guardedPrompt: string;
  try {
    const out = await guardInput(
      opts.prompt,
      opts.guard.policy,
      opts.guard.runtime,
    );
    guardedPrompt = out.text;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  const sdkTools = buildSdkTools(opts.tools);
  const state: LoopState = {
    messages: [{ role: "user", content: guardedPrompt }],
    creditsSpent: 0,
    stepsUsed: 0,
    finalText: "",
  };

  const settleStep = (
    callId: string,
    reservedCredits: number,
    windowKey: string,
    usage: Usage,
    usageReported: boolean,
  ): Promise<ReconcileResult> =>
    withTenant(tx, accountId, (t) =>
      reconcile(t, {
        accountId,
        callId,
        provider: cfg.provider,
        model: cfg.model,
        lane: opts.lane,
        reservedCredits,
        usage,
        usageReported,
        windowKey,
        promptVersionId: null,
        ...(opts.meter !== undefined ? { config: opts.meter } : {}),
      }),
    );

  // Terminal append is BEST-EFFORT (review WR-02): by the time run.finished is written the run's
  // outcome — and its money — is already decided; a dead store must not convert a decided result
  // into a rejection (the projection then shows the run still "running", which is honest).
  const finishRun = async (
    status: "completed" | "failed",
    reason?: string,
  ): Promise<void> => {
    try {
      await append("run.finished", {
        status,
        ...(reason !== undefined ? { reason } : {}),
        ...(status === "completed" && state.finalText.length > 0
          ? { output: digestOf(state.finalText) }
          : {}),
      });
    } catch {
      // Swallowed by design — see above.
    }
  };

  const engine: Engine = {
    runId,
    tx,
    accountId,
    lane: opts.lane,
    ...(opts.meter !== undefined ? { meter: opts.meter } : {}),
    tools: opts.tools,
    cfg,
    ...(opts.runState !== undefined ? { runState: opts.runState } : {}),
    append,
    currentSeq,
    settleStep,
    finishRun,
  };

  try {
    await append("run.started", {
      agentId: opts.agentId,
      input: digestOf(guardedPrompt),
    });
    return await runSteps(
      engine,
      opts,
      sdkTools,
      priceEntry,
      conversion,
      1,
      state,
    );
  } catch (err) {
    if (err instanceof LoopParked) {
      return {
        runId,
        status: "parked",
        stepsUsed: state.stepsUsed,
        creditsSpent: state.creditsSpent,
        text: "",
        toolCallId: err.toolCallId,
      };
    }
    const failure =
      err instanceof LoopFailure
        ? err
        : new LoopFailure(
            "provider",
            err instanceof Error ? err.message : String(err),
          );
    await finishRun("failed", failure.code);
    return {
      runId,
      status: "failed",
      stepsUsed: state.stepsUsed,
      creditsSpent: state.creditsSpent,
      text: "",
      failure: { code: failure.code, message: failure.message },
    };
  }
}

/** `resumeToolLoop`'s options: the SAME shape `runToolLoop` needs minus `prompt` (the opening
 *  prompt is not re-guarded/re-spent on resume — it is already baked into the persisted
 *  conversation) — `runState` is REQUIRED (resume is meaningless without it). */
export interface ResumeToolLoopOptions extends Omit<
  RunToolLoopOptions,
  "prompt" | "runId" | "runState"
> {
  readonly runId: string;
  readonly runState: RunStateStore;
}

/**
 * Continue a parked run after its gated tool call was approved (ADR-0360 S3). Re-validates the
 * parked state in SQL via `RunStateStore.claimResume` (a CAS) so two concurrent resumes of the
 * SAME approval can never both execute the tool — the loser throws `ConflictError` before this
 * function runs any tool or model logic. Re-hydrates the conversation from the persisted
 * `ParkedState` snapshot (never from the trajectory log — see the file-header S3 residual note),
 * executes the approved call, continues any remaining calls in that step's batch, then resumes the
 * ordinary step loop from the next step.
 */
export async function resumeToolLoop(
  opts: ResumeToolLoopOptions,
): Promise<ToolLoopResult> {
  if (!Number.isInteger(opts.maxSteps) || opts.maxSteps <= 0)
    throw new RangeError("maxSteps must be a positive integer");
  if (!Number.isInteger(opts.creditBudget) || opts.creditBudget <= 0)
    throw new RangeError("creditBudget must be a positive integer (credits)");

  const { tx, accountId, store, runState, runId } = opts;

  const snapshot = await runState.read(runId);
  if (snapshot === undefined || snapshot.pendingToolCallId === null) {
    throw new ConflictError("nothing to resume for this run", { runId });
  }
  const toolCallId = snapshot.pendingToolCallId;
  // The CAS claim: fail-closed if this exact toolCallId was already claimed by another resume.
  const material = await runState.claimResume(runId, toolCallId);
  const parked = parseStrict(
    ParkedStateSchema,
    material.parkedState,
  ) as unknown as ParkedState;

  const approvedCall = parked.calls[parked.callIndex];
  if (approvedCall === undefined || approvedCall.toolCallId !== toolCallId) {
    throw new ConflictError(
      "parked state does not match the approved toolCallId",
      { runId, toolCallId },
    );
  }

  const cfg = resolveProvider(opts.settings, opts.lane);
  const priceEntry = resolvePriceEntry(
    opts.meter?.priceBook ?? BUNDLED_PRICE_BOOK,
    cfg.provider,
    cfg.model,
  );
  const conversion = opts.meter?.conversion ?? CREDIT_CONVERSION;
  const { append, currentSeq } = createAppender(
    store,
    runId,
    material.resumeSeq,
  );
  const sdkTools = buildSdkTools(opts.tools);

  const state: LoopState = {
    messages: [...parked.messages],
    creditsSpent: parked.creditsSpent,
    stepsUsed: parked.stepsUsed,
    finalText: "",
  };

  const settleStep = (
    callId: string,
    reservedCredits: number,
    windowKey: string,
    usage: Usage,
    usageReported: boolean,
  ): Promise<ReconcileResult> =>
    withTenant(tx, accountId, (t) =>
      reconcile(t, {
        accountId,
        callId,
        provider: cfg.provider,
        model: cfg.model,
        lane: opts.lane,
        reservedCredits,
        usage,
        usageReported,
        windowKey,
        promptVersionId: null,
        ...(opts.meter !== undefined ? { config: opts.meter } : {}),
      }),
    );

  const finishRun = async (
    status: "completed" | "failed",
    reason?: string,
  ): Promise<void> => {
    try {
      await append("run.finished", {
        status,
        ...(reason !== undefined ? { reason } : {}),
        ...(status === "completed" && state.finalText.length > 0
          ? { output: digestOf(state.finalText) }
          : {}),
      });
    } catch {
      // Swallowed by design — see runToolLoop's identical finishRun.
    }
  };

  const engine: Engine = {
    runId,
    tx,
    accountId,
    lane: opts.lane,
    ...(opts.meter !== undefined ? { meter: opts.meter } : {}),
    tools: opts.tools,
    cfg,
    runState,
    append,
    currentSeq,
    settleStep,
    finishRun,
  };

  const stepCallId = `${runId}:${parked.stepId}`;

  try {
    const impl = opts.tools[approvedCall.toolName];
    if (impl === undefined) {
      await engine.append("tool.result", {
        toolCallId,
        ok: false,
        result: digestOf("tool not allowlisted"),
      });
      await engine.append("step.finished", {
        stepId: parked.stepId,
        status: "error",
        errorCode: "tool",
      });
      throw new LoopFailure(
        "tool",
        `approved tool "${approvedCall.toolName}" is no longer registered`,
      );
    }
    // Execute the JUST-APPROVED call directly — no re-propose (already appended pre-park), no
    // re-gate-check (already decided by approveToolCall's run-state CAS).
    await runOneToolCall(
      engine,
      `${stepCallId}:${toolCallId}`,
      toolCallId,
      impl,
      approvedCall,
      parked.stepId,
      state,
    );

    // Continue any remaining calls in the SAME step's batch (propose+gate+execute-or-park again —
    // a step may propose several tools and only one need be gated).
    await runToolCallBatch(
      engine,
      parked.stepId,
      stepCallId,
      parked.calls,
      parked.callIndex + 1,
      state,
    );
    await engine.append("step.finished", {
      stepId: parked.stepId,
      status: "ok",
    });

    const result = await runSteps(
      engine,
      opts,
      sdkTools,
      priceEntry,
      conversion,
      parked.stepsUsed + 1,
      state,
    );
    if (result.status === "completed") {
      // RETENTION (security audit finding 1): a successful terminal resume clears parked_state
      // too — cheap (one best-effort CAS already used for the failure path below) and closes the
      // same liability. A re-park (result.status === "parked") already wrote a fresh row via
      // runToolCallBatch's own `park()` call, so nothing to do here in that case.
      try {
        await runState.finish(runId);
      } catch {
        // Best-effort — the trajectory's run.finished is the authority on the run's outcome.
      }
    }
    return result;
  } catch (err) {
    if (err instanceof LoopParked) {
      return {
        runId,
        status: "parked",
        stepsUsed: state.stepsUsed,
        creditsSpent: state.creditsSpent,
        text: "",
        toolCallId: err.toolCallId,
      };
    }
    const failure =
      err instanceof LoopFailure
        ? err
        : new LoopFailure(
            "provider",
            err instanceof Error ? err.message : String(err),
          );
    await finishRun("failed", failure.code);
    try {
      await runState.finish(runId);
    } catch {
      // Best-effort terminal bookkeeping — the trajectory's run.finished is the authority.
    }
    return {
      runId,
      status: "failed",
      stepsUsed: state.stepsUsed,
      creditsSpent: state.creditsSpent,
      text: "",
      failure: { code: failure.code, message: failure.message },
    };
  }
}
