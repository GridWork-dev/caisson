// The MCP `run_start`/`run_status` host callbacks (ADR-0360, S5 exposure/publish, ADR-0361/0362).
// `@caisson/mcp-server` is the OPEN Base package that owns the `registerTool` seam
// (`run-tools.ts` there) but can never import this commercial edition at runtime (the
// open↔commercial boundary, `checkOpenCommercialBoundary`) — so, exactly like the buyer-facing
// `generate` tool's `onGenerate` host hook, the ACTUAL loop/store wiring lives HERE and is injected
// into the server as a plain callback pair at construction time. This mirrors the seam's existing
// shape, not a new one.
//
// `buildRunTools` assembles a `{runStart, runStatus}` pair structurally compatible with
// `@caisson/mcp-server`'s `RunToolsOptions` port (duck-typed — no reverse dependency on mcp-server
// needed; every field mcp-server reads is a plain function this module already exports the exact
// shape of).
//
// `run_start` opens a governed run through the SAME `runToolLoop` seam `caisson run start` and the
// CLI's future callers would drive — one prompt in, one bounded run out (parked/completed/failed).
// `run_status` reads the run-state snapshot (never `parked_state` — `RunStateStore.read()` never
// selects that column at all, encrypted or not) PLUS the full trajectory `project()` fold — the rich
// view only a commercial-tier caller can build (agent-trajectory's `project()` is unavailable to the
// open CLI, see `packages/cli/src/run.ts`'s hand-rolled summary for that constrained lane).
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson/kernel";
import type { AiSettings } from "@caisson/ai-config";
import type { Transactor } from "@caisson/tenancy-rls";
import {
  createPgRunStateStore,
  createPgTrajectoryStore,
  project,
  type RunProjection,
  type RunStateSnapshot,
} from "@caisson/agent-trajectory";
import {
  derivedContext,
  type SyncFieldKeyProvider,
} from "@caisson/field-crypto";
import type { MeterConfig } from "@caisson/ai-meter";
import {
  runToolLoop,
  type LoopTool,
  type ToolLoopResult,
} from "./agent-loop.ts";
import type { GuardConfig, ModelResolver } from "./gateway.ts";

/** Fixed, server-side configuration for every `run_start` call — never per-request (the caller's
 *  ONLY request-shaped input is the prompt; everything else is the deployment's own governance
 *  policy, identical to how every other metered surface in this package is configured once). */
export interface RunToolsDeps {
  readonly tx: Transactor;
  readonly settings: AiSettings;
  readonly resolveModel: ModelResolver;
  readonly guard: GuardConfig;
  readonly meter?: MeterConfig;
  readonly lane: string;
  readonly agentId: string;
  readonly tools: Readonly<Record<string, LoopTool>>;
  readonly maxSteps: number;
  readonly creditBudget: number;
  readonly maxOutputTokens?: number;
  /** Builds the per-account `FieldCryptoContext` sealing `parked_state` (ADR-0361) — the SAME
   *  provider a deployment already wires for BYOK (`byok-store.ts`) or any other field-crypto
   *  column; no new key-material shape. */
  readonly keyProvider: SyncFieldKeyProvider;
}

const runStartArgs = strictObject({ prompt: z.string().min(1).max(4000) });
const runStatusArgs = strictObject({ runId: z.string().min(1).max(128) });

export interface RunStatusResult {
  readonly runState: RunStateSnapshot | undefined;
  readonly projection: RunProjection;
}

/** The minimal ctx shape both tool callbacks need — a duck-typed match of `@caisson/mcp-server`'s
 *  `RunToolsOptions.runStart`/`runStatus` ctx, so this module needs no import from that package. */
interface RunToolCtx {
  readonly accountId: string;
  readonly args: unknown;
}

function storesFor(
  deps: RunToolsDeps,
  accountId: string,
): {
  store: ReturnType<typeof createPgTrajectoryStore>;
  runState: ReturnType<typeof createPgRunStateStore>;
} {
  const cryptoCtx = derivedContext(deps.keyProvider, accountId);
  return {
    store: createPgTrajectoryStore(deps.tx, accountId),
    runState: createPgRunStateStore(deps.tx, accountId, cryptoCtx),
  };
}

/**
 * Build the `{runStart, runStatus}` callback pair `@caisson/mcp-server`'s `run-tools.ts` seam
 * invokes per call, one governed `RunToolsDeps` configuration per deployment.
 */
export function buildRunTools(deps: RunToolsDeps): {
  readonly runStart: (ctx: RunToolCtx) => Promise<ToolLoopResult>;
  readonly runStatus: (ctx: RunToolCtx) => Promise<RunStatusResult>;
} {
  return {
    async runStart({ accountId, args }): Promise<ToolLoopResult> {
      const input = parseStrict(runStartArgs, args);
      const { store, runState } = storesFor(deps, accountId);
      return runToolLoop({
        tx: deps.tx,
        accountId,
        settings: deps.settings,
        resolveModel: deps.resolveModel,
        guard: deps.guard,
        ...(deps.meter !== undefined ? { meter: deps.meter } : {}),
        lane: deps.lane,
        agentId: deps.agentId,
        prompt: input.prompt,
        tools: deps.tools,
        maxSteps: deps.maxSteps,
        creditBudget: deps.creditBudget,
        store,
        runState,
        ...(deps.maxOutputTokens !== undefined
          ? { maxOutputTokens: deps.maxOutputTokens }
          : {}),
      });
    },

    async runStatus({ accountId, args }): Promise<RunStatusResult> {
      const input = parseStrict(runStatusArgs, args);
      const { store, runState } = storesFor(deps, accountId);
      const [snapshot, events] = await Promise.all([
        runState.read(input.runId),
        store.read(input.runId),
      ]);
      return { runState: snapshot, projection: project(events) };
    },
  };
}
