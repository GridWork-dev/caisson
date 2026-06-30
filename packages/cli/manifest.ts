// Registry manifest (ADR-0020). `kind: "base"` — the create-caisson generator is foundational
// tooling (it COMPOSES editions; it is not itself an edition, a compliance primitive, or a per-app
// template). Commercial-licensed (firewall → not AGPL), so the tier⟺license rule forces `paid`;
// `priceCents` is the established pre-launch placeholder anchor (4900) — final pricing is the open
// "Pricing numbers" board fork, out of Wave-0 scope.
import pkg from "./package.json";
import { defineModule } from "@caisson/registry-schema";

export default defineModule({
  id: "@caisson/cli",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 4900,
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
