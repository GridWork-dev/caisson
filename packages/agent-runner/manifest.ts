// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a governed run primitive, not a base
// service or an edition (a primitive does not self-declare edition membership; the Agentic-Dev
// edition carries it in its `members` pin map, exactly like tool-exec/field-crypto — ADR-0186 F1/F5
// edition-only fold). Paid + LicenseRef-Caisson-Commercial. ADR-0222 later superseded the original
// bundle-only posture by locking a standalone $49 marketplace SKU.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-runner",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  // Standalone $49, locked by ADR-0222 and enforced through PRICE_AUTHORITY.
  priceCents: 4900,
  license: pkg.license,
  // agent-trajectory is a `primitive` too — a primitive depending on another primitive is legal
  // under the down-only rule (never depends "up" on an edition); the standards-gate fixture (T5)
  // asserts this direction (agent-runner → agent-trajectory, never the reverse).
  dependencies: ["@caisson/agent-trajectory", "@caisson/kernel"],
  golden: null,
  description:
    "Sandboxed governed agent runner: spawn a headless agent CLI (provider-agnostic {binary, baseUrlEnv, authEnv, model}) in an isolated worktree with a from-scratch scrubbed env — never spreads process.env — streaming an auditable .jsonl transcript parsed into a structured run report.",
});
