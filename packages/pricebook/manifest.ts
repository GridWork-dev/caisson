// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license/dependencies. `kind: "base"` — @caisson/pricebook is the commerce price-book
// (plan/action books + the shared cents->credits conversion, ADR-0089), composed by services/license
// + the cli codegen-debit path; not an edition, a compliance primitive, or a per-app template.
//
// Commercial under open-core (ADR-0094/0097): the commerce price-book is NOT among the enumerated open
// Base packages (kernel·auth·tenancy-rls·ui·billing·credits·jobs·email·ai-config·mcp-server·
// registry-schema), so it ships LicenseRef-Caisson-Commercial — the license<->tier rule forces `paid`.
// `priceCents` mirrors the pre-launch placeholder anchor (4900, the same @caisson/cli + @caisson/migrate
// carry); FINAL pricing is the still-open Pricing fork (SD-6/ADR-0012), out of scope here — it need
// only be a positive integer (ADR-0007). Deps are DOWN-ONLY (ADR-0003): @caisson/kernel (the credit
// denomination + strict-boundary helpers) and nothing "up".
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/pricebook",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  // The seller's own price catalog — bundle substrate, never sold on its own. Exempts it from the
  // price-coverage locked-price requirement.
  sellable: false,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "The commerce price-book: plan-book (providerPriceId -> creditsPerCycle), action-book (per-action credit cost), and the shared cents->credits grant conversion. Versioned, append-only, fail-closed, integer-only; shares kernel's one credit denomination.",
});
