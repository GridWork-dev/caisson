// Registry manifest (ADR-0020). `kind: "base"` — the create-caisson generator is foundational
// tooling (it COMPOSES editions; it is not itself an edition, a compliance primitive, or a per-app
// template). Open Base under the open-core model (ADR-0094/0097 + the license-based registry gating
// ADR-0136): the generator ships with EVERY buyer's repo, so it joins the open Apache-2.0 set
// alongside @caisson/migrate + @caisson/license-verify — free `oss` tier, no `priceCents` (the
// license⟺tier rule requires oss carry no price). The open Base must resolve against open deps only
// (ADR-0094): credits·kernel·migrate·registry-schema are all Apache-2.0.
import pkg from "./package.json";
import { defineModule } from "@caisson/registry-schema";

export default defineModule({
  id: "@caisson/cli",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  license: pkg.license,
  dependencies: [
    "@caisson/credits",
    "@caisson/kernel",
    "@caisson/migrate",
    "@caisson/registry-schema",
  ],
  golden: "src/__golden__",
  description:
    "create-caisson generator: registry-allowlist-gated repo composition + codegen-credit debit-before-spend seam.",
});
