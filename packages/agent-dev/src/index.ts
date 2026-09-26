// @caisson-sh/agent-dev — the Agentic-Dev EDITION composition (ADR-0065/0066/0067). An edition is
// NOT a new primitive: it composes the shipped base seams DOWN-ONLY (ADR-0003/0022) into one
// adopter-facing surface —
//   • the governed, engine-neutral agent kernel (@caisson-sh/agent-kernel): the agent/skill/rule schema +
//     define*() builders, the reference-integrity validator, the pure lifecycle FSM, governance guards
//     + the unified HookResult, the hooks dispatcher, and the opt-in AUDITED lifecycle (the
//     tamper-evident moat);
//   • the local hybrid memory (@caisson-sh/local-store): vec0 + FTS5 + RRF (RRF_K=60) with the FTS-only
//     offline floor, the pluggable Embedder port, the cloud-egress secret-scrub guard, and the
//     dedup/TTL/GC retention default;
//   • the thin multi-harness emitter (./emitter.ts): one typed schema → `.claude/` + the universal
//     `AGENTS.md` base layer (read natively by Codex, Cursor, Devin, Zed, Gemini CLI, and the Copilot
//     coding agent — ADR-0264, superseding the prior "Codex harness" framing) + per-artifact Cursor,
//     Devin Desktop/legacy Windsurf, GitHub Copilot, and Cline bundles — Claude Code is ONE emit
//     target among several, never the substrate (the ADR-0066 binding contract VERIFY re-asks);
//   • the governed sandboxed tool-exec gate (@caisson-sh/tool-exec, ADR-0178): a default-deny allowlist +
//     Zod-strict argv schemas + execFile arg-arrays (never a shell) — wired as a live gate on the
//     composed edition so an adopter gets the exec seam from this one import home;
//   • the sandboxed, governed agent runner (@caisson-sh/agent-runner, ADR-0186): spawns a headless agent
//     CLI in an isolated worktree behind a from-scratch, scrubbed environment, streaming an auditable
//     run transcript — reachable from this one edition import home; the adopter supplies its own provider
//     credential and endpoint for each run, so the edition never resolves or holds one itself.
// Plus the curated Caisson-native default content and the @caisson-sh/ai-config embedder-lane seam.
// Engine-neutral end to end: no LLM call, no vendor SDK, no harness assumption lives in the kernel.

// ── The composed base surfaces + curated content, re-exported as ONE edition import home ────────────
export * from "@caisson-sh/agent-kernel";
export * from "@caisson-sh/local-store";
// The governed sandboxed tool-exec gate (ADR-0178): a default-deny allowlist + Zod-strict argv schemas
// + execFile arg-arrays (never a shell). Bundled into the edition so an adopter gets the exec gate from
// this one import home — the composition factory wires a live instance below.
export * from "@caisson-sh/tool-exec";

// The sandboxed governed agent-runner primitive (@caisson-sh/agent-runner, ADR-0186) — folded into the
// edition's paid bundle exactly like tool-exec above, but NOT wired to a live instance here: `spawn()`
// takes a per-call provider credential + endpoint (`authKey`/`baseUrl`) that this factory, like the
// ai-config embedder lane below, never resolves or holds (ADR-0066 no-credential/engine-neutral
// floor). The adopter constructs `createAgentRunner({ runsRoot })` themselves and supplies its own
// provider config per run. `ProviderConfig` collides with `@caisson-sh/ai-config`'s type of the same
// name — re-exported under an `AgentRunner`-prefixed alias so both stay reachable from this one home.
export {
  buildEngineEnv,
  createAgentRunner,
  summarize,
  CLAUDE_CLI_PROFILE,
  PASSTHROUGH_KEYS,
  ProviderConfig as AgentRunnerProviderConfig,
  RunMeta,
} from "@caisson-sh/agent-runner";
export type {
  AgentRunner,
  AgentRunnerConfig,
  BuildEngineEnvOptions,
  ProviderConfigInput as AgentRunnerProviderConfigInput,
  RunReport,
  RunStatus,
  RunStatusValue,
  RunSummary,
  SpawnAgentOptions,
  SpawnAgentResult,
  TailResult,
} from "@caisson-sh/agent-runner";

export * from "./emitter.ts";
export * from "./content/index.ts";

