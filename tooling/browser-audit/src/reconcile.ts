import {
  reconcileLedger,
  type ReconcileClass as SharedReconcileClass,
} from "@caisson/testing";

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
