// Fixture for checkManifestPriceAgreement: priceCents is a STALE number that has drifted from the
// PRICE_AUTHORITY lock for @caisson/compliance (144900, the 2026-07-20 reprice) — the gate must
// fail this. Not a *.test.ts, so the runner never executes it as a suite; it is loaded only via
// the test's dynamic import.
import { defineModule } from "@caisson/registry-schema";

export default defineModule({
  id: "@caisson/compliance",
  version: "0.0.0",
  kind: "primitive",
  tier: "paid",
  priceCents: 99900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [],
  description:
    "fixture — priceCents has drifted from the locked ADR-0227 price.",
});
