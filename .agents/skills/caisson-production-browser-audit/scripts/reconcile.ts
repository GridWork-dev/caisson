// Advisory finding reconciliation for the production browser audit (ADR-0322).
//
// This lived in `tooling/browser-audit` — a 39-line status adapter whose only production caller was
// `./finalize.ts` next door. The package boundary bought nothing but a second manifest, so C13
// folded it in here; the shared reconciler it adapts stays in `tooling/testing`. The relative
// import mirrors the one finalize.ts already used: `.agents/` sits outside the root Bun workspaces
// (package.json `workspaces`), so `@caisson/testing` does not resolve from here — and its barrel
// would drag PGlite/jsdom/axe-core in for a 50-line pure function.
import {
  reconcileLedger,
  type ReconcileClass as SharedReconcileClass,
} from "../../../../tooling/testing/src/reconcile";

export type FindingStatus = "open" | "accepted" | "closed";
export type ReconcileClass = SharedReconcileClass;

export interface LedgerFinding {
  id: string;
  status: FindingStatus;
  title: string;
}

export interface CurrentFinding {
  id: string;
  title: string;
}

export function reconcileFindings(
  previous: LedgerFinding[],
  current: CurrentFinding[],
) {
  const normalizedCurrent: LedgerFinding[] = current.map((finding) => ({
    ...finding,
    status: "open",
  }));
  return {
    ...reconcileLedger<FindingStatus, LedgerFinding>(
      previous,
      normalizedCurrent,
      {
        openStatus: "open",
        terminalStatus: "closed",
      },
    ),
    advisory: true as const,
  };
}
