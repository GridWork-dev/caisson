// @caisson/tool-exec — governed tool-call / sandboxed-exec primitive (ADR-0153). The security
// floor is the whole point: a default-deny allowlist maps a logical command NAME to a real
// executable + a Zod-`.strict()` argument schema; a call is validated against that schema BEFORE
// spawn, and the validated result is used directly as an `execFile` argv array — never a shell
// string, never concatenated. `execSync`/`exec`/`shell: true` are never used anywhere in this file.
import { execFile as execFileCb } from "node:child_process";
import type { ZodType } from "zod";
import { NotFoundError, parseStrict } from "@caisson/kernel";

/** A registered allowlist entry: a logical name, the real executable, and its argv-array schema. */
export interface CommandSpec {
  readonly name: string;
  readonly command: string;
  /** Validates the caller-supplied `args` INTO the exact argv array passed to `execFile`. */
  readonly argsSchema: ZodType<string[]>;
}

/** Structured argument provenance for one governed call. Plain data, not WORM. */
export interface ExecResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly ok: boolean;
  /** Caller-supplied tag (e.g. why this call was made), carried through unmodified. */
  readonly reason?: string;
  readonly at: number;
}

/**
 * The spawn seam: `(command, args, opts) => { stdout, stderr, exitCode }`. Tests inject a double
 * so the suite never spawns a real process; the default drives `node:child_process.execFile` —
 * an argv ARRAY, no shell — with output captured and bounded.
 */
export type ExecFn = (
  command: string,
  args: readonly string[],
  opts: { cwd: string; timeoutMs: number },
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 64 * 1024;
/** Generous vs. `MAX_OUTPUT_BYTES` — Node's own overflow error is avoided; OUR cap truncates below. */
const NODE_MAX_BUFFER = 10 * 1024 * 1024;

function bound(output: string): string {
  return output.length > MAX_OUTPUT_BYTES
    ? output.slice(0, MAX_OUTPUT_BYTES)
    : output;
}

/**
 * Default `ExecFn`. `execFile(command, argsArray, opts)` — never a shell string, `shell` is never
 * set. A non-zero exit resolves (not rejects) with that exit code; a spawn failure (e.g. ENOENT,
 * a non-numeric `error.code`) resolves with `exitCode: -1` — the caller always gets a provenance
 * record, never a thrown Error from the exec leg itself.
 */
const defaultExecFn: ExecFn = (command, args, opts) =>
  new Promise((resolve) => {
    execFileCb(
      command,
      [...args],
      { cwd: opts.cwd, timeout: opts.timeoutMs, maxBuffer: NODE_MAX_BUFFER },
      (error, stdout, stderr) => {
        const out = bound(stdout);
        const err = bound(stderr);
        if (error === null) {
          resolve({ stdout: out, stderr: err, exitCode: 0 });
          return;
        }
        const code = (error as { code?: unknown }).code;
        resolve({
          stdout: out,
          stderr: err,
          exitCode: typeof code === "number" ? code : -1,
        });
      },
    );
  });

export interface ToolExecConfig {
  /** Default-deny registry. Empty/absent refuses every call (fail-closed). */
  readonly allowlist: readonly CommandSpec[];
  readonly cwd?: string;
  readonly timeoutMs?: number;
  /** Injectable spawn seam — tests supply a double so no real process is spawned. */
  readonly execFn?: ExecFn;
  /** Injectable clock — never `Date.now()` inline, so provenance timestamps are testable. */
  readonly now?: () => number;
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

export interface ToolExec {
  run(name: string, args: unknown, reason?: string): Promise<ExecResult>;
  /**
   * Two-phase gate, phase 1: validate `args` against the allowlisted command's schema WITHOUT
   * spawning anything. Same fail-closed lookup/validation as `run` — unregistered `name` throws
   * `NotFoundError`, a bad shape throws `ValidationError` — so a proposal that parks for external
   * approval is already known-safe-to-execute the moment it exists.
   */
  propose(
    name: string,
    args: unknown,
    reason?: string,
  ): Promise<ProposedToolCall>;
  /**
   * Two-phase gate, phase 2: execute a call `propose` already validated (e.g. after an external
   * approval decision). Re-checks the name is STILL allowlisted to the SAME command — defense
   * against the allowlist changing between propose and execute — but never re-validates `args`,
   * which were already validated at propose time.
   */
  execute(proposed: ProposedToolCall): Promise<ExecResult>;
}

/**
 * Build a governed tool-call gate over `config.allowlist`. `run(name, args, reason?)`:
 * 1. Look up `name` in the allowlist — unregistered throws `NotFoundError` (default-deny).
 * 2. Validate `args` against that command's `argsSchema` via `parseStrict` — a bad shape throws
 *    `ValidationError` (from `parseStrict`) BEFORE anything is spawned.
 * 3. Spawn via the injected `ExecFn` (defaults to `execFile`, argv array, no shell) and return the
 *    full provenance record.
 *
 * `propose`/`execute` (ADR-0360 S3) split steps 1-2 from step 3 — additive; `run`'s single-phase
 * path is unchanged for non-gated tools.
 */
export function createToolExec(config: ToolExecConfig): ToolExec {
  const registry = new Map<string, CommandSpec>(
    config.allowlist.map((spec) => [spec.name, spec]),
  );
  const cwd = config.cwd ?? process.cwd();
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const execFn = config.execFn ?? defaultExecFn;
  const now = config.now ?? Date.now;

  const spawn = async (
    command: string,
    args: readonly string[],
    reason: string | undefined,
  ): Promise<ExecResult> => {
    const { stdout, stderr, exitCode } = await execFn(command, args, {
      cwd,
      timeoutMs,
    });
    const result: ExecResult = {
      command,
      args,
      exitCode,
      stdout,
      stderr,
      ok: exitCode === 0,
      at: now(),
    };
    return reason === undefined ? result : { ...result, reason };
  };

  return {
    async run(
      name: string,
      args: unknown,
      reason?: string,
    ): Promise<ExecResult> {
      const spec = registry.get(name);
      if (spec === undefined) {
        throw new NotFoundError(`No command registered for "${name}"`, {
          command: name,
        });
      }
      const validatedArgs = parseStrict(spec.argsSchema, args);
      return spawn(spec.command, validatedArgs, reason);
    },

    async propose(
      name: string,
      args: unknown,
      reason?: string,
    ): Promise<ProposedToolCall> {
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

    async execute(proposed: ProposedToolCall): Promise<ExecResult> {
      const spec = registry.get(proposed.name);
      if (spec === undefined || spec.command !== proposed.command) {
        throw new NotFoundError(
          `No command registered for "${proposed.name}" matching its proposed command (allowlist changed since propose)`,
          { command: proposed.name },
        );
      }
      return spawn(spec.command, proposed.args, proposed.reason);
    },
  };
}
