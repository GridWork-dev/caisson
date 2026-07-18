// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license and the @caisson/* dependency set. `kind: "edition"` (the AI Production Kit
// edition) — it declares its own `editions: ["ai-kit"]` membership and composes base primitives,
// never another edition (down-only, ADR-0003). Paid + LicenseRef-Caisson-Commercial (ADR-0050).
// `priceCents: 73900` is the locked AI-Production bundle price ($739, ADR-0258 §2) — this retired
// legacy id aliases to `ai-production` forever (ADR-0257 single alias point) and carries its alias
// target's price, the same truing convention `local-ai` uses. Behavior unchanged: the id keeps
// resolving via the alias map. The provider-SDK dependency (`ai` + `@ai-sdk/*`,
// Apache-2.0 — incl. `@ai-sdk/openai-compatible`, the ADR-0201 chat-completions transport) is the
// sanctioned carve-out (ADR-0011/0022); it is not a workspace dep so it does not appear here (the
// `dependencies` schema is @caisson-module-ids only; the gate mirrors package.json's @caisson set).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ai-kit",
  version: pkg.version,
  kind: "edition",
  editions: ["ai-kit"],
  tier: "paid",
  priceCents: 73900,
  license: pkg.license,
  dependencies: [
    "@caisson/agent-trajectory",
    "@caisson/ai-config",
    "@caisson/ai-meter",
    "@caisson/credits",
    "@caisson/field-crypto",
    "@caisson/guardrails",
    "@caisson/jobs",
    "@caisson/kernel",
    "@caisson/prompt-registry",
    "@caisson/tenancy-rls",
  ],
  // Frozen member pin map (ADR-0077): edition self + every bundled dependency, exact-version.
  // `@caisson/jobs` joins here with S3 (ADR-0360 U-3): approveToolCall enqueues the resume job
  // through it — open (Apache-2.0) primitive, no open-core boundary issue (ADR-0094/0097).
  members: {
    "@caisson/ai-kit": "0.4.0",
    "@caisson/ai-config": "0.3.0",
    "@caisson/ai-meter": "0.3.4",
    "@caisson/credits": "0.4.1",
    "@caisson/field-crypto": "0.3.0",
    "@caisson/guardrails": "0.4.2",
    "@caisson/jobs": "0.5.1",
    "@caisson/kernel": "0.4.2",
    "@caisson/prompt-registry": "0.2.5",
    "@caisson/tenancy-rls": "0.5.0",
  },
  description:
    "AI Production Kit edition: the metered infer() gateway composing prompt-registry + ai-meter + guardrails + ai-config behind Vercel AI SDK v7 — the enforced chokepoint for every AI feature (ADR-0059).",
});
