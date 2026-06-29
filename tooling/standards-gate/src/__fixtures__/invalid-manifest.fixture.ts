// Intentionally INVALID manifest fixture for checkManifestAgreement's fail-closed test. An `oss`
// (open) module carrying a priceCents violates the schema refine, so `defineModule` throws a ZodError
// at import — which the gate must surface as an ERROR, not a warn (ADR-0094/0097). Not a *.test.ts, so
// the runner never executes it as a suite; it is loaded only via the test's dynamic import.
import { defineModule } from "@caisson/registry-schema";

export default defineModule({
  id: "@caisson/fixture-invalid",
  version: "0.0.0",
  kind: "base",
  tier: "oss",
  priceCents: 5,
  license: "Apache-2.0",
  dependencies: [],
  description: "intentionally invalid (oss + price) — must hard-fail the gate.",
});
