// Registry manifest (ADR-0020/0021). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). This module is
// the evidence-signing carve out of the Compliance edition (ADR-0246/0257): the per-tenant Ed25519
// signer plus RFC-3161 countersign surface, distinct by design from the Caisson license-issuer key
// (ADR-0056 trust model — a buyer proves provenance of their OWN evidence with their OWN identity).
//
// `priceCents: 19900` is the locked standalone price for this carve ($199, ADR-0252); it must stay a
// positive integer (ADR-0007). Dependencies are DOWN-ONLY (ADR-0003): the signer sits on the kernel's
// canonicalize/compare floor plus the shared Ed25519 primitive — the Compliance edition composes it,
// never the reverse. The dev-only test dependency on the evidence engine does not ship.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/signing-primitive",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 19900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  stability: "alpha",
  description:
    "Per-tenant evidence signing: detached Ed25519 signatures over a canonical, chain-anchored manifest body, with an optional RFC-3161 trusted-timestamp countersignature and a fail-closed verify path.",
});
