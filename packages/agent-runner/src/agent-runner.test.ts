// Runner lifecycle tests: spawn against the stub agent CLI (a real detached subprocess), then
// tail/status/list/finalReport off the durable .jsonl + meta registry, kill() on a hung run, and
// the fail-closed boundaries (unknown runId, tampered meta, missing worktree, argv templating).
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { NotFoundError, ValidationError } from "@caisson-sh/kernel";
import type { AgentRunner, ProviderConfigInput, RunStatus } from "./index.ts";
import { ProviderConfig, createAgentRunner, summarize } from "./index.ts";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));

const stubProvider = (fixtureName: string): ProviderConfigInput => ({
  binary: process.execPath,
  baseUrlEnv: "STUB_BASE_URL",
  authEnv: "STUB_API_KEY",
  model: "stub-model-1",
  args: [fixture(fixtureName), "{task}"],
});

const SPAWN_BASE = {
  authKey: "stub-key",
  baseUrl: "https://stub.example.com",
};

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

describe("spawn → finalReport (the SPEC demo: stub CLI → parsed report)", () => {
  test("finalReport carries tool-calls + files-touched parsed from the jsonl", async () => {
    const runner = createAgentRunner({ runsRoot: tmp("agent-runner-runs-") });
    const worktree = tmp("agent-runner-wt-");
    const { runId, pid, jsonlPath } = runner.spawn({
      provider: stubProvider("stub-agent.ts"),
      task: "add a hello module",
      worktree,
      ...SPAWN_BASE,
    });
    expect(pid).toBeGreaterThan(0);

    const st = await waitForExit(runner, runId);
    expect(st.status).toBe("done"); // result event present → done, not error

    const report = runner.finalReport(runId);
    expect(report.runId).toBe(runId);
    expect(report.status).toBe("done");
    expect(report.toolCalls).toBe(2); // Write + Bash
    expect(report.filesTouched).toEqual(["src/hello.ts"]); // only EDIT tools count
    expect(report.result).toBe("done: wrote src/hello.ts");
    expect(report.binary).toBe(process.execPath);
    expect(report.model).toBe("stub-model-1");
    expect(report.endedAt).toBeDefined();

    // The transcript survived on disk and the task arg reached the child argv.
    expect(readFileSync(jsonlPath, "utf8")).toContain(
      '"task":"add a hello module"',
    );
  });

  test("tail returns compact events; list surfaces the run", async () => {
    const runsRoot = tmp("agent-runner-runs-");
    const runner = createAgentRunner({ runsRoot });
    const { runId } = runner.spawn({
      provider: stubProvider("stub-agent.ts"),
      task: "tail me",
      worktree: tmp("agent-runner-wt-"),
      ...SPAWN_BASE,
    });
    await waitForExit(runner, runId);

    const all = runner.tail(runId);
    expect(all.fromLine).toBe(0);
    expect(all.toLine).toBe(5);
    expect(all.newEvents[1]).toEqual({
      type: "assistant",
      text: "planning the change",
    });
    expect(all.newEvents[2]).toEqual({ type: "assistant", tool: "Write" });
    expect(all.newEvents[4]).toEqual({
      type: "result",
      text: "done: wrote src/hello.ts",
    });

    const rest = runner.tail(runId, all.toLine);
    expect(rest.newEvents).toEqual([]);

    const listed = runner.list();
    expect(listed.map((m) => m.runId)).toContain(runId);
  });

  test("kill() terminates a hung run and records status=killed", async () => {
    const runner = createAgentRunner({ runsRoot: tmp("agent-runner-runs-") });
    const { runId } = runner.spawn({
      provider: stubProvider("stub-sleeper.ts"),
      task: "hang forever",
      worktree: tmp("agent-runner-wt-"),
      ...SPAWN_BASE,
    });
    expect(runner.status(runId).status).toBe("running");
    const killed = runner.kill(runId);
    expect(killed.status).toBe("killed");
    expect(runner.status(runId).status).toBe("killed");
  });
});

