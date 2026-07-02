// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a governed run primitive, not a base
// service or an edition (a primitive does not self-declare edition membership; the Agentic-Dev
// edition carries it in its `members` pin map, exactly like tool-exec/field-crypto — ADR-0186 F1/F5
// edition-only fold). Paid + LicenseRef-Caisson-Commercial; NO standalone SKU (ADR-0186 F5 per
// ADR-0137 below-sum economics), so priceCents stays the established pre-launch placeholder.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-runner",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  // PLACEHOLDER anchor (ADR-0129 methodology); positive int required by the manifest refine
  // (ADR-0007). Sold only via the Agentic-Dev edition fold (ADR-0186 F5).
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: null,
  description:
    "Sandboxed governed agent runner: spawn a headless agent CLI (provider-agnostic {binary, baseUrlEnv, authEnv, model}) in an isolated worktree with a from-scratch scrubbed env — never spreads process.env — streaming an auditable .jsonl transcript parsed into a structured run report.",
});
