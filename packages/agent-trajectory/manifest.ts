// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license/dependencies. `kind: "primitive"` — @caisson/agent-trajectory is the
// engine-neutral trajectory contract (append-only run/step/tool/usage event log + deterministic
// projection), a governed observation substrate, not a base service or an edition. A primitive does
// not self-declare edition membership; a bundle would add it to its `members` pin map at integration,
// exactly like tool-exec — and it deliberately is NOT added to any bundle member map yet
// (reserved-id/unpublished; publish rides LAST behind the loop slice).
//
// Commercial under open-core (ADR-0094/0097): the runtime observation layer is NOT among the
// enumerated open Base packages, so it ships LicenseRef-Caisson-Commercial and the license<->tier
// rule forces `paid`. `priceCents` mirrors the pre-launch placeholder anchor (4900) the other
// commercial primitives carry; FINAL pricing is the still-open Pricing fork (SD-6/ADR-0012), out of
// scope here — it need only be a positive integer (ADR-0007). Deps are DOWN-ONLY (ADR-0003):
// @caisson/kernel (parseStrict + the typed error model) and nothing "up". `golden: null` — the
// package emits no golden-able artifact; its teeth are the schema/append-only/replay tests.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/agent-trajectory",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  // Runtime substrate, not sold on its own yet — reserved/unpublished until the loop slice lands.
  // Exempts it from the price-coverage locked-price requirement.
  sellable: false,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: null,
  description:
    "Engine-neutral trajectory contract: an append-only, replayable event log (runs, steps, model calls, tool proposals/approvals, usage, checkpoints) with digest-ref payload discipline (sensitive bodies referenced by sha256 digest, never inlined) and a deterministic projection over shuffled arrival.",
});
