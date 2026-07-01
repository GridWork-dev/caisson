// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared licensing primitive (offline
// verify only; the issuer is P6), not a base service or an edition. Open Base under the open-core
// model (ADR-0094/0097 + the license-based registry gating ADR-0136, amends ADR-0050): every
// generated app embeds this offline verifier to check its own license, so it ships with each buyer
// and joins the open Apache-2.0 set alongside @caisson/cli + @caisson/migrate — free `oss` tier, no
// `priceCents` (the license⟺tier rule requires oss carry no price). Its only dep is @caisson/kernel
// (Apache-2.0), so the open-only boundary (ADR-0094) holds.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/license-verify",
  version: pkg.version,
  kind: "primitive",
  tier: "oss",
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Offline, fail-safe-to-community license verification: tessera-format wire codec + Ed25519 crypto.verify over kernel-canonical claims (baked-in public key) + strict entitlements/tier/expiry schema (perpetual-per-major).",
});
