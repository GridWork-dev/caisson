// Shared contract type for the /demo excerpts seam (T2↔T3).

/**
 * One curated module-source excerpt (T3's append-only manifest, `@/lib/demo-excerpts`). Only the
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
