// Audited-lifecycle persistence — the moat (ADR-0065/0066, reuses ADR-0006). An OPT-IN engine that
// records each governed FSM transition into the shipped kernel compliance substrate:
//   - the AUDIT-CHAIN (`chainEntry` / `anchorChain` / `verifyChain`) — a SHA-256 append-only chain
//     whose anchor (held in WORM, outside the chain) makes the lifecycle history tamper-EVIDENT:
//     an altered, inserted, reordered, dropped, truncated, or wholesale-rewritten step fails
//     `verifyChain` against the anchor.
//   - VERSIONING (`validateVersionSet` / `currentVersions`) — an append-only `supersedesId` lineage
//     keyed on each entry's content hash, so the run's transition history is a single derived chain
//     ("current" = the tip nothing supersedes), enforced (never guessed) on every append.
//
// Engine-neutral and PURE: it runs no act and calls no engine; the HOST supplies the store (any
// `AuditLifecycleStore`; an in-memory default ships for offline/CLI use) and an optional clock seam.
// AUDITED mode is the opt-in tamper-evident UPGRADE over a bare run: with it off, transitions are
// still FSM-validated but nothing is recorded; with it on, every admitted transition is chained.
// Fail-closed: an illegal FSM edge throws (flag-never-guess, via `lifecycle.transition`), and a
// VETOED transition (`deny`) is never recorded as having happened.
import {
  chainEntry,
  anchorChain,
  verifyChain,
  validateVersionSet,
  currentVersions,
  ValidationError,
} from "@caisson-sh/kernel/node";
import type {
  AuditChainEntry,
  AuditChainAnchor,
  ChainVerification,
  VersionRecord,
} from "@caisson-sh/kernel";
import { transition } from "./lifecycle.ts";
import type { Act } from "./lifecycle.ts";
import type { HookResult } from "./governance.ts";

/** The recorded governance outcome of an admitted transition. A `deny` is never recorded. */
export type RecordedDecision = "allow" | "mutate";

/**
 * The canonical payload committed to the chain per governed transition. Deterministic and
 * secret-free by construction: only the edge, the admitting decision, and an injected timestamp —
 * never a governance `reason`, a context value, or any adopter secret.
 */
export interface LifecycleAuditPayload {
  readonly from: Act;
  readonly to: Act;
  readonly decision: RecordedDecision;
  /** ISO-8601 instant from the injected clock seam — deterministic in tests, real in production. */
  readonly at: string;
}

/**
 * The persisted state: the audit-chain entries, the append-only version lineage (ids = entry
 * hashes), and the trusted anchor over the chain tip. `anchor` is `null` only for an empty chain.
 */
export interface AuditLifecycleSnapshot {
  readonly entries: readonly AuditChainEntry[];
  readonly versions: readonly VersionRecord[];
  readonly anchor: AuditChainAnchor | null;
}

/**
 * The store seam the HOST supplies. Sync or async; the engine `await`s both. A production app
 * persists to WORM/append-only storage; CI and the offline CLI use `InMemoryAuditLifecycleStore`.
 */
export interface AuditLifecycleStore {
  read(): AuditLifecycleSnapshot | Promise<AuditLifecycleSnapshot>;
  write(snapshot: AuditLifecycleSnapshot): void | Promise<void>;
}

/** The outcome of `record`: discriminated on whether the audited mode actually persisted a step. */
export type RecordOutcome =
  | { readonly recorded: false }
  | {
      readonly recorded: true;
      readonly entry: AuditChainEntry;
      readonly version: VersionRecord;
      readonly anchor: AuditChainAnchor;
    };

const EMPTY: AuditLifecycleSnapshot = {
  entries: [],
  versions: [],
  anchor: null,
};

/** A zero-dependency in-memory store — the offline/CI default. Snapshots are treated immutable. */
export class InMemoryAuditLifecycleStore implements AuditLifecycleStore {
  #snapshot: AuditLifecycleSnapshot = EMPTY;
  read(): AuditLifecycleSnapshot {
    return this.#snapshot;
  }
  write(snapshot: AuditLifecycleSnapshot): void {
    this.#snapshot = snapshot;
  }
}

/** Construction options for {@link AuditedLifecycle}. */
export interface AuditedLifecycleOptions {
  /** The persistence seam. */
  readonly store: AuditLifecycleStore;
  /** Opt-in switch. `false` (default) = FSM-validate only, record nothing (no tamper-evidence). */
  readonly audited?: boolean;
  /** Clock seam — injected for deterministic tests; defaults to wall-clock ISO time. */
  readonly now?: () => string;
}

