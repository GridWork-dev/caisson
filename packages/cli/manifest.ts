// Registry manifest (ADR-0020). `kind: "base"` — the create-caisson generator is foundational
// tooling (it COMPOSES editions; it is not itself an edition, a compliance primitive, or a per-app
// template). Commercial-licensed (firewall → not AGPL), so the tier⟺license rule forces `paid`;
// `priceCents` is the established pre-launch placeholder anchor (4900) — final pricing is the open
// "Pricing numbers" board fork, out of Wave-0 scope.
import { defineModule } from "@caisson/registry";

export default defineModule({
  id: "@caisson/cli",
  version: "0.0.0",
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/credits", "@caisson/kernel", "@caisson/registry"],
  golden: "src/__golden__",
  description:
    "create-caisson generator: registry-allowlist-gated repo composition + codegen-credit debit-before-spend seam.",
});
