// The tool-exec poke's checkable claims, now that it drives the REAL package through its browser
// entry (ADR-0396) and the hand-ported mirror (tool-exec-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build. A
//      bundler does not fail on `node:child_process`, it substitutes a polyfill and exits 0.
//   2. The poke's gate IS the package's gate: `createToolProposer` (browser entry) and
//      `createToolExec(...).propose()` (node entry) agree on every verdict, because they are the
//      same module — pinned here so a future re-fork of the two paths fails loudly.
//   3. The sample allowlist is genuinely gating (default-deny + the stricter schema), and a
//      proposal's args are always an argv array, never a concatenated shell string.
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { NotFoundError, ValidationError } from "@caisson-sh/kernel";
import { createToolExec } from "@caisson-sh/tool-exec";

import {
  SAMPLE_ALLOWED,
  SAMPLE_ALLOWLIST,
  SAMPLE_DENIED,
  proposeSample,
} from "./tool-exec-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "tool-exec-poke.tsx");

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package's browser entry, never the spawn half", () => {
    expect(walk.files).toContain("packages/tool-exec/src/browser.ts");
    expect(walk.files).toContain("packages/tool-exec/src/propose.ts");
    expect(walk.files).not.toContain("packages/tool-exec/src/tool-exec.ts");
  });

  test("positive control: the package's `.` barrel DOES taint, so the walker is not blind", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/tool-exec/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.some((o) => o.spec === "node:child_process")).toBe(
      true,
    );
  });
});

describe("the poke's gate IS the package's gate", () => {
  // The node-entry gate, built over the SAME sample allowlist. Bun's runtime is node-like, so
  // node:child_process resolves fine here even though it can never reach a browser bundle. No
  // process is ever spawned: propose() is phase 1, and execute() is never called.
  const real = createToolExec({ allowlist: SAMPLE_ALLOWLIST });

  test("a valid browser proposal matches validated fields but cannot mint approval authority", async () => {
    const args = SAMPLE_ALLOWED.argv.split(" ");
    const verdict = proposeSample(SAMPLE_ALLOWED.name, args);
    if (verdict.outcome !== "proposed") throw new Error("expected proposed");
    const approved = await real.propose(SAMPLE_ALLOWED.name, args);
    expect(approved).toMatchObject(verdict.proposed);
    expect("approvalId" in verdict.proposed).toBe(false);
    await expect(real.execute(verdict.proposed)).rejects.toThrow(
      ValidationError,
    );
  });

  test("reason is omitted when not supplied, matching the package", async () => {
    const proposed = await real.propose(SAMPLE_ALLOWED.name, ["hi"]);
    expect("reason" in proposed).toBe(false);
    const verdict = proposeSample(SAMPLE_ALLOWED.name, ["hi"]);
    if (verdict.outcome !== "proposed") throw new Error("expected proposed");
    expect("reason" in verdict.proposed).toBe(false);
  });

  test("an unregistered name is denied with the package's own NotFoundError instance", async () => {
    const args = SAMPLE_DENIED.argv.split(" ");
    const verdict = proposeSample(SAMPLE_DENIED.name, args);
    if (verdict.outcome !== "denied") throw new Error("expected denied");
    expect(verdict.error).toBeInstanceOf(NotFoundError);
    expect(verdict.error.code).toBe("not_found");
    expect(verdict.error.httpStatus).toBe(404);
    expect(verdict.error.details).toEqual({ command: SAMPLE_DENIED.name });
    await expect(real.propose(SAMPLE_DENIED.name, args)).rejects.toThrow(
      verdict.error.message,
    );
  });
});

describe("the sample allowlist actually gates", () => {
  test("git-status accepts only the exact argv its schema names", () => {
    expect(proposeSample("git-status", ["status", "--short"]).outcome).toBe(
      "proposed",
    );
    const denied = proposeSample("git-status", ["status", "--verbose"]);
    if (denied.outcome !== "denied") throw new Error("expected denied");
    expect(denied.error).toBeInstanceOf(ValidationError);
    expect(denied.error.code).toBe("validation_error");
  });

  test("a proposed call's args is always a string array, never a concatenated command", () => {
    const verdict = proposeSample(SAMPLE_ALLOWED.name, [
      "hello",
      "world; rm -rf /",
    ]);
    if (verdict.outcome !== "proposed") throw new Error("expected proposed");
    expect(Array.isArray(verdict.proposed.args)).toBe(true);
    expect(verdict.proposed.args).toEqual(["hello", "world; rm -rf /"]);
  });
});
