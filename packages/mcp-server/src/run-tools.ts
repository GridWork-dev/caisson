// Agent-runtime MCP tools (ADR-0360 S5 exposure/publish, ADR-0361/0362), registered through the
// SAME ADR-0216 `registerTool` seam `coach.ts`/`manifest-tools.ts` use. Two tools:
//   - `run_start` — open a governed run through the host's own `@caisson/ai-kit` tool loop.
//   - `run_status` — read a run's state + trajectory projection (never the encrypted `parked_state`
//     column — the injected `runStatus` callback never selects it either, ADR-0361).
//
// INJECTED, LIKE `onGenerate`: `@caisson/mcp-server` never imports `@caisson/ai-kit`/
// `@caisson/agent-trajectory` at runtime. The actual loop/store wiring lives in `@caisson/ai-kit`'s
// `mcp-run-tools.ts` (`buildRunTools`), duck-typed against `RunToolsOptions` below — no reverse
// workspace dependency needed either direction. This module owns ONLY arg validation; the result
// payload is whatever the host callback returns (`unknown` — a deliberately opaque passthrough,
// exactly like `check_usage`'s findings array is opaque to the SEAM even though `manifest-tools.ts`
// itself knows the concrete shape there).
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson/kernel";

/** The minimal slice of the ADR-0216 server seam these tools drive — just tool registration, the
 *  session narrowed to `accountId` (the only field a run-tool handler needs). `McpServer` (from
 *  `server.ts`) is structurally assignable to this, so this module never imports the server (no
 *  dependency cycle) — mirrors `manifest-tools.ts`'s `ManifestToolRegistrar`. */
export interface RunToolRegistrar {
  registerTool(registration: {
    name: string;
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
}

const runStartArgs = strictObject({ prompt: z.string().min(1).max(4000) });
const runStatusArgs = strictObject({ runId: z.string().min(1).max(128) });

/**
 * Register `run_start`/`run_status` on `server` through the ADR-0216 seam. Args are validated HERE
 * (strict, bounded) before the host callback ever runs, so a malformed request never reaches the
 * governed loop.
 */
export function registerRunTools(
  server: RunToolRegistrar,
  options: RunToolsOptions,
): void {
  server.registerTool({
    name: "run_start",
    description:
      "Start a governed agent-runtime run: a bounded, metered tool loop through the host's own gateway (reserve/settle every step, approval-gated tools park for review).",
    version: "1.0.0",
    // The prompt may carry sensitive content — never logged verbatim (mirrors check_usage's audit
    // posture for caller source).
    audit: { logArgs: false },
    handler: async ({ session, args }) => {
      const input = parseStrict(runStartArgs, args);
      return options.runStart({ accountId: session.accountId, args: input });
    },
  });

  server.registerTool({
    name: "run_status",
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
