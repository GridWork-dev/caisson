// Round-3 remediation (ADR-0178): the Agentic-Dev edition BUNDLES @caisson-sh/tool-exec, so the governed
// sandboxed exec gate must be reachable from the ONE edition import home AND wired as a live gate on
// the composed edition. This proves the WIRE — tool-exec's own allowlist/spawn behavior is covered in
// packages/tool-exec: `createToolExec` re-exports from the edition, and `createAgentDevEdition(...)`
// exposes a FAIL-CLOSED default-deny `toolExec` gate when no allowlist is supplied.
import { describe, expect, test } from "bun:test";
import { InMemoryAuditLifecycleStore } from "@caisson-sh/agent-kernel";
import { NotFoundError } from "@caisson-sh/kernel";
import { createAgentDevEdition, createToolExec } from "./index.ts";

describe("agent-dev edition — bundled tool-exec gate (ADR-0178)", () => {
  test("the tool-exec surface is re-exported from the one edition import home", () => {
    expect(typeof createToolExec).toBe("function");
  });

  test("the composed edition exposes a fail-closed default-deny tool-exec gate", async () => {
    const edition = createAgentDevEdition({
      store: new InMemoryAuditLifecycleStore(),
      memoryDim: 8,
    });
    try {
      expect(edition.toolExec).toBeDefined();
      // No allowlist ⇒ every call is refused (default-deny) before anything is spawned.
      await expect(edition.toolExec.run("rm", ["-rf", "/"])).rejects.toThrow(
        NotFoundError,
      );
    } finally {
      edition.close();
    }
  });
});