/**
 * Map an upstream governance result to the decision recorded on the chain. Fail-closed: a `deny`
 * means the transition was vetoed and DID NOT happen, so it must never be recorded; the `reason`
 * is never surfaced (redaction-safe). An absent result (an ungoverned-but-legal edge) is `allow`.
 */
function recordedDecision<C>(
  result: HookResult<C> | undefined,
): RecordedDecision {
  if (result === undefined || result.decision === "allow") return "allow";
  if (result.decision === "mutate") return "mutate";
  throw new ValidationError("Cannot record a vetoed lifecycle transition", {
    decision: result.decision,
  });
}

/**
 * The audited-lifecycle engine. Each `record(from, to, result?)`:
 *   1. validates the FSM edge via `lifecycle.transition` — an illegal edge THROWS (flag-never-guess);
 *   2. derives the recorded decision, fail-closed on a `deny`;
 *   3. in audited mode ONLY: appends a chain entry over the tip, mints a version record keyed on the
 *      entry hash (`supersedesId` = the previous tip hash → an append-only lineage), re-validates the
 *      version invariants, re-anchors, and persists. Out of audited mode it records nothing.
 * `verify` re-runs `verifyChain` against a TRUSTED anchor (the caller's WORM-held one, else the
 * stored one) — that is what catches tail-truncation and wholesale rewrite, not just interior tamper.
 */
export class AuditedLifecycle {
  readonly #store: AuditLifecycleStore;
  readonly #audited: boolean;
  readonly #now: () => string;

  constructor(options: AuditedLifecycleOptions) {
    this.#store = options.store;
    this.#audited = options.audited ?? false;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  /** Whether this engine persists tamper-evident records (the opt-in moat is on). */
  get audited(): boolean {
    return this.#audited;
  }

  /** Record one governed transition. See the class doc for the ordered guarantees. */
  async record<C>(
    from: Act,
    to: Act,
    result?: HookResult<C>,
  ): Promise<RecordOutcome> {
    transition(from, to); // FSM legality — throws ValidationError on an illegal edge
    const decision = recordedDecision(result); // fail-closed on a vetoed transition

    if (!this.#audited) return { recorded: false };

    const snapshot = await this.#read();
    const tip =
      snapshot.entries.length === 0
        ? null
        : (snapshot.entries[snapshot.entries.length - 1] as AuditChainEntry);

    // A fresh object literal in the canonical `LifecycleAuditPayload` SHAPE — assignable to the
    // chain's `JsonValue` payload directly (every field is a string), no cast. Deterministic and
    // secret-free: only the edge, the admitting decision, and the injected timestamp.
    const entry = chainEntry(tip, { from, to, decision, at: this.#now() });
    // Version id = the entry's content hash; supersedesId = the prior tip hash. A linear,
    // append-only lineage that reuses the kernel versioning primitive verbatim.
    const version: VersionRecord = {
      id: entry.hash,
      supersedesId: entry.prevHash,
    };

    const entries: readonly AuditChainEntry[] = [...snapshot.entries, entry];
    const versions: readonly VersionRecord[] = [...snapshot.versions, version];
    validateVersionSet(versions); // enforce append-only invariants (throws on any violation)
    const anchor = anchorChain(entries);

    await this.#store.write({ entries, versions, anchor });
    return { recorded: true, entry, version, anchor };
  }

  /**
   * Verify the recorded chain end to end. Pass the caller's WORM-held `trustedAnchor` to catch
   * tail-truncation and wholesale rewrite; with none, the stored anchor is used (interior tamper is
   * caught regardless). An empty chain verifies vacuously.
   */
  async verify(trustedAnchor?: AuditChainAnchor): Promise<ChainVerification> {
    const snapshot = await this.#read();
    const anchor = trustedAnchor ?? snapshot.anchor ?? undefined;
    return verifyChain(snapshot.entries, anchor);
  }

  /** The current persisted snapshot (entries + versions + anchor). */
  async snapshot(): Promise<AuditLifecycleSnapshot> {
    return this.#read();
  }

  /** The current version (the tip nothing supersedes), or `null` for an empty history. */
  async currentVersion(): Promise<VersionRecord | null> {
    const { versions } = await this.#read();
    if (versions.length === 0) return null;
    const tips = currentVersions(versions);
    return tips[tips.length - 1] ?? null;
  }

  async #read(): Promise<AuditLifecycleSnapshot> {
    return this.#store.read();
  }
}
