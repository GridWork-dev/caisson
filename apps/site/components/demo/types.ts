// Shared contract types for the /demo surface (T2). These mirror the PLAN's FIXED API contract for
// POST /api/demo/run (owned by T1) and the T2↔T3 (excerpts) / T2↔T4 (preview) integration seams.
// Built against the contract, not the sibling tasks' code — they may land after this one.

/** One node of the generated file tree — the response's `tree` (bounded per the contract). */
export interface DemoRunTreeEntry {
  readonly path: string;
  readonly bytes: number;
}

/** Compact per-module line for the run summary (a subset of the CLI's DemoModuleSummary). */
export interface DemoModuleSummaryLine {
  readonly id: string;
  readonly tier: "oss" | "paid";
  readonly description: string;
}

/**
 * `200` body of POST /api/demo/run (FIXED contract). `moduleSummary` is optional + only rendered
 * when it arrives as an array, so a shape drift from T1 degrades instead of crashing the client.
 */
export interface DemoRunResult {
  readonly runId: string;
  readonly tree: readonly DemoRunTreeEntry[];
  readonly files: Readonly<Record<string, string>>;
  readonly moduleSummary?: readonly DemoModuleSummaryLine[];
  readonly generatedInMs: number;
}

/** The `503 { reason }` discriminator — F5 daily cap tripped or the kill switch is off. */
export type DemoRunUnavailableReason = "daily-cap" | "disabled";

/**
 * One curated commercial-source excerpt (T3's append-only manifest, `@/lib/demo-excerpts`). Only the
 * fields this read-only viewer needs are pinned here; T3 carries the full record (sourceCommit,
 * approvedBy, licensePosture, …). Rendered verbatim, never executed.
 */
export interface DemoExcerpt {
  readonly id: string;
  readonly title: string;
  readonly sourcePath: string;
  readonly content: string;
  readonly sourceCommit?: string;
  readonly licensePosture?: string;
}
