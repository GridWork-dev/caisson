// The validation gate — the pure half of @caisson/tool-exec (ADR-0153, ADR-0360 S3 phase 1),
// carved out of tool-exec.ts so it can be imported without dragging `node:child_process` behind
// it. Nothing here reaches a node builtin: it is a Map lookup, a Zod parse, and plain data.
// `@caisson/tool-exec/browser` is exactly this module (ADR-0396); the `.` barrel re-exports it.
//
// This is the ONLY implementation of the gate — `createToolExec`'s `run` and `propose` both call
// `propose()` below, so default-deny and schema-validation can never diverge between the
// single-phase and two-phase paths.
import type { ZodType } from "zod";
import { NotFoundError, parseStrict } from "@caisson/kernel";

/** A registered allowlist entry: a logical name, the real executable, and its argv-array schema. */
export interface CommandSpec {
  readonly name: string;
  readonly command: string;
  /** Validates the caller-supplied `args` INTO the exact argv array passed to `execFile`. */
  readonly argsSchema: ZodType<string[]>;
}

/**
 * A validated, not-yet-executed call (ADR-0360 S3 two-phase gate): the allowlist lookup + Zod
 * validation have already run, so `execute` never re-validates `args` — the recorded `args` here
 * ARE the exact argv `execute` will spawn. Serializable (plain data) so a caller can park it in an
 * external approval store between `propose` and `execute` without re-deriving anything.
 */
export interface ProposedToolCall {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly reason?: string;
}

/** The gate itself, with no spawn seam attached — safe to run anywhere, including a browser. */
export interface ToolProposer {
  /** The allowlist lookup, default-deny: an unregistered name resolves to `undefined`. */
  lookup(name: string): CommandSpec | undefined;
  /**
   * Validate `args` against the allowlisted command's schema WITHOUT spawning anything.
   * Unregistered `name` throws `NotFoundError`; a bad shape throws `ValidationError` (from
   * `parseStrict`) — so a proposal that parks for external approval is already known-safe-to-
   * execute the moment it exists.
   */
  propose(name: string, args: unknown, reason?: string): ProposedToolCall;
}

/**
 * Build the phase-1 gate over an allowlist. Default-deny by construction: the registry holds
 * exactly the entries handed in, and an empty/absent allowlist refuses every call.
 */
export function createToolProposer(
  allowlist: readonly CommandSpec[],
): ToolProposer {
  const registry = new Map<string, CommandSpec>(
    allowlist.map((spec) => [spec.name, spec]),
  );
  return {
    lookup(name: string): CommandSpec | undefined {
      return registry.get(name);
    },
    propose(name: string, args: unknown, reason?: string): ProposedToolCall {
      const spec = registry.get(name);
      if (spec === undefined) {
        throw new NotFoundError(`No command registered for "${name}"`, {
          command: name,
        });
      }
      const validatedArgs = parseStrict(spec.argsSchema, args);
      const proposed: ProposedToolCall = {
        name,
        command: spec.command,
        args: validatedArgs,
      };
      return reason === undefined ? proposed : { ...proposed, reason };
    },
  };
}
