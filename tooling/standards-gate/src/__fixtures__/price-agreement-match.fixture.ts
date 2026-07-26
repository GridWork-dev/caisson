// Fixture for checkManifestPriceAgreement: priceCents matches the PRICE_AUTHORITY lock for
// @caisson/compliance (164900, the 2026-07-25 OSCAL reprice). Not a *.test.ts, so the
// runner never executes it as a suite; it is loaded only via the test's dynamic import.
import { defineModule } from "@caisson/registry-schema";

export default defineModule({
  id: "@caisson/compliance",
  version: "0.0.0",
  kind: "primitive",
  tier: "paid",
  priceCents: 164900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [],
  description: "fixture — priceCents agrees with the locked bundle price.",
});
