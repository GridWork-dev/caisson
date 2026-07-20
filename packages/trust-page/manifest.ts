// Registry manifest (ADR-0020/0021). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies (the gate fails the build on drift). This module is
// the buyer trust-page generator: a self-contained static HTML + JSON page — built from an evidence
// pack + its crosswalk rollup through allowlist-based redaction (`@caisson/artifact-render`) — that a
// buyer hosts anywhere to show prospects their compliance posture. Pure, un-wired-seam (ADR-0047):
// no auth, no hosted comments, no sign-off — permanent non-goals, never scaffolded here.
//
// SKU posture: PUBLISH-ARMED at the 2026-07-20 pricing round (price locked at $149, Compliance
// membership locked) — this cut publishes as `sellable: false` substrate; the post-publish flip
// sets `sellable`/`priceCents` and the bundle members maps pin the version this cut publishes.
// Dependencies are DOWN-ONLY (ADR-0003): the generator consumes the evidence-pack shape
// from `@caisson/compliance-core` and renders through `@caisson/artifact-render`, never the reverse.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/trust-page",
  version: pkg.version,
  kind: "primitive",
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
