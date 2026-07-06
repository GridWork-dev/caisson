// apps/agent-dev/src/index.ts — the runnable CLI entrypoint for the agent-dev edition reference app.
// Importing this module is side-effect free (the run is gated behind `import.meta.main`),
// so the exit test imports `runAgentDevDemo` from here without launching the CLI. Output goes through
// `process.stdout.write` (never `console`) so the no-console product-code floor holds in `src/`.
//
// ADR-0044 CLI exception: edition reference apps standardize on Next.js, but this app is a KERNEL
// DEMO, not a web page — a governed tamper-evident lifecycle + offline retrieval + a multi-harness
// emit is an inherently headless flow. A read-only, localhost-only inspector over the audited
// record has since SHIPPED (local-dev only) at `./inspector.ts`, under a second narrow ADR-0044
// deviation (ADR-0243) — see `apps/agent-dev/README.md`.
export * from "./demo.ts";
export * from "./runner-demo.ts";

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentDevDemoReport } from "./demo.ts";
import { runAgentDevDemo } from "./demo.ts";

/** A short human-readable block summarizing one reference run. */
function formatReport(report: AgentDevDemoReport): string {
  return [
    "caisson agent-dev — governed lifecycle reference run",
    `  lifecycle    : ${report.lifecyclePath.join(" → ")}`,
    `  recorded     : ${report.recordedSteps} governed transition(s) chained`,
    `  anchor       : len=${report.anchor.length} tip=${report.anchor.tipHash.slice(0, 12)}…`,
    `  tamper-check : verifyChain(anchor) = ${report.verified ? "valid" : "BROKEN"}`,
    `  memory       : ${report.retrieval} → ${report.memoryHits.length} hit(s) [${report.memoryHits.join(", ")}]`,
    `  emitted      : ${report.emitted.length} harness file(s)`,
    ...report.emitted.map((path) => `    - ${path}`),
    "",
  ].join("\n");
}

if (import.meta.main) {
  const targetRoot =
    process.argv[2] ?? mkdtempSync(join(tmpdir(), "caisson-agent-dev-"));
  const report = await runAgentDevDemo({ targetRoot });
  process.stdout.write(formatReport(report));
}
