// Append-only versioning (ADR-0006). A locked artifact is never mutated; a change mints a NEW
// version that supersedes the prior one via a `supersedesId` link. "Current" is DERIVED, never
// stored: a version is current iff nothing supersedes it. Pure functions, no mutation — the
// Compliance edition reuses these verbatim over its locked-version tables.
//
// Invariants enforced (flag, never guess — ADR-0006): ids are unique; every `supersedesId`
// resolves to an existing version; no cycles; a version is superseded by AT MOST one other (a fork
// would make "current" ambiguous within a lineage). A malformed set throws rather than guessing.

export interface VersionRecord {
  /** Stable unique id of this version. */
  readonly id: string;
  /** The id this version supersedes, or `null` for the original (root of a lineage). */
  readonly supersedesId: string | null;
}

/**
 * Validate the structural invariants of a version set and return fast lookup maps. Throws on any
 * violation (duplicate id, dangling `supersedesId`, fork, or cycle). Called by every query below so
 * a caller can never read a derived predicate off a malformed set.
 */
export function validateVersionSet(versions: readonly VersionRecord[]): {
  byId: Map<string, VersionRecord>;
  /** id → the version that supersedes it (its successor), when one exists. */
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

  // Cycle detection: walk each lineage from its root via successorOf; a node seen twice is a cycle.
  for (const v of versions) {
    if (v.supersedesId !== null) continue; // only walk from roots
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
  // Any version not reachable from a root participates in a cycle with no root → caught above only
  // if a root exists. A rootless cycle (every node supersedes another) leaves some id never visited:
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

/** A version is current iff it exists and nothing supersedes it. */
export function isCurrent(
  versions: readonly VersionRecord[],
  id: string,
): boolean {
  const { byId, successorOf } = validateVersionSet(versions);
  if (!byId.has(id)) {
    throw new Error(`versioning: unknown version id ${JSON.stringify(id)}`);
  }
  return !successorOf.has(id);
}

/** Every current version (the tip of each lineage), input order preserved. */
export function currentVersions(
  versions: readonly VersionRecord[],
): VersionRecord[] {
  const { successorOf } = validateVersionSet(versions);
  return versions.filter((v) => !successorOf.has(v.id));
}

/**
 * The lineage containing `id`, oldest (root) → newest (current tip). Walks `supersedesId` back to
 * the root, then `successorOf` forward to the tip.
 */
export function versionChain(
  versions: readonly VersionRecord[],
  id: string,
): VersionRecord[] {
  const { byId, successorOf } = validateVersionSet(versions);
  const start = byId.get(id);
  if (start === undefined) {
    throw new Error(`versioning: unknown version id ${JSON.stringify(id)}`);
  }
  // Walk back to the root.
  let root = start;
  while (root.supersedesId !== null) {
    root = byId.get(root.supersedesId) as VersionRecord;
  }
  // Walk forward to the tip.
  const chain: VersionRecord[] = [root];
  let cursorId = successorOf.get(root.id);
  while (cursorId !== undefined) {
    chain.push(byId.get(cursorId) as VersionRecord);
    cursorId = successorOf.get(cursorId);
  }
  return chain;
}
