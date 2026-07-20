// src/evidence/drift/types.ts — the compliance drift monitor's snapshot projection (ADR-0371).
//
// A ComplianceSnapshot is the smallest deterministic projection of a generated EvidencePackManifest
// the diff engine needs: one row per (controlId, collectorId) evidence item, carrying its status and
// (for a flagged item) its recorded reason. DERIVED from the manifest, never asserted independently
// — the same "derived not asserted" discipline `pack-format.ts` already enforces for readiness and
// summary counts. This is the "persisted result set" SPEC item 1 asks for: the caller stores whatever
// `snapshotFromManifest` returns and hands the previous one back in on the next scheduled run.
import type { EvidencePackManifest } from "../pack-format.ts";

export type EvidenceItemStatus = "pass" | "flagged";

export interface ControlEvidenceSnapshot {
  readonly controlId: string;
  readonly collectorId: string;
  readonly status: EvidenceItemStatus;
  /** Present iff `status === "flagged"` (mirrors `manifestEvidenceItem`'s own invariant). */
  readonly reason?: string;
}

/** One run's projected evidence rows, sorted `(controlId, collectorId)` — deterministic, so two runs
 *  over identical evidence project to byte-identical arrays (golden-testable). */
export type ComplianceSnapshot = readonly ControlEvidenceSnapshot[];

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Project a generated pack's manifest down to its snapshot rows. Pure. */
export function snapshotFromManifest(
  manifest: EvidencePackManifest,
): ComplianceSnapshot {
  const rows: ControlEvidenceSnapshot[] = [];
  for (const control of manifest.controls) {
    for (const item of control.evidence) {
      rows.push({
        controlId: control.controlId,
        collectorId: item.collectorId,
        status: item.status,
        ...(item.reason !== undefined ? { reason: item.reason } : {}),
      });
    }
  }
  return rows.sort(
    (a, b) =>
      cmp(a.controlId, b.controlId) || cmp(a.collectorId, b.collectorId),
  );
}
