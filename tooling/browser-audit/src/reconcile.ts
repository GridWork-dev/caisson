export type FindingStatus = "open" | "accepted" | "closed";
export type ReconcileClass = "new" | "unchanged" | "regressed" | "closed";

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
  const previousById = new Map(
    previous.map((finding) => [finding.id, finding]),
  );
  const currentIds = new Set(current.map((finding) => finding.id));
  const classes: Record<string, ReconcileClass> = {};
  const ledger: LedgerFinding[] = current.map((finding) => {
    const prior = previousById.get(finding.id);
    if (!prior) {
      classes[finding.id] = "new";
      return { ...finding, status: "open" };
    }
    if (prior.status === "closed") {
      classes[finding.id] = "regressed";
      return { ...finding, status: "open" };
    }
    classes[finding.id] = "unchanged";
    return { ...finding, status: prior.status };
  });
  for (const prior of previous) {
    if (currentIds.has(prior.id)) continue;
    if (prior.status !== "closed") classes[prior.id] = "closed";
    ledger.push({ ...prior, status: "closed" });
  }
  ledger.sort((a, b) => a.id.localeCompare(b.id));
  const sortedClasses = Object.fromEntries(
    Object.entries(classes).sort(([a], [b]) => a.localeCompare(b)),
  ) as Record<string, ReconcileClass>;
  return { ledger, classes: sortedClasses, advisory: true as const };
}

export interface CandidateTest {
  findingId: string;
  operatorAccepted: boolean;
  cleanReplay: boolean;
  fixture: string;
  setup: string;
  action: string;
  assertion: string;
  selectors: string[];
  cleanup: string;
  destinationSuite: string;
}

export function stageCandidateTest(candidate: CandidateTest): string {
  if (!candidate.operatorAccepted || !candidate.cleanReplay) {
    throw new Error(
      "candidate tests require an operator-approved, clean-session replay",
    );
  }
  if (!candidate.destinationSuite.endsWith(".test.ts")) {
    throw new Error(
      "candidate destination must name an existing deterministic test suite",
    );
  }
  return `# Candidate deterministic test: ${candidate.findingId}\n\n- Fixture: ${candidate.fixture}\n- Setup: ${candidate.setup}\n- Action: ${candidate.action}\n- Assertion: ${candidate.assertion}\n- Stable selectors: ${candidate.selectors.join(", ")}\n- Cleanup: ${candidate.cleanup}\n- Destination suite: ${candidate.destinationSuite}\n\nAdvisory only. Author and review the Playwright test separately.\n`;
}
