// Real-package parity for the tool-exec poke's browser mirror (tool-exec-logic.ts). No
// packages/tool-exec/src/__golden__ fixtures exist (manifest.ts declares `golden: null`), so
// parity is anchored against the real package's own `createToolExec(...).propose()` and the real
// `@caisson/kernel` error classes, imported here by relative path / package import — apps/site
// does not declare `@caisson/tool-exec` as a workspace dependency (see tool-exec-logic.ts's
// header for why it isn't imported into the client bundle). Bun's test runtime is node-like, so
// the real package's `node:child_process` import resolves fine here even though it cannot reach a
// browser bundle. No process is ever spawned — every allowlist entry below is validation-only
// (`propose()`, never `execute()`), exactly like the mirror.
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@caisson/kernel";

import { createToolExec } from "../../../../packages/tool-exec/src/index.ts";

import {
  SAMPLE_ALLOWED,
  SAMPLE_ALLOWLIST,
  SAMPLE_DENIED,
  proposeToolCall,
} from "./tool-exec-logic";
import type { ValidationIssue } from "./tool-exec-logic";

const echoSpec = {
  name: "echo",
  command: "/bin/echo",
  argsSchema: z.array(z.string()),
};

describe("proposeToolCall — default-deny allowlist, real-package parity", () => {
  test("an unregistered command name is denied with the real NotFoundError's shape", async () => {
    const real = createToolExec({ allowlist: [echoSpec] });
    let realErr: unknown;
    try {
      await real.propose(SAMPLE_DENIED.name, ["-rf", "/"]);
    } catch (e) {
      realErr = e;
    }
    expect(realErr).toBeInstanceOf(NotFoundError);
    const err = realErr as NotFoundError;

    const mine = proposeToolCall(
      SAMPLE_ALLOWLIST,
      SAMPLE_DENIED.name,
      SAMPLE_DENIED.argv.split(" "),
    );
    expect(mine.outcome).toBe("denied");
    if (mine.outcome !== "denied") throw new Error("expected denied");
    expect(mine.error).toEqual({
      code: err.code,
      httpStatus: err.httpStatus,
      message: err.message,
      details: err.details as { command: string },
    });
  });

  test("args failing the schema are denied with the real ValidationError's shape", async () => {
    const real = createToolExec({ allowlist: [echoSpec] });
    let realErr: unknown;
    try {
      // Same non-array input the real package's own test suite uses to trip parseStrict.
      await real.propose("echo", { not: "an array" });
    } catch (e) {
      realErr = e;
    }
    expect(realErr).toBeInstanceOf(ValidationError);
    const err = realErr as ValidationError;

    const mine = proposeToolCall(SAMPLE_ALLOWLIST, "echo", { not: "an array" });
    expect(mine.outcome).toBe("denied");
    if (mine.outcome !== "denied") throw new Error("expected denied");
    expect(mine.error).toEqual({
      code: err.code,
      httpStatus: err.httpStatus,
      message: err.message,
      details: err.details as { issues: ValidationIssue[] },
    });
  });

  test("a valid call proposes the exact same ProposedToolCall as the real package", async () => {
    const real = createToolExec({ allowlist: [echoSpec] });
    const realProposed = await real.propose(
      SAMPLE_ALLOWED.name,
      SAMPLE_ALLOWED.argv.split(" "),
      "smoke",
    );

    const mine = proposeToolCall(
      SAMPLE_ALLOWLIST,
      SAMPLE_ALLOWED.name,
      SAMPLE_ALLOWED.argv.split(" "),
      "smoke",
    );
    expect(mine.outcome).toBe("proposed");
    if (mine.outcome !== "proposed") throw new Error("expected proposed");
    expect(mine.proposed).toEqual(realProposed);
  });

  test("reason is omitted from the proposal when not supplied, matching the real package", async () => {
    const real = createToolExec({ allowlist: [echoSpec] });
    const realProposed = await real.propose(
      SAMPLE_ALLOWED.name,
      SAMPLE_ALLOWED.argv.split(" "),
    );
    expect("reason" in realProposed).toBe(false);

    const mine = proposeToolCall(
      SAMPLE_ALLOWLIST,
      SAMPLE_ALLOWED.name,
      SAMPLE_ALLOWED.argv.split(" "),
    );
    if (mine.outcome !== "proposed") throw new Error("expected proposed");
    expect("reason" in mine.proposed).toBe(false);
  });
});

describe("proposeToolCall — the second allowlist entry's stricter schema actually gates", () => {
  test("git-status accepts only the exact argv its schema names", () => {
    const ok = proposeToolCall(SAMPLE_ALLOWLIST, "git-status", [
      "status",
      "--short",
    ]);
    expect(ok.outcome).toBe("proposed");

    const denied = proposeToolCall(SAMPLE_ALLOWLIST, "git-status", [
      "status",
      "--verbose",
    ]);
    expect(denied.outcome).toBe("denied");
    if (denied.outcome !== "denied") throw new Error("expected denied");
    expect(denied.error.code).toBe("validation_error");
  });
});

describe("proposeToolCall — never a shell string", () => {
  test("a proposed call's args is always a string array, never a concatenated command", () => {
    const verdict = proposeToolCall(
      SAMPLE_ALLOWLIST,
      SAMPLE_ALLOWED.name,
      SAMPLE_ALLOWED.argv.split(" "),
    );
    if (verdict.outcome !== "proposed") throw new Error("expected proposed");
    expect(Array.isArray(verdict.proposed.args)).toBe(true);
    expect(verdict.proposed.args.every((a) => typeof a === "string")).toBe(
      true,
    );
  });
});
