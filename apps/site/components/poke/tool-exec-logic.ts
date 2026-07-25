// Deterministic client-side mirror of @caisson/tool-exec (ADR-0153) for the "tool-exec" poke
// (ADR-0378 lock 2, kimi CANDIDATES §B build baseline). Every export below is a faithful port of
// the package's `propose()` validation gate — nothing here fetches, persists, measures, or uses
// Date.now / Math.random in a rendered-output path, and nothing here ever spawns a process.
//
// Why mirrored instead of imported: packages/tool-exec/src/tool-exec.ts imports
// `node:child_process` (`execFile`) at module scope, so its single export map entry (`.` ->
// `src/index.ts`) never resolves in a browser bundle. Its own errors are thrown from
// `@caisson/kernel` (`NotFoundError`, and `ValidationError` via `parseStrict`); kernel's barrel
// `index.ts` re-exports node:crypto- and node:fs/dns-backed modules alongside `errors.ts` /
// `schema.ts`, and kernel has no subpath export isolating just those two files (see its
// package.json `exports` map) — so the error/validation shapes are ported here too, not imported.
// Parity is pinned in `tool-exec-logic.test.ts` against the real package (imported by relative
// path — apps/site does not declare `@caisson/tool-exec` as a dependency) and the real
// `@caisson/kernel` error classes, using the SAME injected-args pattern the package's own test
// suite uses (no real process is ever spawned, in the mirror or in the parity test).
import { z } from "zod";
import type { ZodType } from "zod";

// ---- The allowlist gate (packages/tool-exec/src/tool-exec.ts) ----------------------------------

/** Verbatim shape: tool-exec.ts `CommandSpec`. */
export interface CommandSpec {
  readonly name: string;
  readonly command: string;
  /** Validates the caller-supplied `args` INTO the exact argv array `execFile` would receive. */
  readonly argsSchema: ZodType<string[]>;
}

/** Verbatim shape: tool-exec.ts `ProposedToolCall` (the ADR-0360 S3 two-phase gate's phase-1 output). */
export interface ProposedToolCall {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly reason?: string;
}

/** Mirrors kernel `errors.ts` `NotFoundError` — the shape `propose()` throws on an unregistered name. */
export interface NotFoundErrorLike {
  readonly code: "not_found";
  readonly httpStatus: 404;
  readonly message: string;
  readonly details: { readonly command: string };
}

/** Mirrors one `schema.ts` `parseStrict` validation issue (from a zod `SafeParseError`). */
export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

/** Mirrors kernel `errors.ts` `ValidationError` — the shape `parseStrict` throws on a bad argv shape. */
export interface ValidationErrorLike {
  readonly code: "validation_error";
  readonly httpStatus: 400;
  readonly message: string;
  readonly details: { readonly issues: readonly ValidationIssue[] };
}

export type ProposeVerdict =
  | { readonly outcome: "proposed"; readonly proposed: ProposedToolCall }
  | {
      readonly outcome: "denied";
      readonly error: NotFoundErrorLike | ValidationErrorLike;
    };

/**
 * Mirrors tool-exec.ts `createToolExec(...).propose(name, args, reason?)` exactly: look the name up
 * in the allowlist (default-deny — an unregistered name is refused before any schema runs), then
 * validate `args` against that command's `argsSchema` (mirrors `parseStrict`). No `execute` leg
 * exists here — a browser cannot spawn a process, and this poke stops at the validation gate, the
 * same phase-1 boundary `propose()` itself stops at.
 */
export function proposeToolCall(
  allowlist: readonly CommandSpec[],
  name: string,
  args: unknown,
  reason?: string,
): ProposeVerdict {
  const spec = allowlist.find((s) => s.name === name);
  if (spec === undefined) {
    return {
      outcome: "denied",
      error: {
        code: "not_found",
        httpStatus: 404,
        message: `No command registered for "${name}"`,
        details: { command: name },
      },
    };
  }
  const result = spec.argsSchema.safeParse(args);
  if (!result.success) {
    return {
      outcome: "denied",
      error: {
        code: "validation_error",
        httpStatus: 400,
        message: "Validation failed",
        details: {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
            message: issue.message,
          })),
        },
      },
    };
  }
  const proposed: ProposedToolCall = {
    name,
    command: spec.command,
    args: result.data,
  };
  return {
    outcome: "proposed",
    proposed: reason === undefined ? proposed : { ...proposed, reason },
  };
}

// ---- Sample allowlist (illustrative only — the package itself ships none; an empty/absent -----
// allowlist refuses every call, fail-closed, per tool-exec.ts `ToolExecConfig.allowlist`) ---------

/** Loose schema — any argv of strings passes, same pattern as the package's own `echoSpec` test fixture. */
const ECHO_ARGS: ZodType<string[]> = z.array(z.string());

/** Strict schema — exactly `["status", "--short"]`, nothing else, demonstrating the schema actually gating. */
const GIT_STATUS_ARGS: ZodType<string[]> = z
  .array(z.string())
  .length(2)
  .refine((a) => a[0] === "status" && a[1] === "--short", {
    message: 'must be exactly ["status", "--short"]',
  });

export const SAMPLE_ALLOWLIST: readonly CommandSpec[] = [
  { name: "echo", command: "/bin/echo", argsSchema: ECHO_ARGS },
  { name: "git-status", command: "/usr/bin/git", argsSchema: GIT_STATUS_ARGS },
];

/** The allowed sample: a registered command with argv its schema accepts. */
export const SAMPLE_ALLOWED = { name: "echo", argv: "hello world" } as const;

/**
 * The denied sample: verbatim from the package's own test suite (tool-exec.test.ts, "an
 * unregistered command name is refused") — `toolExec.run("rm", ["-rf", "/"])` throws `NotFoundError`.
 */
export const SAMPLE_DENIED = { name: "rm", argv: "-rf /" } as const;
