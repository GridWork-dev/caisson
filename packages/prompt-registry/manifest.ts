// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared AI-production primitive (the
// versioned, injection-safe prompt store the AI Production Kit gateway resolves through), not a base
// service or an edition. Paid + LicenseRef-Caisson-Commercial (ADR-0050). Standalone pricing is
// locked at $99 by ADR-0129 and enforced through PRICE_AUTHORITY.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/prompt-registry",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 9900,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/tenancy-rls", "@caisson/ui"],
  golden: "src/__golden__",
  description:
    "Append-only versioned prompts + name@version / name@alias addressing + a mutable alias pointer + injection-safe templating (ADR-0061).",
});
