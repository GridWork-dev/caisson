// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared licensing primitive (offline
// verify only; the issuer is P6), not a base service or an edition. Paid + LicenseRef-Caisson-
// Commercial under the open-core model (ADR-0094/0097, amends ADR-0050); `priceCents` is the established
// pre-launch placeholder anchor (4900) — final pricing is the open "Pricing numbers" board fork.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/license-verify",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Offline, fail-safe-to-community license verification: tessera-format wire codec + Ed25519 crypto.verify over kernel-canonical claims (baked-in public key) + strict entitlements/tier/expiry schema (perpetual-per-major).",
});
