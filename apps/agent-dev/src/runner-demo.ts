// apps/agent-dev/src/runner-demo.ts — registers @caisson/agent-runner in the edition reference
// composition (ADR-0186 / SPEC-agent-runner task 6). One headless function that drives ONE
// sandboxed governed agent run end-to-end: spawn a headless agent CLI (a stub in the exit test —
// never a live model call in CI) in an isolated worktree with a from-scratch scrubbed env, wait
// for exit, and return the structured finalReport parsed from the durable .jsonl transcript.
// Credentials are INJECTED by the caller — this demo, like the runner, never reads a dotenv.
import type { ProviderConfigInput, RunReport } from "@caisson/agent-runner";
import { createAgentRunner } from "@caisson/agent-runner";

/** Options for {@link runAgentRunnerDemo}. All seams injectable so the exit test stays hermetic. */
export interface AgentRunnerDemoOptions {
  /** Run-registry root (transcripts + meta) — caller-supplied, no home-dir default. */
  readonly runsRoot: string;
  /** The sandbox worktree the agent runs in (its diff lands here; caller owns git side-effects). */
  readonly worktree: string;
  /** Provider profile { binary, baseUrlEnv, authEnv, model, args } — a stub CLI in tests. */
  readonly provider: ProviderConfigInput;
  /** The one provider credential placed into the scrubbed child env. */
  readonly authKey: string;
  /** The provider endpoint (value for the profile's `baseUrlEnv`). */
  readonly baseUrl: string;
  readonly task?: string;
  /** Bound on the wait for the run to finish (the demo run is short-lived by construction). */
  readonly timeoutMs?: number;
}

const DEFAULT_TASK = "agent-runner reference run";
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Drive one sandboxed governed agent run end-to-end and return its structured report — the
 * Agentic-Dev "run agents safely" pillar alongside the governed-lifecycle demo in `demo.ts`.
 */
export async function runAgentRunnerDemo(
  options: AgentRunnerDemoOptions,
): Promise<RunReport> {
  const runner = createAgentRunner({ runsRoot: options.runsRoot });
  const { runId } = runner.spawn({
    provider: options.provider,
    task: options.task ?? DEFAULT_TASK,
    worktree: options.worktree,
    authKey: options.authKey,
    baseUrl: options.baseUrl,
  });
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  while (runner.status(runId).status === "running") {
    if (Date.now() > deadline) {
      runner.kill(runId);
      break;
    }
    await Bun.sleep(25);
  }
  return runner.finalReport(runId);
}
