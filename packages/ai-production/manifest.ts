// Registry manifest (ADR-0020/0021/0257). Loaded by @caisson/standards-gate; must agree with
// package.json on id/version/license/dependencies. `kind: "bundle"` — the AI-Production persona bundle
// (ADR-0257), the new-vocabulary successor to the legacy `ai-kit` edition (which stays valid forever;
// `ai-kit` aliases to `ai-production` at the single resolve-time alias point). A bundle carries NO
// composition code of its own — only the frozen `members` pin map that expands to its member modules
// (ADR-0077/0071) — so `dependencies` stays empty. Members = the ai-kit edition's modules PLUS the
// ai-evals fold-in (its standaloneOnly flag drops, ADR-0258) with credits kept (ADR-0258 §2 recompute).
// `priceCents: 73900` is the locked bundle price ($739, ADR-0258 §2); positive integer (ADR-0007).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ai-production",
  version: pkg.version,
  kind: "bundle",
  tier: "paid",
  priceCents: 73900,
  license: pkg.license,
  // Frozen member pin map (ADR-0077/0257): the bundle self + every member module, exact-version. Base
  // members (kernel, tenancy-rls, ai-config) mirror the edition composition; ai-evals is the fold-in.
  members: {
    "@caisson/ai-production": "0.2.1",
    "@caisson/ai-config": "0.3.2",
    "@caisson/ai-meter": "1.0.3",
    "@caisson/credits": "0.5.3",
    "@caisson/field-crypto": "0.3.2",
    "@caisson/guardrails": "0.4.4",
    "@caisson/kernel": "0.5.0",
    "@caisson/prompt-registry": "1.0.1",
    "@caisson/tenancy-rls": "0.5.2",
    "@caisson/ai-evals": "0.3.3",
  },
  description:
    "AI-Production bundle: the metered infer() gateway composing @caisson/prompt-registry + @caisson/ai-meter + @caisson/guardrails + @caisson/ai-config behind the Vercel AI SDK, with the @caisson/ai-evals CI eval harness folded in and the @caisson/credits metering ledger — the enforced chokepoint for every AI feature.",
});
