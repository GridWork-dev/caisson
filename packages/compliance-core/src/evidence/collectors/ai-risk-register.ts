// src/evidence/collectors/ai-risk-register.ts — EU-AI-Act risk-register evidence (ADR-0058, ADR-0181,
// ADR-0011). EU AI Act Art. 9: a high-risk AI system runs a documented risk-management system — every
// identified risk is ASSESSED and has MITIGATION measures in force, over the system's lifecycle.
//
// Pure, like `rls-force`/`worm-retention`: it imports nothing but the collector contract. The register
// itself is traversed from the `ai-config` risk store AT THE EDGE (walking the configured AI lanes /
// models and their recorded risk assessments) and handed in as a fact — keeping the collector
// deterministic and free of any store/DB import. Fail-closed / flag-never-guess (ADR-0058):
//   - an empty register → `unresolved` (no risk-management system to attest);
//   - any entry that is not assessed, or assessed-but-unmitigated → `flagged` (a real Art. 9 gap).
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type CollectorResult,
  type EvidenceCollector,
  type ManualAttachmentSlot,
} from "../collector.ts";

/** One risk-register entry, traversed from the ai-config risk store at the edge. */
export interface AiRiskEntryFact {
  /** Stable risk id (register key). */
  readonly riskId: string;
  /** What the risk concerns — the AI lane / model / provider it was raised against. */
  readonly subject: string;
  /** A documented risk assessment has been performed for this entry. */
  readonly assessed: boolean;
  /** At least one mitigation measure is recorded and in force for this risk. */
  readonly mitigated: boolean;
}

/** The base fact: the AI risk register in scope for the tenant/system. */
export interface AiRiskRegisterFact {
  readonly entries: readonly AiRiskEntryFact[];
}

export interface AiRiskRegisterCollectorOptions {
  /** The canonical control id this evidences; defaults to the AI-lifecycle risk-management control. */
  readonly controlId?: string;
}

const DEFAULT_CONTROL_ID = "RISK-MANAGEMENT.AI-LIFECYCLE";
const COLLECTOR_ID = "substrate.ai-risk-register";
const TITLE = "AI risk register assessed and mitigated (EU AI Act Art. 9)";

/** An entry is adequately managed iff it has been assessed AND has mitigation in force. */
function isManaged(e: AiRiskEntryFact): boolean {
  return e.assessed && e.mitigated;
}

/** Build the AI risk-register traversal collector. Pure: a register snapshot in, a result out. */
export function aiRiskRegisterCollector(
  options: AiRiskRegisterCollectorOptions = {},
): EvidenceCollector<AiRiskRegisterFact> {
  const controlId = options.controlId ?? DEFAULT_CONTROL_ID;
  // A passing traversal still invites the human-authored risk-management policy document.
  const manualSlots: readonly ManualAttachmentSlot[] = [
    {
      id: "ai-risk-management-policy",
      label: "AI risk-management system policy (EU AI Act Art. 9)",
      required: false,
    },
  ];

  return {
    id: COLLECTOR_ID,
    controlId,
    title: TITLE,
    manualSlots,
    collect(fact: AiRiskRegisterFact): CollectorResult {
      const entryCount = fact.entries.length;

      // No register → no risk-management system to attest. Refuse to guess a pass.
      if (entryCount === 0) {
        return unresolvedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary:
              "the AI risk register is empty; no risk-management system was traversed",
            facts: { entryCount: 0, managedCount: 0, deficientRisks: [] },
            manualSlots,
          },
          "no AI risk-register entries; a risk-management system cannot be attested",
        );
      }

      // Deterministic: sort deficient ids so input order never changes the evidence bytes.
      const deficientRisks = fact.entries
        .filter((e) => !isManaged(e))
        .map((e) => e.riskId)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const managedCount = entryCount - deficientRisks.length;
      const facts = { entryCount, managedCount, deficientRisks };

      if (deficientRisks.length === 0) {
        return passResult({
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: `all ${String(entryCount)} AI risks are assessed and mitigated`,
          facts,
          manualSlots,
        });
      }

      return flaggedResult(
        {
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: `${String(deficientRisks.length)} of ${String(entryCount)} AI risks are unassessed or unmitigated`,
          facts,
          manualSlots,
        },
        `AI risks missing a completed assessment or mitigation: ${deficientRisks.join(", ")}`,
      );
    },
  };
}