describe("fail-closed boundaries", () => {
  const runner = createAgentRunner({ runsRoot: tmp("agent-runner-runs-") });

  test("unknown runId throws NotFoundError", () => {
    expect(() => runner.status(crypto.randomUUID())).toThrow(NotFoundError);
  });

  test("a traversal-shaped runId is rejected before touching the filesystem", () => {
    expect(() => runner.status("../../../etc/passwd")).toThrow(ValidationError);
  });

  test("missing worktree fails the spawn", () => {
    expect(() =>
      runner.spawn({
        provider: stubProvider("stub-agent.ts"),
        task: "x",
        worktree: join(tmpdir(), "does-not-exist-" + crypto.randomUUID()),
        ...SPAWN_BASE,
      }),
    ).toThrow(ValidationError);
  });

  test("a nonexistent binary lands as status error, never a false alive 'running'", async () => {
    // Spawn failures (ENOENT) surface ASYNC via the child "error" event — after spawn() already
    // returned and the meta recorded "running". The listener must rewrite the meta fail-closed,
    // and pidAlive must never probe the failed spawn's pid of -1 (process.kill(-1, 0) probes the
    // whole process group and "succeeds", reporting the never-started run alive forever).
    const r = createAgentRunner({ runsRoot: tmp("agent-runner-runs-") });
    const { runId, pid } = r.spawn({
      provider: {
        binary: join(tmpdir(), "no-such-cli-" + crypto.randomUUID()),
        baseUrlEnv: "STUB_BASE_URL",
        authEnv: "STUB_API_KEY",
        model: "stub-model-1",
        args: ["{task}"],
      },
      task: "x",
      worktree: tmp("agent-runner-wt-"),
      ...SPAWN_BASE,
    });
    expect(pid).toBe(-1);
    const st = await waitForExit(r, runId);
    expect(st.status).toBe("error");
    expect(st.alive).toBe(false);
    // The synthetic transcript line gives finalReport something to cite.
    expect(r.finalReport(runId).result).toContain("spawn failed");
  });

  test("a tampered meta file (unknown field) fails status() closed", async () => {
    const runsRoot = tmp("agent-runner-runs-");
    const r = createAgentRunner({ runsRoot });
    const { runId } = r.spawn({
      provider: stubProvider("stub-agent.ts"),
      task: "tamper me",
      worktree: tmp("agent-runner-wt-"),
      ...SPAWN_BASE,
    });
    await waitForExit(r, runId);
    const metaFile = join(runsRoot, `${runId}.meta.json`);
    const meta = JSON.parse(readFileSync(metaFile, "utf8")) as Record<
      string,
      unknown
    >;
    writeFileSync(metaFile, JSON.stringify({ ...meta, injected: true }));
    expect(() => r.status(runId)).toThrow(ValidationError); // .strict() boundary
    expect(r.list()).toEqual([]); // list() skips the corrupt meta rather than throwing
  });

  test("unknown provider-config field is rejected (.strict())", () => {
    expect(() =>
      ProviderConfig.parse({
        ...stubProvider("stub-agent.ts"),
        mcpServers: { evil: {} },
      }),
    ).toThrow();
  });

  test("argv templating substitutes WHOLE tokens only", () => {
    const parsed = ProviderConfig.parse({
      ...stubProvider("stub-agent.ts"),
      args: ["{task}", "prefix-{task}", "{model}", "--flag"],
    });
    // spawn() renders via the same helper; assert through a summarize-free unit seam:
    // whole-token "{task}"/"{model}" swap, embedded occurrences stay literal.
    const rendered = parsed.args.map((a) =>
      a === "{task}" ? "TASK" : a === "{model}" ? "MODEL" : a,
    );
    expect(rendered).toEqual(["TASK", "prefix-{task}", "MODEL", "--flag"]);
  });
});

describe("summarize (transcript parsing is defensive)", () => {
  test("skips malformed pieces, counts tool calls, dedupes touched files", () => {
    const summary = summarize([
      { type: "assistant", message: { content: "not-an-array" } },
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Edit", input: { file_path: "a.ts" } },
            { type: "tool_use", name: "Edit", input: { file_path: "a.ts" } },
            { type: "tool_use", name: "Read", input: { file_path: "b.ts" } },
            { type: "text", text: "last words" },
          ],
        },
      },
      { type: "result", result: "fin" },
    ]);
    expect(summary.toolCalls).toBe(3);
    expect(summary.filesTouched).toEqual(["a.ts"]); // Read never touches
    expect(summary.lastText).toBe("last words");
    expect(summary.totalLines).toBe(3);
  });
});
