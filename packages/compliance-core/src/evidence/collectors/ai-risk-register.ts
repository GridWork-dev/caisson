// src/evidence/collectors/ai-risk-register.ts — EU-AI-Act risk-register evidence. EU AI Act Art. 9:
// a high-risk AI system runs a documented risk-management system — every identified risk is rated
// and has a mitigation measure in force, over the system's lifecycle.
//
// An instance of the generalized risk model (`@caisson-sh/risk-register`): the register traversed here
// is a set of scored `RiskEntry` rows. Under that model, being rated (likelihood + impact recorded,
// residual computed) is a structural property of register membership — you cannot add an entry
// without scoring it — so "every risk has been assessed" now follows from the register existing at
// all, and the collector's remaining question is whether a treatment plan is on record for each one.
//
// Pure, like `rls-force`/`worm-retention`: the register itself is traversed from the `ai-config`
// risk store AT THE EDGE (walking the configured AI lanes / models and their recorded risk scores)
// and handed in as a fact — keeping the collector deterministic and free of any store/DB import.
// Fail-closed / flag-never-guess:
//   - an empty register → `unresolved` (no risk-management system to attest);
//   - any entry with no treatment plan on record → `flagged` (a real Art. 9 gap).
import type { RiskEntry } from "@caisson-sh/risk-register";
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type CollectorResult,
  type EvidenceCollector,
  type ManualAttachmentSlot,
} from "../collector.ts";

/** The base fact: the AI risk register in scope for the tenant/system — an instance of the
 *  generalized `@caisson-sh/risk-register` model. Kept as a named alias for callers already typed
 *  against the collector's original field name. */
export type AiRiskEntryFact = RiskEntry;

export interface AiRiskRegisterFact {
  readonly entries: readonly AiRiskEntryFact[];
}

export interface AiRiskRegisterCollectorOptions {
  /** The canonical control id this evidences; defaults to the AI-lifecycle risk-management control. */
  readonly controlId?: string;
}

const DEFAULT_CONTROL_ID = "RISK-MANAGEMENT.AI-LIFECYCLE";
const COLLECTOR_ID = "substrate.ai-risk-register";
// WR-03: this collector verifies a treatment plan is ON RECORD — it cannot verify the plan's
// measures are IN FORCE. Every operator-visible string below says exactly that; "mitigated"
// would overclaim what a register traversal can attest.
const TITLE =
  "AI risk register assessed with treatment plans on record (EU AI Act Art. 9)";

/** An entry is adequately managed iff it carries a recorded treatment plan — every entry reaching
 *  this collector is already rated (a structural property of `RiskEntry` membership). */
function isManaged(e: AiRiskEntryFact): boolean {
  return e.treatmentPlan !== null;
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
          summary: `all ${String(entryCount)} AI risks are assessed with a treatment plan on record`,
          facts,
          manualSlots,
        });
      }

      return flaggedResult(
        {
          collectorId: COLLECTOR_ID,
          controlId,
          title: TITLE,
          summary: `${String(deficientRisks.length)} of ${String(entryCount)} AI risks have no treatment plan on record`,
          facts,
          manualSlots,
        },
        `AI risks with no treatment plan on record: ${deficientRisks.join(", ")}`,
      );
    },
  };
}
