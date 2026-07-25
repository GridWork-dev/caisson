// Deterministic client-side mirror of @caisson/prompt-registry's alias-move mechanic (ADR-0061,
// ADR-0378 lock 2) for the "Alias mover" poke. The real registerPrompt()/getVersion()/setAlias()
// (packages/prompt-registry/src/registry.ts) all take a @caisson/tenancy-rls `TenantExecutor` and
// run SQL against prompt_version / prompt_alias; they also import from the `@caisson/kernel` barrel
// (NotFoundError, currentVersions, versionChain) which itself pulls node:crypto (crypto.ts) and
// node:dns (ssrf.ts) — none of that resolves in a browser bundle, exactly the constraint
// audit-worm-logic.ts documents for its own kernel barrel dependency. So the pure alias-move
// semantics are mirrored here by hand and pinned in prompt-registry-logic.test.ts, which imports the
// REAL @caisson/prompt-registry + @caisson/kernel packages under bun and runs the real DB-bound
// registerPrompt()/setAlias()/getVersion() on PGlite (@caisson/testing), asserting this mirror's
// observable outcomes are identical.
//
// Two invariants the real schema enforces (schema.ts) drive the whole poke:
//   - `prompt_version` is APPEND-ONLY: UPDATE and DELETE are REVOKED from the app role. A version
//     row is minted once and never mutates or vanishes.
//   - `prompt_alias` is a MUTABLE pointer: promotion is `setAlias`, which resolves the target version
//     FIRST (`getVersion`) so a dangling alias can never be written — fail-closed. Promotion mutates
//     ONLY the pointer, never a version row.
//
// Nothing here fetches, persists, or measures anyone. The sample registry is fixed and labeled
// sample.
//
// Sources mirrored: packages/prompt-registry/src/registry.ts (setAlias's resolve-before-write fail-
// closed shape, parsePromptRef), packages/kernel/src/versioning.ts (validateVersionSet /
// currentVersions — the append-only lineage's derived "current" tip), packages/kernel/src/errors.ts
// (NotFoundError code/httpStatus/message shape).

/** Mirror of kernel `VersionRecord` (packages/kernel/src/versioning.ts). */
export interface VersionRecord {
  readonly id: string;
  readonly supersedesId: string | null;
}

/**
 * Byte-identical port of `validateVersionSet` (packages/kernel/src/versioning.ts): every id unique,
 * every `supersedesId` resolves, no fork, no cycle. Pinned against the real function in the test.
 */
export function validateVersionSet(versions: readonly VersionRecord[]): {
  byId: Map<string, VersionRecord>;
  successorOf: Map<string, string>;
} {
  const byId = new Map<string, VersionRecord>();
  for (const v of versions) {
    if (byId.has(v.id)) {
      throw new Error(
        `versioning: duplicate version id ${JSON.stringify(v.id)}`,
      );
    }
    byId.set(v.id, v);
  }

  const successorOf = new Map<string, string>();
  for (const v of versions) {
    if (v.supersedesId === null) continue;
    if (!byId.has(v.supersedesId)) {
      throw new Error(
        `versioning: ${JSON.stringify(v.id)} supersedes unknown version ${JSON.stringify(v.supersedesId)}`,
      );
    }
    if (v.supersedesId === v.id) {
      throw new Error(`versioning: ${JSON.stringify(v.id)} supersedes itself`);
    }
    const existing = successorOf.get(v.supersedesId);
    if (existing !== undefined) {
      throw new Error(
        `versioning: ${JSON.stringify(v.supersedesId)} is superseded by both ${JSON.stringify(existing)} and ${JSON.stringify(v.id)} (fork)`,
      );
    }
    successorOf.set(v.supersedesId, v.id);
  }

  for (const v of versions) {
    if (v.supersedesId !== null) continue;
    const seen = new Set<string>();
    let cursor: string | undefined = v.id;
    while (cursor !== undefined) {
      if (seen.has(cursor)) {
        throw new Error(
          `versioning: cycle detected at ${JSON.stringify(cursor)}`,
        );
      }
      seen.add(cursor);
      cursor = successorOf.get(cursor);
    }
  }
  const reachable = new Set<string>();
  for (const v of versions) {
    if (v.supersedesId !== null) continue;
    let cursor: string | undefined = v.id;
    while (cursor !== undefined && !reachable.has(cursor)) {
      reachable.add(cursor);
      cursor = successorOf.get(cursor);
    }
  }
  if (reachable.size !== byId.size) {
    throw new Error(
      "versioning: a rootless cycle (no original version) is present",
    );
  }

  return { byId, successorOf };
}

