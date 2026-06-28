// @caisson/agent-dev — the Agentic-Dev EDITION composition (ADR-0065/0066/0067 · T21). An edition is
// NOT a new primitive: it composes three shipped base seams DOWN-ONLY (ADR-0003/0022) into one
// buyer-facing surface —
//   • the governed, engine-neutral agent kernel (@caisson/agent-kernel): the agent/skill/rule schema +
//     define*() builders, the reference-integrity validator, the pure lifecycle FSM, governance guards
//     + the unified HookResult, the hooks dispatcher, and the opt-in AUDITED lifecycle (the
//     tamper-evident moat);
//   • the local hybrid memory (@caisson/local-store): vec0 + FTS5 + RRF (RRF_K=60) with the FTS-only
//     offline floor, the pluggable Embedder port, the cloud-egress secret-scrub guard, and the
//     dedup/TTL/GC retention default;
//   • the thin multi-harness emitter (./emitter.ts): one typed schema → `.claude/` + Codex `AGENTS.md`
//     + Cursor — Claude Code is ONE emit target among several, never the substrate (the ADR-0066
//     binding contract VERIFY re-asks).
// Plus the curated Caisson-native default content and the @caisson/ai-config embedder-lane seam.
// Engine-neutral end to end: no LLM call, no vendor SDK, no harness assumption lives in the kernel.

// ── The three composed base surfaces + curated content, re-exported as ONE edition import home ──────
export * from "@caisson/agent-kernel";
export * from "@caisson/local-store";
export * from "./emitter.ts";
export * from "./content/index.ts";

// The provider-agnostic embedder LANE seam the edition wires for memory embeddings (base→base; never
// reads a key, no network — the live embed transport stays the one un-exercised path, ADR-0067).
export { parseAiSettings, resolveProvider } from "@caisson/ai-config";
export type { AiSettings, ProviderConfig } from "@caisson/ai-config";

// The kernel compliance substrate the audited lifecycle records into — re-surfaced so the buyer/app
// verifies a governed record from this single edition surface (down-only into @caisson/kernel).
export {
  fetchWithTimeout,
  canonicalize,
  chainEntry,
  anchorChain,
  verifyChain,
  CaissonError,
} from "@caisson/kernel";
export type { AuditChainEntry, AuditChainAnchor } from "@caisson/kernel";

// ── The composition factory ────────────────────────────────────────────────────────────────────
import type { Artifact, AuditLifecycleStore } from "@caisson/agent-kernel";
import { AuditedLifecycle, validateArtifactSet } from "@caisson/agent-kernel";
import { LocalStore } from "@caisson/local-store";
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
  /** Memory DB path; omit for an in-memory store (tests / ephemeral). */
  readonly memoryPath?: string;
  /** The authored artifact set the edition governs + emits. Defaults to the curated Caisson set. */
  readonly artifacts?: readonly Artifact[];
  /** Deterministic clock seam for the audited lifecycle (tests inject a fixed clock). */
  readonly now?: () => string;
}

/** The composed edition: the governed kernel + hybrid memory + a bound multi-harness emitter. */
export interface AgentDevEdition {
  /** The governed, optionally tamper-evident lifecycle engine (@caisson/agent-kernel). */
  readonly lifecycle: AuditedLifecycle;
  /** The local hybrid-memory store (vec0 + FTS5 + RRF; FTS-only offline floor). */
  readonly memory: LocalStore;
  /** The reference-consistent artifact set this edition governs + emits. */
  readonly artifacts: readonly Artifact[];
  /** PURE render of the artifact set + hook bindings into the multi-harness bundle. */
  render(hooks?: readonly EmitHookBinding[]): EmittedBundle;
  /** Render + FAIL-CLOSED guarded write of the bundle under `targetRoot`; returns paths written. */
  emit(
    targetRoot: string,
    hooks?: readonly EmitHookBinding[],
  ): readonly string[];
  /** Release the memory store's DB handle. */
  close(): void;
}

/**
 * Compose the Agentic-Dev edition from the shipped base seams (down-only). Wires:
 *   1. the artifact set through the agent-kernel reference-integrity guard (a ghost cross-ref THROWS
 *      here — never reaches the emitter or the lifecycle);
 *   2. the governed (optionally audited / tamper-evident) lifecycle over a host-supplied store;
 *   3. the local hybrid-memory store (FTS-only offline when no embedder is wired);
 *   4. the bound multi-harness emitter (`render` = pure; `emit` = the fail-closed guarded write).
 * Holds NO credential and makes NO network/LLM call — engine-neutral (ADR-0066).
 */
export function createAgentDevEdition(
  options: AgentDevEditionOptions,
): AgentDevEdition {
  const artifacts = options.artifacts ?? CAISSON_DEFAULT_ARTIFACTS;
  validateArtifactSet(artifacts); // reference integrity over the whole set — throws on a ghost ref

  const lifecycle = new AuditedLifecycle({
    store: options.store,
    audited: options.audited ?? false,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  const memory = LocalStore.open({
    dim: options.memoryDim,
    ...(options.memoryPath !== undefined ? { path: options.memoryPath } : {}),
  });

  const render = (hooks: readonly EmitHookBinding[] = []): EmittedBundle =>
    renderHarnessBundles({ artifacts, hooks });

  return {
    lifecycle,
    memory,
    artifacts,
    render,
    emit: (targetRoot, hooks = []) => writeBundle(targetRoot, render(hooks)),
    close: () => memory.close(),
  };
}
