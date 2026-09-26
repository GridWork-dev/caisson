// Trajectory observation tests (PLAN T3): a recorded run replays to a deterministic projection with
// honest `unsupported` usage; an absent recorder is byte-identical (no-op); the mapping is a pure
// deterministic function of the transcript (order-independent projection).
import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  createMemoryTrajectoryStore,
  project,
} from "@caisson-sh/agent-trajectory";
import type { AgentRunner, RunStatus } from "./index.ts";
import { buildTrajectoryEvents, createAgentRunner } from "./index.ts";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));

const toolingProvider = () => ({
  binary: process.execPath,
  baseUrlEnv: "STUB_BASE_URL",
  authEnv: "STUB_API_KEY",
  model: "stub-model-1",
  args: [fixture("stub-agent-tooling.ts"), "{task}"],
});

const SPAWN_BASE = { authKey: "stub-key", baseUrl: "https://stub.example.com" };

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

async function waitForExit(
  runner: AgentRunner,
  runId: string,
  timeoutMs = 10_000,
): Promise<RunStatus> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const st = runner.status(runId);
    if (st.status !== "running") return st;
    if (Date.now() > deadline) throw new Error(`run ${runId} timed out`);
    await Bun.sleep(25);
  }
}

describe("record() → deterministic trajectory projection", () => {
  test("a recorded run replays to steps + honest unsupported usage", async () => {
    const store = createMemoryTrajectoryStore();
    const runner = createAgentRunner({
      runsRoot: tmp("agent-runner-traj-"),
      recorder: store,
    });
    const { runId } = runner.spawn({
      provider: toolingProvider(),
      task: "add a hello module",
      worktree: tmp("agent-runner-wt-"),
      ...SPAWN_BASE,
    });
    expect((await waitForExit(runner, runId)).status).toBe("done");

    await runner.record(runId);
    const events = await store.read(runId);

    // Envelope discipline: monotonic gapless seq, contract version 1, run-scoped.
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
    expect(events.every((e) => e.version === 1 && e.runId === runId)).toBe(
      true,
    );
    expect(events[0]?.kind).toBe("run.started");
    expect(events.at(-2)?.kind).toBe("run.finished");

    // No raw bodies: the opening input is a digest ref, never the task text.
    const started = events[0];
    if (started?.kind !== "run.started")
      throw new Error("expected run.started");
    expect(started.payload.input?.digest).toMatch(/^[0-9a-f]{64}$/);

    // Tool calls paired proposed→result by tool_use_id.
    const proposed = events.filter((e) => e.kind === "tool.proposed");
    const results = events.filter((e) => e.kind === "tool.result");
    expect(
      proposed.map((e) => e.kind === "tool.proposed" && e.payload.name),
    ).toEqual(["Write", "Bash"]);
    expect(results).toHaveLength(2);

    // Final usage makes NO token claims (billingStatus unsupported, zero credits).
    const usage = events.at(-1);
    if (usage?.kind !== "model.usage")
      throw new Error("expected model.usage last");
    expect(usage.payload.billingStatus).toBe("unsupported");
    expect(usage.payload.credits).toBe(0);
    expect(usage.payload.inputTokens).toBe(0);

    const projection = project(events);
    expect(projection.status).toBe("completed");
    expect(projection.steps).toHaveLength(3); // text-only, Write, Bash
    expect(projection.steps.every((s) => s.status === "ok")).toBe(true);
    expect(projection.usageTotals.unsupported.credits).toBe(0);
    expect(projection.usageTotals.metered.inputTokens).toBe(0);
  });

  test("absent recorder ⇒ record() is a no-op and the run report is unchanged", async () => {
    const runner = createAgentRunner({ runsRoot: tmp("agent-runner-traj-") });
    const { runId } = runner.spawn({
      provider: toolingProvider(),
      task: "no recorder",
      worktree: tmp("agent-runner-wt-"),
      ...SPAWN_BASE,
    });
    await waitForExit(runner, runId);

    await expect(runner.record(runId)).resolves.toBeUndefined();
    const report = runner.finalReport(runId);
    expect(report.status).toBe("done");
    expect(report.result).toBe("done: wrote src/hello.ts");
  });
});

describe("buildTrajectoryEvents is a pure, deterministic projection", () => {
  const meta = {
    runId: "11111111-1111-4111-8111-111111111111",
    task: "t",
    binary: "claude",
    model: "sonnet",
    startedAt: "2026-07-16T00:00:00.000Z",
    endedAt: "2026-07-16T00:00:01.000Z",
    status: "done" as const,
  };
  const transcript = [
    { type: "assistant", message: { content: [{ type: "text", text: "hi" }] } },
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "Read",
            input: { file_path: "a" },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: "t1", content: "x" }],
      },
    },
    { type: "result", result: "fin" },
  ];

  test("same transcript ⇒ byte-identical projection regardless of arrival order", () => {
    let n = 0;
    const eventId = () =>
      `00000000-0000-4000-8000-${String(n++).padStart(12, "0")}`;
    const a = buildTrajectoryEvents(meta, transcript, { eventId });
    n = 0;
    const b = buildTrajectoryEvents(meta, transcript, { eventId });
    expect(a).toEqual(b);

    const shuffled = [...a].reverse();
    expect(JSON.stringify(project(shuffled))).toBe(JSON.stringify(project(a)));
  });

  test("killed run projects as cancelled", () => {
    const evs = buildTrajectoryEvents(
      { ...meta, status: "killed" },
      transcript,
    );
    expect(project(evs).status).toBe("cancelled");
  });
});
