// src/evidence/binding-table.ts — the control<->collector binding table (PLAN Group E task E1,
// the em-dash `tool-bindings.json` analog).
//
// The control->collector binding is ALREADY EXISTS as code: every `EvidenceCollector` declares its
// own `controlId` (ADR-0058). This module does not add a new binding layer or config file -- it is
// a pure, deterministic PROJECTION of the collectors that already ship, so the binding is visible as
// one table (a derived artifact, golden-pinned) instead of requiring a reader to open six source
// files. `docs/compliance/control-traceability.md`'s "the code IS the table" idiom, applied here.
import type { ManualAttachmentSlot } from "./collector.ts";
import type { Framework } from "@caisson-sh/frameworks-pack";

/** The minimal collector shape this module reads -- avoids the generic `EvidenceCollector<Fact>`
 *  variance entirely (only `id`/`controlId`/`manualSlots` are ever read). */
export interface BindingSourceCollector {
  readonly id: string;
  readonly controlId: string;
  readonly manualSlots: readonly ManualAttachmentSlot[];
}

/** One row of the derived binding table. */
export interface BindingRow {
  /** The collector's stable id (e.g. `substrate.audit-chain-integrity`). */
  readonly collectorId: string;
  /** The canonical control id this collector's default binds to. */
  readonly controlId: string;
  /** Manual-attachment slot ids this collector invites. */
  readonly manualSlotIds: readonly string[];
  /** Whether `controlId` resolves to a real canonical control in ANY of the supplied packs. A
   *  `false` row is a real, surfaced finding -- never silently hidden or auto-corrected here. */
  readonly resolved: boolean;
}

/** Locale-independent lexicographic comparator (mirrors generate.ts / crosswalk-rollup.ts). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Project the shipped collectors' declared bindings into a deterministic table, sorted by
 * `collectorId`. Pure: no I/O, no clock. `packs` is used only to compute `resolved` -- it never
 * changes a collector's own `controlId`.
 */
export function buildBindingTable(
  collectors: readonly BindingSourceCollector[],
  packs: readonly Framework[],
): readonly BindingRow[] {
  const knownControlIds = new Set(
    packs.flatMap((pack) => pack.controls.map((control) => control.id)),
  );
  return [...collectors]
    .map((c) => ({
      collectorId: c.id,
      controlId: c.controlId,
      manualSlotIds: c.manualSlots.map((s) => s.id),
      resolved: knownControlIds.has(c.controlId),
    }))
    .sort((a, b) => cmp(a.collectorId, b.collectorId));
}
