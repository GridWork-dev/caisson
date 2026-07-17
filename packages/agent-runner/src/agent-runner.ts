// @caisson/agent-runner — sandboxed governed agent runner (ADR-0186). Spawns a HEADLESS agent CLI
// as a detached subprocess in an isolated worktree, streams its stream-json transcript to a durable
// `.jsonl`, and parses that transcript into a structured, auditable run report.
//
// SECURITY CRUX — buildEngineEnv():
//   The subprocess EGRESSES to the configured provider endpoint (it sends the worktree code to an
//   external model). It must therefore NEVER inherit a caller secret. buildEngineEnv() starts from
//   a fixed non-secret passthrough allowlist and adds ONLY the target provider's routing vars +
//   key — it never spreads `process.env`. Combined with an isolated HOME/config dir, no credential
//   beyond the one provider key can reach a process that talks to the provider. The leak guard is
//   asserted in `leak-guard.test.ts` (ship-blocking, ADR-0186 §4).
//
// Trust boundary: the child produces a diff in its worktree + a transcript; the CALLER owns every
// git/PR/deploy side-effect. Provider-agnostic (ADR-0186 F2): the CLI, its base-URL/auth env var
// NAMES, and the model are all config — nothing here is bound to one vendor.
import { spawn as spawnChild } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  NotFoundError,
  ValidationError,
  parseStrict,
  strictObject,
} from "@caisson/kernel";
import type { TrajectoryStore } from "@caisson/agent-trajectory";
import { buildTrajectoryEvents } from "./trajectory.ts";

// ---------------------------------------------------------------------------
// Provider config (ADR-0186 F2) — provider-agnostic { binary, baseUrlEnv, authEnv, model }.
// ---------------------------------------------------------------------------

/** Env-var NAME shape — `baseUrlEnv`/`authEnv` name variables, they never carry values. */
const envVarName = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, "must be an ENV_VAR-style name");

/**
 * A headless agent-CLI provider profile. `baseUrlEnv`/`authEnv` are the env-var NAMES the CLI
 * reads its endpoint + key from; the VALUES are supplied per spawn (the credential stays an
 * injected seam — this package never reads a dotenv/keychain itself). `args` is the argv template;
 * the literal tokens `{task}` and `{model}` are substituted WHOLE-TOKEN only, so a hostile task
 * string can never add, split, or merge argv entries (and there is no shell anywhere).
 */
