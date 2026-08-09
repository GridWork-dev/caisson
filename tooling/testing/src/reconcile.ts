export type ReconcileClass = "new" | "unchanged" | "regressed" | "closed";

export interface ReconcileLedgerItem<TStatus extends string> {
  id: string;
  status: TStatus;
}

export function reconcileLedger<
  TStatus extends string,
  TItem extends ReconcileLedgerItem<TStatus>,
>(
  previous: readonly TItem[],
  current: readonly TItem[],
  options: { openStatus: TStatus; terminalStatus: TStatus },
): { ledger: TItem[]; classes: Record<string, ReconcileClass> } {
  const previousById = new Map(
    previous.map((finding) => [finding.id, finding]),
  );
  const currentIds = new Set(current.map((finding) => finding.id));
  const classes: Record<string, ReconcileClass> = {};
  const ledger = current.map((finding): TItem => {
    const prior = previousById.get(finding.id);
    if (!prior) {
      classes[finding.id] = "new";
      return { ...finding, status: options.openStatus } as TItem;
    }
    if (prior.status === options.terminalStatus) {
      classes[finding.id] = "regressed";
      return { ...finding, status: options.openStatus } as TItem;
    }
    classes[finding.id] = "unchanged";
    return { ...finding, status: prior.status };
  });

  for (const prior of previous) {
    if (currentIds.has(prior.id)) continue;
    if (prior.status === options.terminalStatus) {
      ledger.push(prior);
      continue;
    }
    classes[prior.id] = "closed";
    ledger.push({ ...prior, status: options.terminalStatus } as TItem);
  }

  ledger.sort((a, b) => a.id.localeCompare(b.id));
  const sortedClasses = Object.fromEntries(
    Object.entries(classes).sort(([a], [b]) => a.localeCompare(b)),
  ) as Record<string, ReconcileClass>;
  return { ledger, classes: sortedClasses };
}
