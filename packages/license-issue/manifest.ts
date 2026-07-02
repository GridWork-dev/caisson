// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — the licensing PRIVATE signer primitive (the
// issuer; the public counterpart @caisson/license-verify holds offline verify). `private: true` in
// package.json keeps it OUT of every published tarball — the signing key never reaches a buyer repo —
// but it is still a `packages/` member, so it carries the same commercial declaration the gate enforces:
// `paid` + `LicenseRef-Caisson-Commercial` (ADR-0094/0097 open-core split — issuer is commercial, NOT
// open Base). `priceCents` mirrors @caisson/license-verify's pre-launch placeholder anchor (4900);
// final pricing is the open "Pricing numbers" board fork. ADR-0110.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/license-issue",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/kernel", "@caisson/license-verify"],
  golden: "src/__golden__",
  description:
    "Ed25519 offline-license issuer (private): signs canonicalize(parse(claims)) into a tessera-format token with a Signer port (default Ed25519Signer over a node:crypto PKCS8 env key; KMS un-wired seam). Byte-identical to @caisson/license-verify's re-derivation; never published.",
});
