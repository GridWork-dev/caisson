// apps/agent-dev/src/demo.ts — the agent-dev edition CLI reference run (P4b · T22). One headless
// function that drives ONE governed lifecycle end-to-end against the composed edition surface
// (`@caisson/agent-dev`), DOWN-ONLY, proving the three SPEC pillars in a single offline pass:
//
//   1. a governed, tamper-EVIDENT lifecycle — the canonical act FSM is advanced act-by-act through a
//      policy guard; with the audited mode ON every admitted transition is recorded into the kernel
//      audit-chain + append-only versioning, and the run's record verifies against a WORM anchor
//      (ADR-0065/0066);
//   2. OFFLINE hybrid memory — each governed artifact is indexed into the local store; with NO
//      embedder wired retrieval runs on the FTS5 floor alone (the CLI default), and fuses by RRF when
//      an embedder seam IS wired (ADR-0067) — no live cloud/model call;
//   3. a multi-harness EMIT — one typed schema renders to `.claude/` + Codex `AGENTS.md` + Cursor
//      under the fail-closed path-safe + no-secret guard; Claude Code is one target, never the
//      substrate (ADR-0066).
//
// Engine-neutral end to end: holds no credential, opens no socket, runs no LLM. The embedder is an
// injected SEAM — the live embed transport stays the one un-exercised path (test-doubled in CI).
import type {
  Act,
  Artifact,
  AuditChainAnchor,
  AuditChainEntry,
  AuditLifecycleStore,
  Embedder,
  EmitHookBinding,
} from "@caisson/agent-dev";
import {
  CAISSON_DEFAULT_ARTIFACTS,
  CANONICAL_LIFECYCLE,
  InMemoryAuditLifecycleStore,
  createAgentDevEdition,
  embedOrSkip,
  evaluateGuards,
  predicateGuard,
} from "@caisson/agent-dev";

/** The governance context a transition guard threads through the run (engine-neutral, secret-free). */
interface LifecycleGovContext {
  readonly run: string;
}

/** Default hybrid-memory vector width when no embedder pins one (the FTS5-only floor never uses it). */
const DEFAULT_MEMORY_DIM = 8;

/** Options for {@link runAgentDevDemo}. All seams are injectable so the exit test stays deterministic. */
export interface AgentDevDemoOptions {
  /** Where the multi-harness bundle is written (guarded fail-closed by the emitter). */
  readonly targetRoot: string;
  /** OPTIONAL embedder seam. Omitted ⇒ the FTS5 offline floor (the CLI default); wired ⇒ RRF. */
  readonly embedder?: Embedder;
  /** Deterministic clock for the audited chain — injected in tests, wall-clock in production. */
  readonly now?: () => string;
  /** Tamper-evident persistence seam; defaults to an in-memory store (offline/CLI). */
  readonly store?: AuditLifecycleStore;
  /** The governed + emitted artifact set; defaults to the curated Caisson-native set. */
  readonly artifacts?: readonly Artifact[];
  /** Hybrid-memory vector width; must equal `embedder.dim` when an embedder is wired. */
  readonly memoryDim?: number;
}

/** The structured outcome of one reference run — the goal-backward exit test asserts against it. */
export interface AgentDevDemoReport {
  /** The canonical act path actually driven through the FSM. */
  readonly lifecyclePath: readonly Act[];
  /** Count of governed transitions recorded into the audit chain (= `lifecyclePath.length - 1`). */
  readonly recordedSteps: number;
  /** The WORM anchor minted over the recorded chain (length + tip + genesis commitment). */
  readonly anchor: AuditChainAnchor;
  /** Whether the recorded chain verifies against {@link anchor} (the moat — must be `true`). */
  readonly verified: boolean;
  /** The recorded chain entries (surfaced so the exit test can prove tamper/truncation detection). */
  readonly entries: readonly AuditChainEntry[];
  /** Which retrieval path ran: `fts-only` (offline floor) or `rrf` (an embedder was wired). */
  readonly retrieval: "rrf" | "fts-only";
  /** The doc ids the demo query returned (non-empty offline via FTS5; fused via RRF when embedded). */
  readonly memoryHits: readonly string[];
  /** The absolute paths written by the multi-harness emit, in bundle order. */
  readonly emitted: readonly string[];
}

/**
 * Drive one governed lifecycle end-to-end and return its structured record. Pure of side effects
 * except the guarded emit under `options.targetRoot`; always releases the memory DB handle.
 */
export async function runAgentDevDemo(
  options: AgentDevDemoOptions,
): Promise<AgentDevDemoReport> {
  const artifacts = options.artifacts ?? CAISSON_DEFAULT_ARTIFACTS;
  const embedder = options.embedder;
  const memoryDim = options.memoryDim ?? embedder?.dim ?? DEFAULT_MEMORY_DIM;
  const store = options.store ?? new InMemoryAuditLifecycleStore();

  const edition = createAgentDevEdition({
    store,
    audited: true, // the tamper-evident moat ON — every admitted transition is chained
    memoryDim,
    artifacts,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  try {
    // 1. Governed lifecycle — advance the canonical act path; a guard returns the unified HookResult
    //    per edge, and `record` appends a chain entry + an append-only version for each admission.
    const lifecyclePath: readonly Act[] = CANONICAL_LIFECYCLE;
    const guard = predicateGuard<LifecycleGovContext>(
      () => true,
      "policy: lifecycle act not permitted",
    );
    let recordedSteps = 0;
    for (let i = 1; i < lifecyclePath.length; i++) {
      const from = lifecyclePath[i - 1]!;
      const to = lifecyclePath[i]!;
      const decision = evaluateGuards([guard], {
        from,
        to,
        context: { run: "agent-dev-demo" },
      });
      const outcome = await edition.lifecycle.record(from, to, decision);
      if (outcome.recorded) recordedSteps += 1;
    }
    const snapshot = await edition.lifecycle.snapshot();
    if (snapshot.anchor === null) {
      throw new Error("agent-dev demo: audited lifecycle recorded no anchor");
    }
    const verification = await edition.lifecycle.verify(snapshot.anchor);

    // 2. Hybrid memory — index each governed artifact; the embedder seam decides FTS5-floor vs RRF.
    for (const artifact of artifacts) {
      const text = `${artifact.name} ${artifact.description}`;
      const embedding = await embedOrSkip(embedder, text);
      edition.memory.upsert({
        id: artifact.name,
        text,
        ...(embedding !== undefined ? { embedding } : {}),
      });
    }
    const target = artifacts[0];
    if (target === undefined) {
      throw new Error("agent-dev demo: empty artifact set");
    }
    const queryText = target.description; // self-matches its own doc — a deterministic hit
    const queryVector = await embedOrSkip(embedder, queryText);
    const hits = edition.memory.hybridSearch({
      queryText,
      ...(queryVector !== undefined ? { queryVector } : {}),
      limit: 5,
    });

    // 3. Multi-harness emit — one schema → `.claude/` + Codex `AGENTS.md` + Cursor, guarded write.
    const hooks: readonly EmitHookBinding[] = [
      { on: "pre:execute", use: target.name },
    ];
    const emitted = edition.emit(options.targetRoot, hooks);

    return {
      lifecyclePath,
      recordedSteps,
      anchor: snapshot.anchor,
      verified: verification.valid,
      entries: snapshot.entries,
      retrieval: embedder !== undefined ? "rrf" : "fts-only",
      memoryHits: hits.map((hit) => hit.id),
      emitted,
    };
  } finally {
    edition.close();
  }
}
