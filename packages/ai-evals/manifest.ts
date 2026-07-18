// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared AI-production primitive (the eval
// harness + grader taxonomy + regression-vs-committed-baseline gate the AI Production Kit gates
// prompt/agent quality through), not a base service or an edition. Paid + LicenseRef-Caisson-
// Commercial (ADR-0050). `golden` points at `__evals__` — the committed baseline + case fixtures are
// this module's golden artifacts (ADR-0013).
// `dependencies` carries ONE runtime entry as of ADR-0360 U-7 (S4, trajectory evals):
// `@caisson/agent-trajectory`, the source of the projection TYPES + pure fold functions
// (`project`/`projectToolCalls`) the new trajectory graders score against. Still
// primitive->primitive (precedented by `@caisson/ai-meter` -> `@caisson/tenancy-rls`), still
// down-only (ADR-0003), and still offline: agent-trajectory carries no store/network dependency of
// its own on this path — grading model calls stay injected behind the Judge port exactly as before.
// `priceCents` is a PLACEHOLDER pending the Pricing lock (a positive integer is required to validate;
// the number is not the locked price).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ai-evals",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/agent-trajectory"],
  golden: "__evals__",
  description:
    "Eval harness (defineEval over the matchGolden BLESS discipline) + grader taxonomy (exact / regex / json-shape / schema / model-graded via a Judge port + a fail-closed injection class that can't be loosened) + a regression-vs-committed-baseline gate, deepened with eval-science primitives (ADR-0214): an exit-reason classifier, an opt-in Wilson-CI confidence-floor gate augmentation, a budget-isolated eval-spend ledger, a production judge/human reflexivity queue, and Fleiss-kappa ensemble agreement + counterfactual stability scoring, plus trajectory graders (ADR-0360 U-7) that score a governed agent-runtime tool loop's own event log: tool-choice vs allowlist, unnecessary-call detection, approval compliance, and budget adherence. Offline + deterministic — cassette-replayed judge, live driver injected locally (ADR-0062).",
});
