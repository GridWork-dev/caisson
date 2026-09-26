// Intentionally INVALID manifest fixture for checkManifestAgreement's fail-closed test. A version
// that is not semver violates the schema, so `defineModule` throws a ZodError at import — which the
// gate must surface as an ERROR, not a warn. Not a *.test.ts, so the runner never executes it as a
// suite; it is loaded only via the test's dynamic import.
import { defineModule } from "@caisson/registry-schema";

export default defineModule({
  id: "@caisson/fixture-invalid",
  version: "not-semver",
  license: "Apache-2.0",
  dependencies: [],
  description:
    "intentionally invalid (non-semver version) — must hard-fail the gate.",
});