export const ProviderConfig = strictObject({
  binary: z.string().trim().min(1).max(1024),
  baseUrlEnv: envVarName,
  authEnv: envVarName,
  model: z.string().trim().min(1).max(128),
  /** Env-var NAME for the CLI's isolated config dir (e.g. CLAUDE_CONFIG_DIR); omit if none. */
  configDirEnv: envVarName.optional(),
  /** Env-var NAME the CLI reads the model from; omit when the model travels via `args`. */
  modelEnv: envVarName.optional(),
  args: z.array(z.string().max(100_000)).max(64).default([]),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;
export type ProviderConfigInput = z.input<typeof ProviderConfig>;

/**
 * One worked provider profile (SPEC task 4): the Claude Code CLI in headless stream-json mode.
 * `--strict-mcp-config` with no `--mcp-config` means NO MCP servers — no credentialed side-effect
 * tool can be smuggled in via an operator-level config file (the isolated config dir closes the
 * user-level path too).
 */
export const CLAUDE_CLI_PROFILE: ProviderConfig = ProviderConfig.parse({
  binary: "claude",
  baseUrlEnv: "ANTHROPIC_BASE_URL",
  authEnv: "ANTHROPIC_AUTH_TOKEN",
  model: "sonnet",
  configDirEnv: "CLAUDE_CONFIG_DIR",
  modelEnv: "ANTHROPIC_MODEL",
  args: [
    "-p",
    "{task}",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    "{model}",
    "--permission-mode",
    "acceptEdits",
    "--strict-mcp-config",
  ],
});

// ---------------------------------------------------------------------------
// Env scrub — the security core (ADR-0186 §4). Build the child env FROM SCRATCH.
// ---------------------------------------------------------------------------

/** The ONLY parent-env keys forwarded to the child. Deliberately excludes HOME, USER, and every
 *  credential — secrets are kept out of a process that egresses to a model provider. */
export const PASSTHROUGH_KEYS = [
  "PATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TZ",
  "TMPDIR",
] as const;

export interface BuildEngineEnvOptions {
  provider: ProviderConfig;
  /** The ONE provider key placed into the child env (at `provider.authEnv`). Injected by the
   *  caller — this package never resolves credentials from disk or `process.env` itself. */
  authKey: string;
  /** Value for `provider.baseUrlEnv` — the provider's API endpoint. */
  baseUrl: string;
  /** Isolated HOME for the subprocess (no operator dotfile/keychain leakage). */
  home: string;
  /** Isolated CLI config dir (no operator-level MCP/tool credentials). */
  configDir: string;
}

/**
 * Build the SCRUBBED env for the agent subprocess. NEVER spreads `parentEnv`. Returns a fresh
 * object containing only the non-secret passthrough allowlist plus the provider routing vars.
 * This is the single place a secret could leak to the provider — the leak-guard test exercises it
 * with a polluted parentEnv AND end-to-end through a real spawn.
 */
export function buildEngineEnv(
  parentEnv: NodeJS.ProcessEnv,
  opts: BuildEngineEnvOptions,
): Record<string, string> {
  if (opts.authKey.trim().length === 0) {
    throw new ValidationError("buildEngineEnv: empty authKey");
  }
  let protocol: string;
  try {
    protocol = new URL(opts.baseUrl).protocol;
  } catch {
    throw new ValidationError("buildEngineEnv: baseUrl is not a URL");
  }
  // http is admitted for local-first providers (e.g. a loopback Ollama); everything else is https.
  if (protocol !== "https:" && protocol !== "http:") {
    throw new ValidationError("buildEngineEnv: baseUrl must be http(s)", {
      protocol,
    });
  }
  const env: Record<string, string> = {};
  for (const key of PASSTHROUGH_KEYS) {
    const value = parentEnv[key];
    if (typeof value === "string" && value.length > 0) env[key] = value;
  }
  // Isolation + provider routing only — no secret beyond the one provider key.
  env["HOME"] = opts.home;
  env[opts.provider.baseUrlEnv] = opts.baseUrl;
  env[opts.provider.authEnv] = opts.authKey;
  if (opts.provider.configDirEnv !== undefined) {
    env[opts.provider.configDirEnv] = opts.configDir;
  }
  if (opts.provider.modelEnv !== undefined) {
    env[opts.provider.modelEnv] = opts.provider.model;
  }
  // Hygiene for CLIs that honor these conventions: no self-update, no telemetry from the sandbox.
  env["DISABLE_AUTOUPDATER"] = "1";
  env["DISABLE_TELEMETRY"] = "1";
  env["DISABLE_ERROR_REPORTING"] = "1";
  return env;
}

// ---------------------------------------------------------------------------
// Run registry — one dir of <runId>.jsonl (transcript) + <runId>.meta.json.
// ---------------------------------------------------------------------------

const RUN_STATUSES = ["running", "done", "killed", "error"] as const;

/** Persisted run metadata. Disk is a trust boundary: every read is `.strict()`-validated. */
export const RunMeta = strictObject({
  runId: z.string().uuid(),
  pid: z.number().int(),
  jsonlPath: z.string().min(1),
  worktree: z.string().min(1),
  task: z.string().min(1),
  binary: z.string().min(1),
  model: z.string().min(1),
  startedAt: z.string().min(1),
  status: z.enum(RUN_STATUSES),
  endedAt: z.string().min(1).optional(),
});
export type RunMeta = z.infer<typeof RunMeta>;
export type RunStatusValue = RunMeta["status"];

function metaPath(dir: string, runId: string): string {
  return join(dir, `${runId}.meta.json`);
}

function readMeta(dir: string, runId: string): RunMeta {
  // Reject a traversal-shaped runId BEFORE it becomes a path segment (defense in depth; real
  // runIds are UUIDs this registry minted).
  if (!/^[0-9a-f-]{36}$/i.test(runId)) {
    throw new ValidationError("runId is not a UUID");
  }
  const p = metaPath(dir, runId);
  if (!existsSync(p)) {
    throw new NotFoundError(`unknown runId: ${runId}`, { runId });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    throw new ValidationError("run meta unreadable", { runId });
  }
  return parseStrict(RunMeta, parsed);
}

function writeMeta(dir: string, meta: RunMeta): void {
  writeFileSync(
    metaPath(dir, meta.runId),
    `${JSON.stringify(meta, null, 2)}\n`,
  );
}

function pidAlive(pid: number): boolean {
  // A sentinel/invalid pid is never alive. Without this, a failed spawn's pid of -1 would reach
  // process.kill(-1, 0) — which on POSIX probes the caller's ENTIRE process group and "succeeds",
  // so a run that never started would report alive forever.
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no such process (dead); EPERM = alive but not ours (treat as alive).
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

// ---------------------------------------------------------------------------
// Transcript parsing — stream-json, defensive (one JSON object per line).
// ---------------------------------------------------------------------------

interface StreamEvent {
  type?: string;
  subtype?: string;
  message?: { content?: unknown };
  result?: string;
  [k: string]: unknown;
}

function parseJsonl(jsonlPath: string): StreamEvent[] {
  if (!existsSync(jsonlPath)) return [];
  const out: StreamEvent[] = [];
  for (const line of readFileSync(jsonlPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as StreamEvent);
    } catch {
      // partial/non-json line (e.g. a still-being-written final line) — skip.
    }
  }
  return out;
}

/** Tool names that mutate files — used to extract the touched-file set. */
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

interface AssistantPiece {
  type?: string;
  text?: string;
  name?: string;
  input?: { file_path?: unknown };
}

function assistantContent(ev: StreamEvent): AssistantPiece[] {
  const content = ev.message?.content;
  return Array.isArray(content) ? (content as AssistantPiece[]) : [];
}

export interface RunSummary {
  totalLines: number;
  toolCalls: number;
  filesTouched: string[];
  lastText: string;
}

/** Cheap rolling summary of the transcript so far (used by `tail`/`status`/`finalReport`). */
export function summarize(events: readonly StreamEvent[]): RunSummary {
  let toolCalls = 0;
  let lastText = "";
  const files = new Set<string>();
  for (const ev of events) {
    if (ev.type !== "assistant") continue;
    for (const piece of assistantContent(ev)) {
      if (piece.type === "text" && typeof piece.text === "string") {
        lastText = piece.text;
      }
      if (piece.type === "tool_use" && typeof piece.name === "string") {
        toolCalls += 1;
        if (
          EDIT_TOOLS.has(piece.name) &&
          typeof piece.input?.file_path === "string"
        ) {
          files.add(piece.input.file_path);
        }
      }
    }
  }
  return {
    totalLines: events.length,
    toolCalls,
    filesTouched: [...files],
    lastText,
  };
}

// ---------------------------------------------------------------------------
// The runner — spawn / tail / status / kill / list / finalReport over one runsRoot.
// ---------------------------------------------------------------------------

const SpawnAgentOptionsSchema = strictObject({
  provider: ProviderConfig,
  task: z.string().trim().min(1).max(200_000),
  worktree: z.string().min(1).max(4096),
  authKey: z.string().min(1).max(8192),
  baseUrl: z.string().min(1).max(2048),
});
export type SpawnAgentOptions = z.input<typeof SpawnAgentOptionsSchema>;

export interface SpawnAgentResult {
  runId: string;
  pid: number;
  jsonlPath: string;
}

export interface TailResult {
  fromLine: number;
  toLine: number;
  newEvents: { type: string; text?: string; tool?: string }[];
}

export interface RunStatus {
  status: RunStatusValue;
  alive: boolean;
  summary: RunSummary;
  meta: RunMeta;
}

export interface RunReport {
  runId: string;
  status: RunStatusValue;
  result: string;
  filesTouched: string[];
  toolCalls: number;
  binary: string;
  model: string;
  startedAt: string;
  endedAt?: string;
}

export interface AgentRunnerConfig {
  /** Caller-supplied run-registry root (ADR-0186 decoupling seam — no home-dir default). */
  readonly runsRoot: string;
  /**
   * OPTIONAL trajectory recorder (the `@caisson/agent-trajectory` store port). When present,
   * `record(runId)` emits an append-only trajectory for the run; when absent the runner behaves
   * byte-identically to today (observation is strictly opt-in and off the hot path).
   */
  readonly recorder?: TrajectoryStore;
}

export interface AgentRunner {
  spawn(opts: SpawnAgentOptions): SpawnAgentResult;
  tail(runId: string, fromLine?: number): TailResult;
  status(runId: string): RunStatus;
  kill(runId: string): { runId: string; status: RunStatusValue };
  list(): RunMeta[];
  finalReport(runId: string): RunReport;
  /**
   * Emit the run's trajectory into the configured recorder (PLAN T3). No-op when no recorder is
   * configured. Intended to run once after the run has finished — the transcript is the source of
   * truth, so replaying it is deterministic. Append-only: re-recording a run whose events already
   * landed rejects at the store (fresh event ids ⇒ a rewrite conflict, not a silent overwrite).
   */
  record(runId: string): Promise<void>;
}

/** Whole-token argv-template substitution — `{task}`/`{model}` must be the ENTIRE array element. */
function renderArgs(
  args: readonly string[],
  task: string,
  model: string,
): string[] {
  return args.map((a) => (a === "{task}" ? task : a === "{model}" ? model : a));
}

/** Build a sandboxed agent runner over `config.runsRoot`. */
export function createAgentRunner(config: AgentRunnerConfig): AgentRunner {
  const dir = resolve(config.runsRoot);

  const status = (runId: string): RunStatus => {
    let meta = readMeta(dir, runId);
    const events = parseJsonl(meta.jsonlPath);
    const alive = meta.status === "running" ? pidAlive(meta.pid) : false;
    if (meta.status === "running" && !alive) {
      const hasResult = events.some((e) => e.type === "result");
      meta = {
        ...meta,
        status: hasResult ? "done" : "error",
        endedAt: new Date().toISOString(),
      };
      writeMeta(dir, meta);
    }
    return { status: meta.status, alive, summary: summarize(events), meta };
  };

  return {
    spawn(rawOpts: SpawnAgentOptions): SpawnAgentResult {
      const opts = parseStrict(SpawnAgentOptionsSchema, rawOpts);
      const worktree = resolve(opts.worktree);
      if (!existsSync(worktree)) {
        throw new ValidationError("worktree does not exist", { worktree });
      }
      mkdirSync(dir, { recursive: true });
      const runId = crypto.randomUUID();
      const jsonlPath = join(dir, `${runId}.jsonl`);
      const home = join(dir, runId, "home");
      const configDir = join(home, "config");
      mkdirSync(configDir, { recursive: true });

      const env = buildEngineEnv(process.env, {
        provider: opts.provider,
        authKey: opts.authKey,
        baseUrl: opts.baseUrl,
        home,
        configDir,
      });
      const argv = renderArgs(
        opts.provider.args,
        opts.task,
        opts.provider.model,
      );

      // stdout+stderr → the transcript fd directly, so the transcript survives launcher exit
      // (no babysitter process pumping pipes). The child is detached + unref'd.
      const outFd = openSync(jsonlPath, "a");
      let pid: number;
      let child: ReturnType<typeof spawnChild>;
      try {
        child = spawnChild(opts.provider.binary, argv, {
          cwd: worktree,
          detached: true,
          stdio: ["ignore", outFd, outFd],
          env,
        });
        child.unref();
        pid = child.pid ?? -1;
      } finally {
        closeSync(outFd); // the child holds its own duplicate of the fd
      }

      const meta: RunMeta = {
        runId,
        pid,
        jsonlPath,
        worktree,
        task: opts.task,
        binary: opts.provider.binary,
        model: opts.provider.model,
        startedAt: new Date().toISOString(),
        status: "running",
      };
      writeMeta(dir, meta);
      // A spawn failure (ENOENT binary, EACCES) surfaces ASYNC via the "error" event — after the
      // sync block above already recorded "running". Without this listener the event would also
      // crash the launcher (unhandled "error" on an EventEmitter). Rewrite the meta fail-closed so
      // status()/list() report the run as errored, never as a false "running" they can't kill.
      // Attached in the same tick as spawn, so it always beats the event; the transcript gets one
      // synthetic line so finalReport has something to cite.
      // ponytail: structural cast — bun-types' node:child_process shim omits the EventEmitter
      // surface ChildProcess has at runtime (same Bun-type gap as ai-kit's `preconnect` casts).
      (
        child as unknown as {
          on(event: "error", listener: (err: Error) => void): void;
        }
      ).on("error", (err) => {
        writeMeta(dir, { ...meta, status: "error" });
        try {
          appendFileSync(
            jsonlPath,
            `${JSON.stringify({ type: "result", result: `spawn failed: ${err.message}` })}\n`,
          );
        } catch {
          // transcript dir gone (run already cleaned up) — the meta rewrite above is the record
        }
      });
      return { runId, pid, jsonlPath };
    },

    tail(runId: string, fromLine = 0): TailResult {
      const meta = readMeta(dir, runId);
      const events = parseJsonl(meta.jsonlPath);
      const slice = events.slice(fromLine);
      const newEvents = slice.map((ev) => {
        const type = typeof ev.type === "string" ? ev.type : "unknown";
        if (type === "assistant") {
          const pieces = assistantContent(ev);
          const textPiece = pieces.find((p) => p.type === "text" && p.text);
          const toolPiece = pieces.find((p) => p.type === "tool_use" && p.name);
          return {
            type,
            ...(textPiece?.text !== undefined ? { text: textPiece.text } : {}),
            ...(toolPiece?.name !== undefined ? { tool: toolPiece.name } : {}),
          };
        }
        if (type === "result" && typeof ev.result === "string") {
          return { type, text: ev.result };
        }
        return { type };
      });
      return { fromLine, toLine: events.length, newEvents };
    },

    status,

    kill(runId: string): { runId: string; status: RunStatusValue } {
      const meta = readMeta(dir, runId);
      if (meta.status === "running" && pidAlive(meta.pid)) {
        try {
          process.kill(meta.pid, "SIGTERM");
        } catch {
          // already gone
        }
      }
      const updated: RunMeta = {
        ...meta,
        status: "killed",
        endedAt: new Date().toISOString(),
      };
      writeMeta(dir, updated);
      return { runId, status: updated.status };
    },

    list(): RunMeta[] {
      if (!existsSync(dir)) return [];
      const metas: RunMeta[] = [];
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".meta.json")) continue;
        try {
          metas.push(
            parseStrict(
              RunMeta,
              JSON.parse(readFileSync(join(dir, f), "utf8")),
            ),
          );
        } catch {
          // skip a corrupt/foreign meta — list() surveys, status() fails closed.
        }
      }
      return metas.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },

    finalReport(runId: string): RunReport {
      const st = status(runId);
      const events = parseJsonl(st.meta.jsonlPath);
      const resultEvent = [...events]
        .reverse()
        .find((e) => e.type === "result");
      const result =
        (typeof resultEvent?.result === "string" && resultEvent.result) ||
        st.summary.lastText ||
        "";
      return {
        runId,
        status: st.meta.status,
        result,
        filesTouched: st.summary.filesTouched,
        toolCalls: st.summary.toolCalls,
        binary: st.meta.binary,
        model: st.meta.model,
        startedAt: st.meta.startedAt,
        ...(st.meta.endedAt !== undefined ? { endedAt: st.meta.endedAt } : {}),
      };
    },

    async record(runId: string): Promise<void> {
      const recorder = config.recorder;
      if (recorder === undefined) return; // uninstrumented — no trajectory to emit
      const meta = readMeta(dir, runId);
      const events = parseJsonl(meta.jsonlPath);
      for (const event of buildTrajectoryEvents(meta, events)) {
        await recorder.append(event);
      }
    },
  };
}
