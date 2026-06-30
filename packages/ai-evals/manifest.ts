// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared AI-production primitive (the eval
// harness + grader taxonomy + regression-vs-committed-baseline gate the AI Production Kit gates
// prompt/agent quality through), not a base service or an edition. Paid + LicenseRef-Caisson-
// Commercial (ADR-0050). `dependencies` is empty: the harness is pure + offline (no @caisson runtime
// dep), grading model calls are injected behind the Judge port. `golden` points at `__evals__` — the
// committed baseline + case fixtures are this module's golden artifacts (ADR-0013, landed at T10).
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
  dependencies: [],
  golden: "__evals__",
  description:
    "Eval harness (defineEval over the matchGolden BLESS discipline) + grader taxonomy (exact / regex / json-shape / schema / model-graded via a Judge port + a fail-closed injection class that can't be loosened) + a regression-vs-committed-baseline gate. Offline + deterministic — cassette-replayed judge, live driver injected locally (ADR-0062).",
});