// The provider-agnostic embedder LANE seam the edition wires for memory embeddings (base→base; never
// reads a key, no network — the live embed transport stays the one un-exercised path, ADR-0067).
export { parseAiSettings, resolveProvider } from "@caisson-sh/ai-config";
export type { AiSettings, ProviderConfig } from "@caisson-sh/ai-config";

// The kernel compliance substrate the audited lifecycle records into — re-surfaced so the adopter/app
// verifies a governed record from this single edition surface (down-only into @caisson-sh/kernel).
export {
  fetchWithTimeout,
  canonicalize,
  chainEntry,
  anchorChain,
  verifyChain,
  CaissonError,
} from "@caisson-sh/kernel/node";
export type { AuditChainEntry, AuditChainAnchor } from "@caisson-sh/kernel";

// ── The composition factory ────────────────────────────────────────────────────────────────────
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Artifact, AuditLifecycleStore } from "@caisson-sh/agent-kernel";
import {
  AuditedLifecycle,
  validateArtifactSet,
} from "@caisson-sh/agent-kernel";
import { LocalStore, tenantDbPath } from "@caisson-sh/local-store";
import {
  createToolExec,
  type ToolExec,
  type ToolExecConfig,
} from "@caisson-sh/tool-exec";
import { ValidationError } from "@caisson-sh/kernel";
import {
  renderHarnessBundles,
  writeBundle,
  type EmitHookBinding,
  type EmittedBundle,
} from "./emitter.ts";
import { CAISSON_DEFAULT_ARTIFACTS } from "./content/index.ts";

/** Construction options for the composed Agentic-Dev edition. */
export interface AgentDevEditionOptions {
  /** Tamper-evident lifecycle persistence seam (the governed-kernel moat) — the host supplies it. */
  readonly store: AuditLifecycleStore;
  /** Opt into the AUDITED (tamper-evident) lifecycle. `false` (default) ⇒ FSM-validate only. */
  readonly audited?: boolean;
  /** Local hybrid-memory vector width; fixes the `vec0` table at open (ADR-0067). */
  readonly memoryDim: number;
  /**
   * Per-tenant memory isolation (ADR-0073 file-per-tenant floor). The local tier has no RLS, so
   * isolation is PHYSICAL: the edition opens its memory at `tenantDbPath(root, tenantId)` and the
   * resolved path IS the boundary — a cross-tenant read is inexpressible. Resolution is FAIL-CLOSED
   * (a malformed `tenantId` throws before any file opens), so a multi-tenant host cannot silently ship
   * a single shared store. Multi-tenant hosts MUST use this; mutually exclusive with `memoryPath`.
   */
  readonly tenant?: { readonly root: string; readonly tenantId: string };
  /** Explicit memory DB path (single-tenant / tests); omit for an in-memory store. Mutually exclusive with `tenant`. */
  readonly memoryPath?: string;
  /** The authored artifact set the edition governs + emits. Defaults to the curated Caisson set. */
  readonly artifacts?: readonly Artifact[];
  /**
   * Configuration for the bundled sandboxed tool-exec gate (ADR-0178). Omit ⇒ a FAIL-CLOSED
   * default-deny gate (empty allowlist) that refuses every call until the host registers commands.
   */
  readonly toolExec?: ToolExecConfig;
  /** Deterministic clock seam for the audited lifecycle (tests inject a fixed clock). */
  readonly now?: () => string;
}

/** The composed edition: the governed kernel + hybrid memory + a bound multi-harness emitter. */
export interface AgentDevEdition {
  /** The governed, optionally tamper-evident lifecycle engine (@caisson-sh/agent-kernel). */
  readonly lifecycle: AuditedLifecycle;
  /** The local hybrid-memory store (vec0 + FTS5 + RRF; FTS-only offline floor). */
  readonly memory: LocalStore;
  /** The governed sandboxed tool-exec gate (default-deny allowlist; ADR-0178). */
  readonly toolExec: ToolExec;
  /** The reference-consistent artifact set this edition governs + emits. */
  readonly artifacts: readonly Artifact[];
  /**
   * PURE render of the artifact set + hook bindings into the multi-harness bundle. `opts.allowScripts`
   * opts a script-carrying skill's executable content in — but ONLY matters for a caller-supplied
   * artifact override: the curated Caisson default set is trusted and always emits its scripts.
   */
  render(
    hooks?: readonly EmitHookBinding[],
    opts?: { readonly allowScripts?: boolean },
  ): EmittedBundle;
  /**
   * Render + FAIL-CLOSED guarded write of the bundle under `targetRoot`. Returns the paths written
   * AND the bundle's fidelity warnings — the one-call path must surface them (ADR-0264 "warns
   * loudly, never silently degrades"), not leave them stranded on a `render()` the caller skipped.
   * `opts.allowScripts` carries the same trust-tiered meaning as `render`.
   */
  emit(
    targetRoot: string,
    hooks?: readonly EmitHookBinding[],
    opts?: { readonly allowScripts?: boolean },
  ): {
    readonly written: readonly string[];
    readonly warnings: readonly string[];
  };
  /** Release the memory store's DB handle. */
  close(): void;
}

