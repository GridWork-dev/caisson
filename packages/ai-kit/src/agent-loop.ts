// The bounded tool loop (CAISSON-111 S2, ADR-0360 U-1) — the caller-owned per-step harness the
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
// AR-4). Approval gating (two-phase park/resume) is S3; this slice runs only non-gated tools.
//
// Guard boundary (documented, deliberate): the opening prompt is input-guarded (moderation + PII)
// before any spend, and the final text is output-guarded before it is returned. Intermediate
// tool-conversation traffic is digest-referenced in the trajectory but not re-guarded per step —
// the S3 approval seam is the gate for tool content.
//
// ACCEPTED RESIDUALS (2026-07-17 SHIP audit, recorded): (F3) reserve and settle are separate
// transactions — a settle/refund transaction that itself fails leaves an orphaned hold, classified
// `"settle"` so an out-of-band reconciler (the closing dependency; usage_event idempotency makes
// its retries safe) can sweep it. (F5) the memory TrajectoryStore is tenant-blind — acceptable for
// tests/single-process; the S3 PG store carries tenant RLS. `ToolLoopResult.failure.message` may
// carry raw provider/tool error text — in-process only, never persisted; callers treat as sensitive.
import { createHash, randomUUID } from "node:crypto";
import {
  generateText,
  stepCountIs,
  tool,
  type ModelMessage,
  type ToolSet,
} from "ai";
import type { AiSettings } from "@caisson/ai-config";
import { resolveProvider } from "@caisson/ai-config";
import {
  TRAJECTORY_VERSION,
  type TrajectoryEvent,
  type TrajectoryStore,
} from "@caisson/agent-trajectory";
import {
  BUNDLED_PRICE_BOOK,
  CREDIT_CONVERSION,
  computeCost,
  estimateUsage,
  reconcile,
  reserve,
  resolvePriceEntry,
} from "@caisson/ai-meter";
import type { MeterConfig, ReconcileResult, Usage } from "@caisson/ai-meter";
import { guardInput, guardOutput } from "@caisson/guardrails";
import { withTenant } from "@caisson/tenancy-rls";
import type { Transactor } from "@caisson/tenancy-rls";
import type { z } from "zod";
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
  readonly status: "completed" | "failed";
  readonly stepsUsed: number;
  /** Settled ledger actuals summed across every step (integer credits). */
  readonly creditsSpent: number;
  /** The final model text on completion; "" on failure. */
  readonly text: string;
  readonly failure?: { code: ToolLoopFailureCode; message: string };
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

  // Fail-closed envelope appends: seq is allocated here, sequentially; ANY append failure is a
  // run-stopping `trajectory-append` failure (the ADR-0351 rider-1 inversion).
  let seq = 0;
  const append = async (
    kind: TrajectoryEvent["kind"],
    payload: unknown,
  ): Promise<void> => {
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
  };

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

  // Schema-only SDK tool declarations — the loop, not the SDK, executes (governed interposition).
  const sdkTools: ToolSet = Object.fromEntries(
    Object.entries(opts.tools).map(([name, t]) => [
      name,
      tool({ description: t.description, inputSchema: t.inputSchema }),
    ]),
  );

  const messages: ModelMessage[] = [{ role: "user", content: guardedPrompt }];
  let creditsSpent = 0;
  let stepsUsed = 0;
  let finalText = "";

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
        ...(status === "completed" && finalText.length > 0
          ? { output: digestOf(finalText) }
          : {}),
      });
    } catch {
      // Swallowed by design — see above.
    }
  };

  try {
    await append("run.started", {
      agentId: opts.agentId,
      input: digestOf(guardedPrompt),
    });

    for (let step = 1; step <= opts.maxSteps; step += 1) {
      const stepId = `s${String(step)}`;
      const stepCallId = `${runId}:${stepId}`;
      await append("step.started", { stepId, depth: 0 });
      stepsUsed = step;

      // Caller-side budget gate BEFORE the reservation debits anything: the step's own estimate
      // must fit the remaining budget (stopWhen counts steps, not spend — spike constraint 4).
      const estMessages = messages.map((m) => ({
        role:
          m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: messageText(m),
      }));
      const estUsage = estimateUsage(estMessages, opts.maxOutputTokens);
      const est = computeCost(estUsage, priceEntry, conversion);
      if (creditsSpent + est.credits > opts.creditBudget) {
        await append("step.finished", {
          stepId,
          status: "error",
          errorCode: "budget-exceeded",
        });
        throw new LoopFailure(
          "budget-exceeded",
          `step ${String(step)} estimate (${String(est.credits)} credits) would exceed the remaining budget (${String(opts.creditBudget - creditsSpent)} of ${String(opts.creditBudget)})`,
        );
      }

      // model.call is appended BEFORE the reserve (review BL-01): its payload has no dependency
      // on the reservation, and keeping the reserve→settle window free of REQUIRED appends means
      // an append failure can never orphan a committed debit. (The gateway emits post-reserve for
      // record aesthetics; here money-correctness wins — a 402'd step leaves a model.call record
      // with its step.finished error telling the story.)
      await append("model.call", {
        stepId,
        provider: cfg.provider,
        model: cfg.model,
        prompt: digestOf(messages.map((m) => messageText(m))),
      });

      // Reserve (fail-closed 402): debit-before-spend for the model step.
      let reserved;
      try {
        reserved = await withTenant(tx, accountId, (t) =>
          reserve(t, {
            accountId,
            callId: stepCallId,
            provider: cfg.provider,
            model: cfg.model,
            lane: opts.lane,
            messages: messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: messageText(m),
            })),
            ...(opts.maxOutputTokens !== undefined
              ? { maxOutputTokens: opts.maxOutputTokens }
              : {}),
            ...(opts.meter !== undefined ? { config: opts.meter } : {}),
          }),
        );
      } catch (err) {
        await append("step.finished", {
          stepId,
          status: "error",
          errorCode: "reserve-402",
        });
        throw new LoopFailure(
          "reserve-402",
          err instanceof Error ? err.message : String(err),
        );
      }

      // The provider call — one SDK step exactly (pattern d). Failure refunds the reservation.
      // The output bound is ALWAYS passed and is the SAME number the estimate priced
      // (`estUsage.outputTokens` = caller's maxOutputTokens or the meter default) — an uncapped
      // call would turn creditBudget into a fail-open ceiling (audit F1): the reserve would hold
      // 1024 output tokens while the provider generated the model max, and the shortfall would
      // true up far past the budget.
      let result;
      try {
        const model = await opts.resolveModel(opts.lane, accountId);
        result = await generateText({
          model,
          messages,
          tools: sdkTools,
          stopWhen: stepCountIs(1),
          maxOutputTokens: estUsage.outputTokens,
          ...(opts.abortSignal !== undefined
            ? { abortSignal: opts.abortSignal }
            : {}),
        });
      } catch (err) {
        try {
          await settleStep(
            stepCallId,
            reserved.reservedCredits,
            reserved.windowKey,
            ZERO_USAGE,
            true, // a genuine zero — the call failed, full refund
          );
        } catch (settleErr) {
          // The refund transaction itself failed: the reserve hold is ORPHANED until the
          // out-of-band reconciler sweeps it (audit F3). Classify distinctly so it is
          // discoverable — never mislabeled as a provider failure.
          await append("step.finished", {
            stepId,
            status: "error",
            errorCode: "settle",
          });
          throw new LoopFailure(
            "settle",
            `refund failed after provider error (orphaned reservation ${stepCallId}): ${settleErr instanceof Error ? settleErr.message : String(settleErr)}`,
          );
        }
        await append("step.finished", {
          stepId,
          status: "error",
          errorCode: "provider",
        });
        throw new LoopFailure(
          "provider",
          err instanceof Error ? err.message : String(err),
        );
      }

      // Settle at provider-reported usage, or at the reservation estimate when unreported (the
      // gateway's settle-at-reserved idiom — never true a completed call down to a refund).
      const normalized = normalizeLanguageUsage(result.usage);
      const reported =
        normalized !== null &&
        canPersistUsage(normalized, cfg.provider, cfg.model, opts.meter)
          ? normalized
          : null;
      let reconciled: ReconcileResult;
      try {
        reconciled = await settleStep(
          stepCallId,
          reserved.reservedCredits,
          reserved.windowKey,
          reported ?? estUsage,
          reported !== null,
        );
      } catch (settleErr) {
        // A throwing settle (e.g. a shortfall debit on a short wallet) leaves the estimate
        // charged and NO usage_event row — an orphaned hold for the reconciler (audit F1/F3).
        await append("step.finished", {
          stepId,
          status: "error",
          errorCode: "settle",
        });
        throw new LoopFailure(
          "settle",
          `settle failed (orphaned reservation ${stepCallId}): ${settleErr instanceof Error ? settleErr.message : String(settleErr)}`,
        );
      }
      creditsSpent += reconciled.actualCredits;

      await append("model.usage", {
        stepId,
        provider: cfg.provider,
        model: cfg.model,
        inputTokens: (reported ?? estUsage).inputTokens,
        outputTokens: (reported ?? estUsage).outputTokens,
        cachedInputTokens: (reported ?? estUsage).cachedInputTokens,
        credits: reconciled.actualCredits,
        billingStatus: "metered",
      });

      messages.push(...result.responseMessages);

      if (result.finishReason !== "tool-calls") {
        // Natural stop: output-guard the final text, then complete.
        try {
          await guardOutput(result.text, opts.guard.policy, opts.guard.runtime);
        } catch (err) {
          await append("step.finished", {
            stepId,
            status: "error",
            errorCode: "guard",
          });
          throw new LoopFailure(
            "guard",
            err instanceof Error ? err.message : String(err),
          );
        }
        finalText = result.text;
        await append("step.finished", { stepId, status: "ok" });
        await finishRun("completed");
        return {
          runId,
          status: "completed",
          stepsUsed,
          creditsSpent,
          text: finalText,
        };
      }

      // Tool phase: reserve (zero-credit, breaker-gated) → execute → settle, per proposed call.
      for (const call of result.toolCalls) {
        const toolCallId = call.toolCallId;
        const toolCallKey = `${stepCallId}:${toolCallId}`;
        await append("tool.proposed", {
          stepId,
          toolCallId,
          name: call.toolName,
          args: digestOf(call.input),
        });

        const impl = opts.tools[call.toolName];
        if (impl === undefined) {
          await append("tool.result", {
            toolCallId,
            ok: false,
            result: digestOf("tool not allowlisted"),
          });
          await append("step.finished", {
            stepId,
            status: "error",
            errorCode: "tool",
          });
          throw new LoopFailure(
            "tool",
            `model proposed unknown tool "${call.toolName}"`,
          );
        }

        // The tool step's own reservation: zero credits, but the BREAKER gate still runs (the
        // caps evaluation is a no-op on a zero-spend reserve) — an open breaker 402s HERE,
        // before the tool executes (SPEC §3 item 5).
        let toolReserved;
        try {
          toolReserved = await withTenant(tx, accountId, (t) =>
            reserve(t, {
              accountId,
              callId: toolCallKey,
              provider: cfg.provider,
              model: cfg.model,
              lane: opts.lane,
              messages: [],
              maxOutputTokens: 0,
              ...(opts.meter !== undefined ? { config: opts.meter } : {}),
            }),
          );
        } catch (err) {
          await append("tool.result", {
            toolCallId,
            ok: false,
            result: digestOf("reserve failed"),
          });
          await append("step.finished", {
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
            await settleStep(
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
          await append("tool.result", {
            toolCallId,
            ok: false,
            result: digestOf(err instanceof Error ? err.message : String(err)),
          });
          await append("step.finished", {
            stepId,
            status: "error",
            errorCode: "tool",
          });
          throw new LoopFailure(
            "tool",
            `tool "${call.toolName}" failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        // Settle the zero-credit tool reservation at reserved (usage unreported) — the
        // usage_event row is the tool step's audit trail.
        try {
          await settleStep(
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
        await append("tool.result", {
          toolCallId,
          ok: true,
          result: digestOf(output),
        });

        messages.push({
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

      await append("step.finished", { stepId, status: "ok" });
    }

    // Ceiling reached with the model still asking for tools: bounded means bounded.
    throw new LoopFailure(
      "step-ceiling",
      `run did not complete within maxSteps (${String(opts.maxSteps)})`,
    );
  } catch (err) {
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
      stepsUsed,
      creditsSpent,
      text: "",
      failure: { code: failure.code, message: failure.message },
    };
  }
}
