// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license and the @caisson/* dependency set. `kind: "edition"` (the AI Production Kit
// edition) — it declares its own `editions: ["ai-kit"]` membership and composes base primitives,
// never another edition (down-only, ADR-0003). Paid + LicenseRef-Caisson-Commercial (ADR-0050).
// `priceCents` is a PLACEHOLDER pending the Pricing lock (a positive integer is required to
// validate; the number is not the locked price). The provider-SDK dependency (`ai` + `@ai-sdk/*`,
// Apache-2.0) is the Gate-2 carve-out (ADR-0011/0022); it is not a workspace dep so it does not
// appear here.
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ai-kit",
  version: "0.0.0",
  kind: "edition",
  editions: ["ai-kit"],
  tier: "paid",
  priceCents: 49900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [
    "@caisson/ai-config",
    "@caisson/ai-meter",
    "@caisson/credits",
    "@caisson/guardrails",
    "@caisson/kernel",
    "@caisson/prompt-registry",
    "@caisson/tenancy-rls",
  ],
  // Frozen member pin map (ADR-0077): edition self + every bundled dependency, exact-version.
  members: {
    "@caisson/ai-kit": "0.0.0",
    "@caisson/ai-config": "0.0.0",
    "@caisson/ai-meter": "0.0.0",
    "@caisson/credits": "0.0.0",
    "@caisson/guardrails": "0.0.0",
    "@caisson/kernel": "0.0.0",
    "@caisson/prompt-registry": "0.0.0",
    "@caisson/tenancy-rls": "0.0.0",
  },
  description:
    "AI Production Kit edition: the metered infer() gateway composing prompt-registry + ai-meter + guardrails + ai-config behind Vercel AI SDK v5 — the enforced chokepoint for every AI feature (ADR-0059).",
});
