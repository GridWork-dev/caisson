// @caisson/tool-exec — governed tool-call / sandboxed-exec primitive (ADR-0153). The security
// floor is the whole point: a default-deny allowlist maps a logical command NAME to a real
// executable + a Zod-`.strict()` argument schema; a call is validated against that schema BEFORE
// spawn, and the validated result is used directly as an `execFile` argv array — never a shell
// string, never concatenated. `execSync`/`exec`/`shell: true` are never used anywhere in this file.
// ENV DEFAULT: an allowlist entry's optional `env` is absent by default, so a spawned process
// inherits the parent's full environment (Node's `execFile` default) — unchanged today. Set
// `env` on a `CommandSpec` to narrow a child to exactly the vars it needs (used verbatim, never
// merged with `process.env`). Flipping the default to always-narrow is a separate major bump.
import { execFile as execFileCb } from "node:child_process";
import { NotFoundError, parseStrict, ValidationError } from "@caisson/kernel";
import { createToolProposer } from "./propose.ts";
import type { CommandSpec } from "./propose.ts";
import {
  APPROVAL_TTL_MS,
  approvalDigest,
  commandPolicyFingerprint,
  createMemoryApprovalStore,
  equalApprovalDigest,
  toolApprovalSchema,
  type ToolApproval,
  type ToolApprovalStore,
} from "./approval.ts";

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
  opts: {
    cwd: string;
    timeoutMs: number;
    /** Optional child environment. Absent → inherits the parent's full env (the default). */
    env?: Readonly<Record<string, string>>;
  },
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
    const execOpts =
      opts.env === undefined
        ? { cwd: opts.cwd, timeout: opts.timeoutMs, maxBuffer: NODE_MAX_BUFFER }
        : {
            cwd: opts.cwd,
            timeout: opts.timeoutMs,
            maxBuffer: NODE_MAX_BUFFER,
            env: opts.env,
          };
    execFileCb(command, [...args], execOpts, (error, stdout, stderr) => {
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
    });
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
  /** Private server-side record store; durable adapters must atomically consume records. */
  readonly approvalStore?: ToolApprovalStore;
}

export interface ToolExec {
  run(name: string, args: unknown, reason?: string): Promise<ExecResult>;
  /**
   * Two-phase gate, phase 1: validate `args` against the allowlisted command's schema WITHOUT
   * spawning anything. Same fail-closed lookup/validation as `run` — unregistered `name` throws
   * `NotFoundError`, a bad shape throws `ValidationError` — so a proposal that parks for external
   * approval records exactly what was validated; execution still rechecks current policy.
   */
  propose(name: string, args: unknown, reason?: string): Promise<ToolApproval>;
  /**
   * Two-phase gate, phase 2: execute a call `propose` already validated (e.g. after an external
   * approval decision). Consume the immutable stored record once, verify the canonical digest,
   * revalidate original input under the current schema, and derive environment from current policy.
   */
  execute(proposed: unknown): Promise<ExecResult>;
  /** Caller must authorize rejection; atomically discard a pending ID without spawning. */
  reject(approvalId: string): Promise<boolean>;
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
  // The lookup + validation gate is the pure `./propose.ts` module — one implementation, shared by
  // `run` and `propose` so the single-phase and two-phase paths can never drift apart.
  const gate = createToolProposer(config.allowlist);
  const cwd = config.cwd ?? process.cwd();
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const execFn = config.execFn ?? defaultExecFn;
  const now = config.now ?? Date.now;
  const approvals = config.approvalStore ?? createMemoryApprovalStore(now);

  const spawn = async (
    command: string,
    args: readonly string[],
    reason: string | undefined,
    env: Readonly<Record<string, string>> | undefined,
  ): Promise<ExecResult> => {
    const { stdout, stderr, exitCode } = await execFn(
      command,
      args,
      env === undefined ? { cwd, timeoutMs } : { cwd, timeoutMs, env },
    );
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
      const proposed = gate.propose(name, args, reason);
      return spawn(proposed.command, proposed.args, reason, proposed.env);
    },

    async propose(
      name: string,
      args: unknown,
      reason?: string,
    ): Promise<ToolApproval> {
      const input: unknown = structuredClone(args);
      const validated = gate.propose(name, input, reason);
      const spec = gate.lookup(name)!;
      const unsigned = {
        approvalId: crypto.randomUUID(),
        expiresAt: now() + APPROVAL_TTL_MS,
        name,
        command: validated.command,
        args: [...validated.args],
        policyVersion: spec.policyVersion ?? "1",
        ...(reason === undefined ? {} : { reason }),
      };
      const proposal = parseStrict(toolApprovalSchema, {
        ...unsigned,
        digest: approvalDigest(unsigned),
      });
      await approvals.put({
        proposal,
        input,
        policyFingerprint: commandPolicyFingerprint(spec),
      });
      return structuredClone(proposal);
    },

    async reject(approvalId: string): Promise<boolean> {
      return approvals.reject(
        parseStrict(toolApprovalSchema.shape.approvalId, approvalId),
      );
    },

    async execute(raw: unknown): Promise<ExecResult> {
      const proposed = parseStrict(toolApprovalSchema, raw);
      const stored = await approvals.consume(proposed.approvalId);
      if (!stored)
        throw new NotFoundError("Approval is unknown or already consumed");
      // Recheck after await even if a durable store returns a record just as it expires.
      if (
        !Number.isSafeInteger(stored.proposal.expiresAt) ||
        now() >= stored.proposal.expiresAt
      ) {
        throw new NotFoundError("Approval expired");
      }
      if (
        !equalApprovalDigest(proposed.digest, stored.proposal.digest) ||
        !equalApprovalDigest(approvalDigest(proposed), stored.proposal.digest)
      ) {
        throw new ValidationError(
          "Approval record does not match the approved proposal",
        );
      }
      const spec = gate.lookup(stored.proposal.name);
      if (
        !spec ||
        !equalApprovalDigest(
          commandPolicyFingerprint(spec),
          stored.policyFingerprint,
        )
      ) {
        throw new NotFoundError(
          "Command policy changed since approval was proposed",
        );
      }
      const current = gate.propose(
        stored.proposal.name,
        stored.input,
        stored.proposal.reason,
      );
      const currentDigest = approvalDigest({
        ...stored.proposal,
        command: current.command,
        args: [...current.args],
      });
      if (!equalApprovalDigest(currentDigest, stored.proposal.digest)) {
        throw new ValidationError(
          "Current command validation differs from the approved proposal",
        );
      }
      // No environment is accepted from the public approval envelope or old stored proposal.
      return spawn(
        spec.command,
        current.args,
        current.reason,
        spec.env === undefined ? undefined : { ...spec.env },
      );
    },
  };
}
