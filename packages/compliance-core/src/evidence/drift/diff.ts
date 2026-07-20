// src/evidence/drift/diff.ts — the deterministic previous-vs-current snapshot diff (ADR-0371, SPEC
// item 2). A pure, golden-testable function: given two ComplianceSnapshots, return every (controlId,
// collectorId) whose status actually changed. "absent" represents a row present in one snapshot but
// not the other (a collector added/retired) — an honest third state rather than silently dropping it
// (the flag-never-guess ethos this whole package follows: no evidence item disappears without a
// recorded transition).
import type { ComplianceSnapshot, EvidenceItemStatus } from "./types.ts";

export type TransitionState = EvidenceItemStatus | "absent";

export interface ControlStatusTransition {
  readonly controlId: string;
  readonly collectorId: string;
  readonly from: TransitionState;
  readonly to: TransitionState;
  /** The `to` side's recorded reason, present iff `to === "flagged"`. */
  readonly toReason?: string;
}

function rowKey(row: { controlId: string; collectorId: string }): string {
  return `${row.controlId}\0${row.collectorId}`;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Diff `previous` against `current`, returning one transition per (controlId, collectorId) whose
 * status changed. A row whose status is unchanged is omitted entirely — the caller sees only real
 * drift. Deterministic: sorted by (controlId, collectorId) regardless of input order, so identical
 * evidence always yields byte-identical transition lists (golden-testable).
 */
export function diffSnapshots(
  previous: ComplianceSnapshot,
  current: ComplianceSnapshot,
): readonly ControlStatusTransition[] {
  const prevByKey = new Map(previous.map((r) => [rowKey(r), r]));
  const currByKey = new Map(current.map((r) => [rowKey(r), r]));
  const allKeys = new Set<string>([...prevByKey.keys(), ...currByKey.keys()]);

  const transitions: ControlStatusTransition[] = [];
  for (const k of allKeys) {
    const prevRow = prevByKey.get(k);
    const currRow = currByKey.get(k);
    const from: TransitionState = prevRow?.status ?? "absent";
    const to: TransitionState = currRow?.status ?? "absent";
    if (from === to) continue;
    // At least one side is present (the key came from one of the two maps).
    const identity = currRow ?? prevRow;
    if (identity === undefined) continue; // unreachable — kept for exhaustiveness, not a real branch.
    transitions.push({
      controlId: identity.controlId,
      collectorId: identity.collectorId,
      from,
      to,
      ...(to === "flagged" && currRow?.reason !== undefined
        ? { toReason: currRow.reason }
        : {}),
    });
  }

  return transitions.sort(
    (a, b) =>
      cmp(a.controlId, b.controlId) || cmp(a.collectorId, b.collectorId),
  );
}
