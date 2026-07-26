// Registry manifest (ADR-0020/0021). Loaded by the monorepo standards gate and kept in lockstep with
// package.json. This is the independently obtained verification half of the audit evidence-pack
// format: it verifies the complete signed file manifest, pack seal, receipt chain, and row-anchor
// signatures. It never signs or exports evidence and is never embedded into a pack.
//
// Commercial bundle substrate, not sold as a separate SKU. Until the operator-gated first publish,
// package.json stays `private:true` and carries no publishConfig; the publish act flips both instead
// of fabricating a registry-ledger row. The placeholder price follows other non-sellable commercial
// primitives; `sellable:false` keeps it outside price-authority/storefront surfaces. Dependency is
// down-only on the open kernel.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/verify-pack",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  sellable: false,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: null,
  stability: "alpha",
  description:
    "Out-of-band verifier for Caisson audit evidence packs: validates the signed complete-file manifest, pack seal, receipt chain, and per-row anchor signatures without trusting executable code from the pack.",
});
