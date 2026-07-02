// apps/agent-dev/test/runner-demo.test.ts — the SPEC-agent-runner goal-backward verify demo
// (ADR-0186): a demo spawn against a STUB agent CLI (a tiny bun script fixture, never a live
// model) returns a parsed finalReport with tool-calls + files-touched populated from the jsonl
// transcript. Also re-asserts the leak contract at the composition level: the stub dumps its env,
// and a canary planted in the launcher's process.env must not cross the spawn boundary.
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { runAgentRunnerDemo } from "../src/index.ts";

const fixture = fileURLToPath(
  new URL("./__fixtures__/stub-agent-cli.ts", import.meta.url),
);

afterAll(() => {
  delete process.env["APP_AGENT_DEV_CANARY"];
});

describe("agent-runner demo composition (ADR-0186 task 6)", () => {
  test("a demo spawn against a stub CLI returns a parsed finalReport", async () => {
    process.env["APP_AGENT_DEV_CANARY"] = "app-canary-77";
    const runsRoot = mkdtempSync(join(tmpdir(), "app-agent-dev-runs-"));
    const report = await runAgentRunnerDemo({
      runsRoot,
      worktree: mkdtempSync(join(tmpdir(), "app-agent-dev-wt-")),
      provider: {
        binary: process.execPath,
        baseUrlEnv: "STUB_BASE_URL",
        authEnv: "STUB_API_KEY",
        model: "stub-model-1",
        args: [fixture, "{task}"],
      },
      authKey: "stub-key",
      baseUrl: "https://stub.example.com",
      task: "demo the runner",
    });

    // tool-calls + files-touched populated FROM THE JSONL (the SPEC verify clause).
    expect(report.status).toBe("done");
    expect(report.toolCalls).toBe(1);
    expect(report.filesTouched).toEqual(["demo/output.ts"]);
    expect(report.result).toBe("stub run complete");
    expect(report.model).toBe("stub-model-1");

    // Leak contract holds through the composed demo: the stub dumped its whole env into the
    // transcript — the launcher canary must be absent.
    const jsonl = readdirSync(runsRoot).find((f) => f.endsWith(".jsonl"));
    const transcript = readFileSync(join(runsRoot, jsonl ?? ""), "utf8");
    expect(transcript).not.toContain("APP_AGENT_DEV_CANARY");
    expect(transcript).not.toContain("app-canary-77");
    expect(transcript).toContain('"STUB_API_KEY":"stub-key"');
  });
});
