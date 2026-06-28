// ADR-0050 uniform-commercial licensing reconcile. The SPDX allowlist collapses to a single
// proprietary license; the AGPL⟺local-ai carve-out (ADR-0023) is retired; the only valid tier is
// `paid` (the `oss` tier is now dead — there is no valid non-commercial license). These cases lock
// the new model and assert the existing field-crypto + cli manifest shapes still validate under it.
//
// The field-crypto/cli manifests live in other packages (outside this package's tsc rootDir), so we
// re-validate faithful mirrors of their inputs through defineModule here rather than importing the
// real files across the package boundary; each package's own build validates the actual artifact.
import { describe, expect, test } from "bun:test";
import {
  SPDX_LICENSES,
  type ModuleManifestInput,
  defineModule,
} from "./module-manifest";

// A Local-first AI edition manifest — the package that USED to be the AGPL flank. Under ADR-0050 it
// is commercial like every other edition. Carries `members` (required for kind=edition, ADR-0077).
const localAiManifest: ModuleManifestInput = {
  id: "@caisson/local-ai",
  version: "0.1.0",
  kind: "edition",
  editions: ["local-ai"],
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/kernel"],
  members: { "@caisson/local-ai": "0.1.0", "@caisson/kernel": "0.1.0" },
  description: "Local-first AI edition — uniform-commercial (ADR-0050).",
};

// Faithful mirrors of the two existing committed manifests (packages/field-crypto/manifest.ts,
// packages/cli/manifest.ts) — they must keep validating under the uniform model.
const fieldCryptoManifest: ModuleManifestInput = {
  id: "@caisson/field-crypto",
  version: "0.0.0",
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Per-tenant authenticated field encryption (HKDF + AES-256-GCM + versioned envelope + Drizzle column + pluggable KMS provider).",
};
const cliManifest: ModuleManifestInput = {
  id: "@caisson/cli",
  version: "0.0.0",
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: ["@caisson/credits", "@caisson/kernel", "@caisson/registry"],
  golden: "src/__golden__",
  description:
    "create-caisson generator: registry-allowlist-gated repo composition + codegen-credit debit-before-spend seam.",
};

describe("ADR-0050 uniform-commercial licensing", () => {
  test("the SPDX allowlist is commercial-only", () => {
    expect([...SPDX_LICENSES]).toEqual(["LicenseRef-Caisson-Commercial"]);
  });

  test("a commercial paid manifest validates", () => {
    const m = defineModule({ ...localAiManifest });
    expect(m.license).toBe("LicenseRef-Caisson-Commercial");
    expect(m.tier).toBe("paid");
  });

  test("a local-ai edition under the commercial license validates (the AGPL carve-out is retired)", () => {
    // Pre-ADR-0050 a local-ai module was REQUIRED to be AGPL; now it MUST be commercial. The dropped
    // refine means commercial-local-ai no longer throws.
    expect(() => defineModule({ ...localAiManifest })).not.toThrow();
  });

  test("an AGPL-3.0-only license is rejected (off the allowlist)", () => {
    expect(() =>
      defineModule({
        ...localAiManifest,
        // @ts-expect-error — AGPL-3.0-only is no longer a member of SPDX_LICENSES (compile + runtime reject)
        license: "AGPL-3.0-only",
      }),
    ).toThrow();
  });

  test("an `oss` tier is rejected (dead — no valid non-commercial license)", () => {
    // `oss` is still in the COMMERCE_TIERS enum (valid TS value) but can never satisfy the
    // tier⟺license refine, so it fails closed at parse time.
    expect(() =>
      defineModule({ ...localAiManifest, tier: "oss", priceCents: null }),
    ).toThrow();
  });

  test("existing field-crypto + cli manifest shapes still validate under the uniform model", () => {
    const fc = defineModule({ ...fieldCryptoManifest });
    expect(fc.license).toBe("LicenseRef-Caisson-Commercial");
    expect(fc.tier).toBe("paid");
    const cli = defineModule({ ...cliManifest });
    expect(cli.license).toBe("LicenseRef-Caisson-Commercial");
    expect(cli.tier).toBe("paid");
  });
});
