// D6 remediation (ADR-0186): the Agentic-Dev edition BUNDLES @caisson-sh/agent-runner in its manifest
// dependencies/members pin, so the sandboxed governed runner must be reachable from the ONE edition
// import home. Unlike tool-exec (ADR-0178), the runner is NOT wired to a live instance on the
// composed edition — `spawn()` needs a per-call provider credential + endpoint the edition never
// resolves or holds (ADR-0066 no-credential floor); a buyer constructs `createAgentRunner({ runsRoot })`
// themselves. This proves the re-export surface is complete and functions as the real agent-runner,
// and that the `ProviderConfig` collision with `@caisson-sh/ai-config` is resolved by an alias.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AgentRunnerProviderConfig,
  CLAUDE_CLI_PROFILE,
  createAgentRunner,
} from "./index.ts";

describe("agent-dev edition — bundled agent-runner surface (ADR-0186)", () => {
  test("the agent-runner factory + provider config are re-exported from the one edition import home", () => {
    expect(typeof createAgentRunner).toBe("function");
    expect(typeof AgentRunnerProviderConfig.parse).toBe("function");
    expect(CLAUDE_CLI_PROFILE.binary).toBe("claude");
  });

  test("the re-exported factory constructs a real runner over a caller-supplied runsRoot", () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "agentdev-runner-"));
    try {
      const runner = createAgentRunner({ runsRoot });
      // No runs spawned yet — proves this is the real agent-runner object, not a stub.
      expect(runner.list()).toEqual([]);
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });
});
