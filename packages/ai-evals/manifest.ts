// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ai-evals",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/agent-trajectory"],
  description:
    "Eval harness (defineEval over the matchGolden BLESS discipline) + grader taxonomy (exact / regex / json-shape / schema / model-graded via a Judge port + a fail-closed injection class that can't be loosened) + a regression-vs-committed-baseline gate, deepened with eval-science primitives (ADR-0214): an exit-reason classifier, an opt-in Wilson-CI confidence-floor gate augmentation, a budget-isolated eval-spend ledger, a production judge/human reflexivity queue, and Fleiss-kappa ensemble agreement + counterfactual stability scoring, plus trajectory graders (ADR-0360 U-7) that score a governed agent-runtime tool loop's own event log: tool-choice vs allowlist, unnecessary-call detection, approval compliance, and budget adherence. Offline + deterministic — cassette-replayed judge, live driver injected locally (ADR-0062).",
});