/** Mirror of `currentVersions` (versioning.ts): every lineage tip, input order preserved. */
export function currentVersions(
  versions: readonly VersionRecord[],
): VersionRecord[] {
  const { successorOf } = validateVersionSet(versions);
  return versions.filter((v) => !successorOf.has(v.id));
}

/**
 * Mirror of `NotFoundError` (packages/kernel/src/errors.ts). The real class extends `CaissonError`
 * and carries `code`/`httpStatus`/`details`; this mirror skips only the DB-facing envelope machinery
 * this client-only replay never needs. Byte-pinned against the real class in the test.
 */
export class NotFoundError extends Error {
  readonly code = "not_found";
  readonly httpStatus = 404;
  readonly details: Record<string, unknown>;
  constructor(message = "Not found", details: Record<string, unknown> = {}) {
    super(message);
    this.name = "NotFoundError";
    this.details = details;
  }
}

/** A parsed `name@selector` reference (mirror of registry.ts `PromptRef`). */
export type PromptRef =
  | { readonly name: string; readonly kind: "current" }
  | {
      readonly name: string;
      readonly kind: "version";
      readonly version: number;
    }
  | { readonly name: string; readonly kind: "alias"; readonly alias: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Mirror of `parsePromptRef` (registry.ts). No `@` resolves the current tip; a numeric selector is a
 * version; anything else is an alias. This mirror throws a plain `Error` on an invalid slug where the
 * real function throws kernel `ValidationError` — the parity test asserts the parsed shape, not the
 * error class.
 */
export function parsePromptRef(ref: string): PromptRef {
  const at = ref.indexOf("@");
  const name = at === -1 ? ref : ref.slice(0, at);
  if (!SLUG_RE.test(name)) throw new Error(`invalid prompt name: ${name}`);
  if (at === -1) return { name, kind: "current" };
  const selector = ref.slice(at + 1);
  if (/^[0-9]+$/.test(selector)) {
    return { name, kind: "version", version: Number.parseInt(selector, 10) };
  }
  if (!SLUG_RE.test(selector)) {
    throw new Error(`invalid alias: ${selector}`);
  }
  return { name, kind: "alias", alias: selector };
}

// --- The poke model (baked sample registry + state operations) ---

/** One immutable, minted prompt version row. */
export interface PromptVersionRow extends VersionRecord {
  readonly version: number;
  /** A short human label for what changed at this version (sample content, not a real prompt body). */
  readonly summary: string;
}

/** The sample prompt name every version + the alias below belong to. */
export const SAMPLE_NAME = "soc2-summary";

/** The fixed append-only lineage: v1 -> v2 -> v3 -> v4, oldest first. Never mutated or removed. */
export const SAMPLE_VERSIONS: readonly PromptVersionRow[] = [
  {
    id: "pv_1",
    supersedesId: null,
    version: 1,
    summary: "Initial system prompt, neutral tone",
  },
  {
    id: "pv_2",
    supersedesId: "pv_1",
    version: 2,
    summary: "Added citation requirement",
  },
  {
    id: "pv_3",
    supersedesId: "pv_2",
    version: 3,
    summary: "Tightened injection-guard wording",
  },
  {
    id: "pv_4",
    supersedesId: "pv_3",
    version: 4,
    summary: "Added SOC2 CC6.1 context clause",
  },
];

/** The `prod` alias starts mid-lineage so both promoting forward and rolling back are reachable. */
export const INITIAL_ALIAS_VERSION_ID = "pv_2";

function rowByVersion(version: number): PromptVersionRow | undefined {
  return SAMPLE_VERSIONS.find((v) => v.version === version);
}

function rowById(id: string): PromptVersionRow {
  const row = SAMPLE_VERSIONS.find((v) => v.id === id);
  if (row === undefined) {
    throw new Error(`prompt-registry poke: unknown version id ${id}`);
  }
  return row;
}

/** The lineage tip: the version nothing supersedes (derived, never stored). */
export function currentTipVersion(): number {
  const tip = currentVersions(SAMPLE_VERSIONS)[0];
  return tip === undefined ? 0 : rowById(tip.id).version;
}

/** Mirror of `getVersion`: fail-closed lookup by version number against the fixed lineage. */
export function resolveVersion(version: number): PromptVersionRow {
  const row = rowByVersion(version);
  if (row === undefined) {
    throw new NotFoundError("Prompt version not found", {
      name: SAMPLE_NAME,
      version,
    });
  }
  return row;
}

export interface SetAliasResult {
  readonly ok: boolean;
  readonly versionId: string | null;
  readonly error: NotFoundError | null;
}

/**
 * Mirror of `setAlias`'s resolve-before-write shape: the target version is resolved FIRST, so a
 * dangling alias (pointing at a version that was never minted) can never be written.
 */
export function trySetAlias(targetVersion: number): SetAliasResult {
  try {
    const target = resolveVersion(targetVersion);
    return { ok: true, versionId: target.id, error: null };
  } catch (err) {
    if (err instanceof NotFoundError) {
      return { ok: false, versionId: null, error: err };
    }
    throw err;
  }
}

/** One append-only move-log line: every attempt is recorded, whether it moved the pointer or not. */
export interface MoveLogEntry {
  readonly seq: number;
  readonly fromVersion: number;
  readonly targetVersion: number;
  readonly ok: boolean;
}

export interface RegistryState {
  /** The `prod` alias's current target (a version row id — the only mutable cell in this poke). */
  readonly aliasVersionId: string;
  /** Append-only: every move attempt appends here, newest first. Never rewritten or trimmed. */
  readonly moveLog: readonly MoveLogEntry[];
}

export function aliasVersion(state: RegistryState): number {
  return rowById(state.aliasVersionId).version;
}

export function initialState(): RegistryState {
  return { aliasVersionId: INITIAL_ALIAS_VERSION_ID, moveLog: [] };
}

/**
 * Attempt to point `prod` at `targetVersion`. The move-log entry ALWAYS appends (an honest audit
 * trail of every attempt, denied or not); the pointer itself only moves on success, and no version
 * row is ever touched either way.
 */
export function moveAlias(
  state: RegistryState,
  targetVersion: number,
): RegistryState {
  const result = trySetAlias(targetVersion);
  const entry: MoveLogEntry = {
    seq: state.moveLog.length,
    fromVersion: aliasVersion(state),
    targetVersion,
    ok: result.ok,
  };
  return {
    aliasVersionId: result.ok
      ? (result.versionId as string)
      : state.aliasVersionId,
    moveLog: [entry, ...state.moveLog],
  };
}

/** The verdict line: computed from the last move attempt, never asserted copy. No em dashes (ADR-0375). */
export function verdictLine(state: RegistryState): {
  state: "ok" | "fail" | "neutral";
  text: string;
} {
  const last = state.moveLog[0];
  const cur = aliasVersion(state);
  if (last === undefined) {
    return {
      state: "neutral",
      text: `prod points at v${cur}. Every version row stays forever, only the pointer moves.`,
    };
  }
  if (!last.ok) {
    return {
      state: "fail",
      text: `Version ${last.targetVersion} was never minted. Dangling alias rejected, prod still points at v${cur}.`,
    };
  }
  return {
    state: "ok",
    text: `prod now points at v${cur}. No version row moved, ${SAMPLE_VERSIONS.length} rows still on file.`,
  };
}
