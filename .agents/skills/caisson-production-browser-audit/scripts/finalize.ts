import {
  reconcileFindings,
  type CurrentFinding,
  type LedgerFinding,
} from "./reconcile";
import type { MutationJournal } from "./journal";

export interface AuditFork {
  title: string;
  evidence: string;
  options: string[];
  recommendation: string;
}

export interface FinalizeInput {
  runId: string;
  findings: CurrentFinding[];
  previousFindings: LedgerFinding[];
  journal: MutationJournal;
  forks: AuditFork[];
}

export type AuditBundle = Record<
  "REPORT.md" | "findings.json" | "mutation-journal.json" | "forks.md",
  string
>;

function renderForks(forks: AuditFork[]): string {
  if (forks.length === 0) return "# Design forks\n\nNone.\n";
  return `# Design forks\n\n${forks
    .map(
      (fork) =>
        `## ${fork.title}\n\nEvidence: ${fork.evidence}\n\n${fork.options
          .map((option, index) => `${index + 1}. ${option}`)
          .join("\n")}\n\nRecommendation: ${fork.recommendation}\n`,
    )
    .join("\n")}`;
}

export function finalizeBundle(input: FinalizeInput): AuditBundle {
  if (input.journal.mutationLock) {
    throw new Error(
      "cannot finalize while mutation_lock is true; preserve P0 cleanup state",
    );
  }
  if (input.journal.entries.some((entry) => entry.state !== "verified")) {
    throw new Error("cannot finalize with an unresolved mutation journal");
  }
  const reconciled = reconcileFindings(input.previousFindings, input.findings);
  const report = `# Caisson production browser audit — ${input.runId}\n\n**Advisory:** this report does not gate CI and does not promote Playwright tests.\n\n## Outcome\n\n- Findings: ${input.findings.length}\n- Cleanup: verified; no mutation lock\n- Candidate tests: require operator acceptance and separate implementation\n`;
  return {
    "REPORT.md": report,
    "findings.json": `${JSON.stringify(reconciled, null, 2)}\n`,
    "mutation-journal.json": `${JSON.stringify(input.journal, null, 2)}\n`,
    "forks.md": renderForks(input.forks),
  };
}