/**
 * Compose the Agentic-Dev edition from the shipped base seams (down-only). Wires:
 *   1. the artifact set through the agent-kernel reference-integrity guard (a ghost cross-ref THROWS
 *      here — never reaches the emitter or the lifecycle);
 *   2. the governed (optionally audited / tamper-evident) lifecycle over a host-supplied store;
 *   3. the local hybrid-memory store (FTS-only offline when no embedder is wired);
 *   4. the bound multi-harness emitter (`render` = pure; `emit` = the fail-closed guarded write);
 *   5. the governed sandboxed tool-exec gate (default-deny allowlist; ADR-0178).
 * Holds NO credential and makes NO network/LLM call — engine-neutral (ADR-0066).
 */
export function createAgentDevEdition(
  options: AgentDevEditionOptions,
): AgentDevEdition {
  // Artifact ORIGIN is a composition-time fact (no schema field on the artifact): the curated Caisson
  // default set is TRUSTED and always emits its scripts; a caller-supplied override is UNTRUSTED and
  // must opt scripts in explicitly (the executable-content trust tier, operator lock 2026-07-17).
  const usesCuratedDefault = options.artifacts === undefined;
  const artifacts = options.artifacts ?? CAISSON_DEFAULT_ARTIFACTS;
  validateArtifactSet(artifacts); // reference integrity over the whole set — throws on a ghost ref

  const lifecycle = new AuditedLifecycle({
    store: options.store,
    audited: options.audited ?? false,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  // Resolve the memory path. A `tenant` opts into the ADR-0073 file-per-tenant isolation floor —
  // `tenantDbPath` throws (fail-closed) on a malformed id BEFORE any file opens, so an unscoped or
  // traversal path can never reach `LocalStore.open`. `tenant` and `memoryPath` are mutually
  // exclusive: allowing both would let a caller believe they are isolated while pointing at a shared
  // file. Neither ⇒ in-memory (tests / ephemeral single-tenant).
  if (options.tenant !== undefined && options.memoryPath !== undefined) {
    throw new ValidationError(
      "agent-dev: `tenant` and `memoryPath` are mutually exclusive",
      {},
    );
  }
  let memoryPath: string | undefined = options.memoryPath;
  if (options.tenant !== undefined) {
    const { root, tenantId } = options.tenant;
    memoryPath = tenantDbPath(root, tenantId); // fail-closed on a bad id, before any open
    mkdirSync(resolve(root), { recursive: true }); // LocalStore.open does not create the parent dir
  }

  const memory = LocalStore.open({
    dim: options.memoryDim,
    ...(memoryPath !== undefined ? { path: memoryPath } : {}),
  });

  // The governed sandboxed tool-exec gate (ADR-0178). No `toolExec` config ⇒ fail-closed default-deny
  // (empty allowlist refuses every call). Construction holds no credential and spawns nothing — the
  // execFile only runs on `toolExec.run(...)`, keeping the edition engine-neutral (ADR-0066).
  const toolExec = createToolExec(options.toolExec ?? { allowlist: [] });

  const render = (
    hooks: readonly EmitHookBinding[] = [],
    opts: { readonly allowScripts?: boolean } = {},
  ): EmittedBundle =>
    renderHarnessBundles({
      artifacts,
      hooks,
      allowScripts: usesCuratedDefault || opts.allowScripts === true,
    });

  return {
    lifecycle,
    memory,
    toolExec,
    artifacts,
    render,
    emit: (targetRoot, hooks = [], opts = {}) => {
      const bundle = render(hooks, opts);
      return {
        written: writeBundle(targetRoot, bundle),
        warnings: bundle.warnings,
      };
    },
    close: () => memory.close(),
  };
}
