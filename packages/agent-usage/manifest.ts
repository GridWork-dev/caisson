// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license/dependencies. `kind: "primitive"` — @caisson/agent-usage hosts the AR-3
// usage adapters (price normalization + the Codex rollout scanner) that upgrade agent-trajectory's
// `estimated` model.usage events to pricebook-computed `priced` credits (ADR-0360 U-4). A primitive
// does not self-declare edition membership; a bundle would add it to its `members` pin map at
// integration — it deliberately is NOT added to any bundle member map yet (reserved-id/unpublished;
// publish rides LAST behind the loop slice, exactly as agent-trajectory did).
//
// Commercial under open-core (ADR-0094/0097): the runtime observation layer is NOT among the
// enumerated open Base packages, so it ships LicenseRef-Caisson-Commercial and the license<->tier
// rule forces `paid`. `priceCents` mirrors the pre-launch placeholder anchor (4900) the other
// commercial runtime primitives carry; FINAL pricing is the still-open Pricing fork (SD-6/ADR-0012),
// out of scope here — it need only be a positive integer (ADR-0007). Deps are primitive->primitive
// (agent-trajectory, ai-meter) plus kernel — never "up" onto an edition (ADR-0003; precedented by
// ai-meter itself, which already depends on other base primitives). `golden: null` — the package
// emits no golden-able artifact; its teeth are the alias/normalize/adapter test suites.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-usage",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  // Runtime substrate, not sold on its own yet — reserved/unpublished until the loop slice lands.
  // Exempts it from the price-coverage locked-price requirement.
  sellable: false,
  license: pkg.license,
  dependencies: [
    "@caisson/agent-trajectory",
    "@caisson/ai-meter",
    "@caisson/kernel",
  ],
  golden: null,
  description:
    "Usage adapters for the agent-trajectory contract: a Codex rollout scanner (honesty-gated model/provider latching, delta-based token counts, reasoning-token discipline) and a price-normalization pass that upgrades adapter-estimated model.usage events to pricebook-computed priced credits via a dated-model-id alias map.",
});
