// Registry manifest (ADR-0020/0021). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). This module is
// the buyer trust-page generator: a self-contained static HTML + JSON page — built from an evidence
// pack + its crosswalk rollup through allowlist-based redaction (`@caisson/artifact-render`) — that a
// buyer hosts anywhere to show prospects their compliance posture. Pure, un-wired-seam (ADR-0047):
// no auth, no hosted comments, no sign-off — permanent non-goals, never scaffolded here.
//
// NEVER PUBLISHED, reserved-for-later posture (`package.json` carries `private: true`, the
// `@caisson/license-issue` precedent — a paid-tier manifest with no `publishConfig`): the package
// ships real code and a real manifest, but is deliberately not on the publish/index path yet — not
// appended to `registry/ledger.jsonl`, so it is absent from the served catalog (not displayed on
// apps/site, no purchase path reaches it) until a later pricing round flips it. `sellable: false`
// additionally exempts it from ever needing a PRICE_AUTHORITY row while unpriced; `priceCents` stays
// at the documented pre-launch placeholder anchor (4900). This is NOT the `RESERVED_MODULE_
// ENTITLEMENT_IDS` reservation (that set is for a SOLD-but-unpublished module with a real purchase
// row already granting entitlements — hard-pinned empty; nothing here is sold yet, so nothing is
// added there). Dependencies are DOWN-ONLY (ADR-0003): the generator consumes the evidence-pack shape
// from `@caisson/compliance-core` and renders through `@caisson/artifact-render`, never the reverse.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/trust-page",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  sellable: false,
  license: pkg.license,
  dependencies: [
    "@caisson/artifact-render",
    "@caisson/compliance-core",
    "@caisson/kernel",
  ],
  golden: "src/__golden__",
  stability: "alpha",
  description:
    "Buyer trust-page generator: a self-contained static HTML + JSON page, built from an evidence pack + its crosswalk rollup through allowlist-based redaction, that a buyer hosts anywhere to show prospects their compliance posture.",
});
