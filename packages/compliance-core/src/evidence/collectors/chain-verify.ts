// src/evidence/collectors/chain-verify.ts — audit-chain integrity evidence (ADR-0058, ADR-0052).
//
// Composes the kernel's `verifyChain(entries, anchor)` VERBATIM over the persisted chain + its
// trusted WORM anchor (gathered at the edge by `@caisson-sh/audit-worm`'s `AuditChainStore`). The collector adds no hash
// algebra; it only turns the verification verdict into an evidence item. Flag-never-guess: a missing
// anchor is `unresolved` (integrity cannot be attested), a failed verification is `flagged`.
import {
  verifyChain,
  type AuditChainAnchor,
  type AuditChainEntry,
} from "@caisson-sh/kernel/node";
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type CollectorResult,
  type EvidenceCollector,
  type ManualAttachmentSlot,
} from "../collector.ts";

/** The base fact: a tenant's loaded chain and its trusted anchor (`null` if none has been minted). */
export interface ChainVerifyFact {
  readonly entries: readonly AuditChainEntry[];
  readonly anchor: AuditChainAnchor | null;
}

export interface ChainVerifyCollectorOptions {
  /** The canonical control id this evidences; defaults to the immutable-audit-log control. */
  readonly controlId?: string;
}

const DEFAULT_CONTROL_ID = "AUDIT.IMMUTABLE-LOG";
const COLLECTOR_ID = "substrate.audit-chain-integrity";
const TITLE = "Append-only audit chain integrity (WORM-anchored)";

/** Build the audit-chain integrity collector. Pure: a fact in, an evidence result out. */
export function chainVerifyCollector(
  options: ChainVerifyCollectorOptions = {},
): EvidenceCollector<ChainVerifyFact> {
  const controlId = options.controlId ?? DEFAULT_CONTROL_ID;
  const manualSlots: readonly ManualAttachmentSlot[] = [];

  return {
    id: COLLECTOR_ID,
    controlId,
    title: TITLE,
    manualSlots,
    collect(fact: ChainVerifyFact): CollectorResult {
      const entryCount = fact.entries.length;

      // No trusted anchor → integrity cannot be attested (the chain could have been truncated or
      // wholesale-rewritten and we'd have no commitment to catch it). Refuse to guess.
      if (fact.anchor === null) {
        return unresolvedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary: "no trusted WORM anchor was supplied for the audit chain",
            facts: { entryCount, anchorPresent: false },
            manualSlots,
          },
          "audit chain has no trusted anchor; integrity cannot be attested",
        );
      }

      const verification = verifyChain(fact.entries, fact.anchor);
      const facts = {
        entryCount,
        anchorPresent: true,
        anchorLength: fact.anchor.length,
        valid: verification.valid,
        brokenAt: verification.brokenAt,
      };

      if (verification.valid) {
        return passResult({
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: `audit chain verified against its anchor (${String(entryCount)} entries)`,
          facts,
          manualSlots,
        });
      }

      return flaggedResult(
        {
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: "audit chain failed verification against its trusted anchor",
          facts,
          manualSlots,
        },
        `chain verification failed at index ${String(verification.brokenAt)}`,
      );
    },
  };
}
