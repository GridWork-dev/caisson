// src/evidence/collectors/worm-retention.ts — WORM retention-floor evidence (ADR-0058, ADR-0054).
//
// Evidences that a locked artifact's WORM `retain_until` meets the legal retention floor. The floor
// itself (the HIPAA/SEC 6–7yr term) is `audit-worm`'s policy: the edge computes the required date
// via `retainUntilFrom(lockedAt, MIN_RETENTION_YEARS)` and hands it in as `requiredUntil`, keeping
// this collector pure and free of any `audit-worm` import (composable-down, no policy duplication).
// Flag-never-guess: absent retention metadata → `unresolved`; a term short of the floor → `flagged`.
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type CollectorResult,
  type EvidenceCollector,
  type ManualAttachmentSlot,
} from "../collector.ts";

/** The base fact: a WORM object's retention term, plus the legal floor computed at the edge. */
export interface WormRetentionFact {
  /** The tenant-scoped WORM object key (`{account_id}/…`). */
  readonly key: string;
  /** The artifact's WORM lock expiry, or `null` when no retention metadata is present. */
  readonly retainUntil: Date | null;
  /** The minimum acceptable expiry (legal floor) for this artifact, computed at the edge. */
  readonly requiredUntil: Date;
}

export interface WormRetentionCollectorOptions {
  /** The canonical control id this evidences; defaults to the data-disposal/retention control. */
  readonly controlId?: string;
}

const DEFAULT_CONTROL_ID = "DATA-PROTECTION.DISPOSAL";
const COLLECTOR_ID = "substrate.worm-retention-floor";
const TITLE = "WORM retention meets the legal floor";

/** Build the WORM retention-floor collector. Pure: a retention fact in, an evidence result out. */
export function wormRetentionCollector(
  options: WormRetentionCollectorOptions = {},
): EvidenceCollector<WormRetentionFact> {
  const controlId = options.controlId ?? DEFAULT_CONTROL_ID;
  const manualSlots: readonly ManualAttachmentSlot[] = [
    {
      id: "object-lock-configuration",
      label: "S3 Object-Lock / WORM configuration evidence",
      required: false,
    },
  ];

  return {
    id: COLLECTOR_ID,
    controlId,
    title: TITLE,
    manualSlots,
    collect(fact: WormRetentionFact): CollectorResult {
      const requiredIso = fact.requiredUntil.toISOString();

      // No retention metadata → the WORM lock cannot be attested. Refuse to guess a pass.
      if (fact.retainUntil === null) {
        return unresolvedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary: "no WORM retention term was found for the artifact",
            facts: {
              key: fact.key,
              retainUntil: null,
              requiredUntil: requiredIso,
            },
            manualSlots,
          },
          `no retain_until on ${fact.key}; WORM retention cannot be attested`,
        );
      }

      const retainIso = fact.retainUntil.toISOString();
      const facts = {
        key: fact.key,
        retainUntil: retainIso,
        requiredUntil: requiredIso,
      };

      if (fact.retainUntil.getTime() >= fact.requiredUntil.getTime()) {
        return passResult({
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: `WORM retention until ${retainIso} meets the floor (${requiredIso})`,
          facts,
          manualSlots,
        });
      }

      return flaggedResult(
        {
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: `WORM retention until ${retainIso} is short of the floor (${requiredIso})`,
          facts,
          manualSlots,
        },
        `retain_until ${retainIso} is earlier than the required floor ${requiredIso} for ${fact.key}`,
      );
    },
  };
}
