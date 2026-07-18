// Agent-runtime MCP tools (ADR-0360 S5 exposure/publish, ADR-0361/0362), registered through the
// SAME ADR-0216 `registerTool` seam `coach.ts`/`manifest-tools.ts` use. Two tools:
//   - `run_start` — open a governed run through the buyer's own `@caisson/ai-kit` tool loop.
//   - `run_status` — read a run's state + trajectory projection (never the encrypted `parked_state`
//     column — the injected `runStatus` callback never selects it either, ADR-0361).
// Both gate on the module's OWN dedicated entitlement (ADR-0362: the `@caisson/agent-trajectory`
// slug already in the registry ledger) — NEVER the Agentic-Dev bundle's fold slug, so reselling the
// runtime in a future bundle is pure composition with no tool-seam change.
//
// INJECTED, LIKE `onGenerate` (open↔commercial boundary): `@caisson/mcp-server` is Apache-2.0/oss
// and can never import `@caisson/ai-kit`/`@caisson/agent-trajectory` (both commercial) at runtime.
// The actual loop/store wiring lives in `@caisson/ai-kit`'s `mcp-run-tools.ts` (`buildRunTools`),
// duck-typed against `RunToolsOptions` below — no reverse workspace dependency needed either
// direction. This module owns ONLY the entitlement gate + arg validation; the result payload is
// whatever the host callback returns (`unknown` — a deliberately opaque passthrough, exactly like
// `check_usage`'s findings array is opaque to the SEAM even though `manifest-tools.ts` itself knows
// the concrete shape there).
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson/kernel";

/** The dedicated agent-runtime entitlement slug (ADR-0362) — the ledgered `@caisson/agent-trajectory`
 *  module id, mirroring `manifest-tools.ts`'s `DEFAULT_DOCTOR_ENTITLEMENT` pattern (a real module/
 *  doctor slug, never the enclosing bundle's fold slug). Overridable via options for a deployment
 *  that maps entitlements differently. */
export const DEFAULT_RUN_ENTITLEMENT = "@caisson/agent-trajectory";

/** The minimal slice of the ADR-0216 server seam these tools drive — just tool registration, the
 *  session narrowed to `accountId` (the only field a run-tool handler needs). `McpServer` (from
 *  `server.ts`) is structurally assignable to this, so this module never imports the server (no
 *  dependency cycle) — mirrors `manifest-tools.ts`'s `ManifestToolRegistrar`. */
export interface RunToolRegistrar {
  registerTool(registration: {
    name: string;
    requiredEntitlement: string | null;
    description: string;
    version: string;
    audit: { logArgs: boolean };
    handler: (ctx: {
      session: { accountId: string };
      args: unknown;
    }) => Promise<unknown>;
  }): void;
}

export interface RunToolsOptions {
  /** Start a governed run for `accountId` from the validated `{ prompt }` args. Returns whatever
   *  shape the host's tool-loop result carries (opaque to this seam). */
  readonly runStart: (ctx: {
    accountId: string;
    args: unknown;
  }) => Promise<unknown>;
  /** Read a run's state + trajectory projection for `accountId` from the validated `{ runId }`
   *  args. Opaque to this seam for the same reason as `runStart`. */
  readonly runStatus: (ctx: {
    accountId: string;
    args: unknown;
  }) => Promise<unknown>;
  /** Slug gating both tools. Default `"@caisson/agent-trajectory"` (ADR-0362 — a dedicated module
   *  slug, never a bundle fold slug). */
  readonly requiredEntitlement?: string;
}

const runStartArgs = strictObject({ prompt: z.string().min(1).max(4000) });
const runStatusArgs = strictObject({ runId: z.string().min(1).max(128) });

/**
 * Register `run_start`/`run_status` on `server` through the ADR-0216 seam. Both are invisible
 * (404) to a caller lacking `requiredEntitlement` — the seam's constant-time gate, unchanged by
 * this module. Args are validated HERE (strict, bounded) before the host callback ever runs, so a
 * malformed request never reaches the governed loop.
 */
export function registerRunTools(
  server: RunToolRegistrar,
  options: RunToolsOptions,
): void {
  const requiredEntitlement =
    options.requiredEntitlement ?? DEFAULT_RUN_ENTITLEMENT;

  server.registerTool({
    name: "run_start",
    requiredEntitlement,
    description:
      "Start a governed agent-runtime run: a bounded, metered tool loop through the buyer's own gateway (reserve/settle every step, approval-gated tools park for review).",
    version: "1.0.0",
    // The prompt may carry buyer-sensitive content — never logged verbatim (mirrors check_usage's
    // audit posture for buyer source).
    audit: { logArgs: false },
    handler: async ({ session, args }) => {
      const input = parseStrict(runStartArgs, args);
      return options.runStart({ accountId: session.accountId, args: input });
    },
  });

  server.registerTool({
    name: "run_status",
    requiredEntitlement,
    description:
      "Read a governed agent-runtime run's state (running/parked/finished) and trajectory projection. Never exposes the encrypted parked-tool-call snapshot.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async ({ session, args }) => {
      const input = parseStrict(runStatusArgs, args);
      return options.runStatus({ accountId: session.accountId, args: input });
    },
  });
}
