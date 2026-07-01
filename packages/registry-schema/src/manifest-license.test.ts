// ADR-0094 open-core licensing reconcile (amends the ADR-0050 uniform-commercial model). The SPDX
// allowlist carries two licenses: the open Base ships `Apache-2.0` at the free `oss` tier; everything
// commercial ships `LicenseRef-Caisson-Commercial` at the `paid` tier. The license⟺tier refine pins
// the split both ways. The AGPL boundary stays a dormant tripwire (no copyleft on the allowlist).
//
// The base/edition manifests live in other packages (outside this package's tsc rootDir), so we
// re-validate faithful mirrors of their inputs through defineModule here rather than importing the
// real files across the package boundary; each package's own build validates the actual artifact.
import { describe, expect, test } from "bun:test";
import {
  SPDX_LICENSES,
  type ModuleManifestInput,
  defineModule,
} from "./module-manifest";

// An open-Base manifest (the ADR-0094 shape: Apache-2.0 + oss + no price). Mirrors e.g. kernel.
const openBaseManifest: ModuleManifestInput = {
  id: "@caisson/kernel",
  version: "0.0.0",
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: "Apache-2.0",
  dependencies: [],
  description: "Governance kernel — open Base, Apache-2.0 (ADR-0094).",
};

// A commercial edition manifest (paid + LicenseRef-Caisson-Commercial). Carries `members` (required
// for kind=edition, ADR-0077).
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
  description: "Local-first AI edition — commercial (ADR-0050/0083).",
};

// Faithful mirrors of two committed manifests: field-crypto stays a commercial primitive
// (packages/field-crypto/manifest.ts), cli is now open Apache-2.0 Base (packages/cli/manifest.ts,
// flipped by ADR-0136 — the ships-with-generator tooling trio) — both must keep validating under the
// open-core model, on opposite sides of the license⟺tier split.
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
  tier: "oss",
  priceCents: null,
  license: "Apache-2.0",
  dependencies: [
    "@caisson/credits",
    "@caisson/kernel",
    "@caisson/migrate",
    "@caisson/registry-schema",
  ],
  golden: "src/__golden__",
  description:
    "create-caisson generator: registry-allowlist-gated repo composition + codegen-credit debit-before-spend seam.",
};

describe("ADR-0094 open-core licensing", () => {
  test("the SPDX allowlist is the open-core pair (commercial + Apache-2.0)", () => {
    expect([...SPDX_LICENSES]).toEqual([
      "LicenseRef-Caisson-Commercial",
      "Apache-2.0",
    ]);
  });

  test("an open-Base Apache-2.0 / oss manifest validates", () => {
    const m = defineModule({ ...openBaseManifest });
    expect(m.license).toBe("Apache-2.0");
    expect(m.tier).toBe("oss");
    expect(m.priceCents).toBeNull();
  });

  test("a commercial paid manifest validates", () => {
    const m = defineModule({ ...localAiManifest });
    expect(m.license).toBe("LicenseRef-Caisson-Commercial");
    expect(m.tier).toBe("paid");
  });

  test("Apache-2.0 with tier `paid` is rejected (license⟺tier, ADR-0094)", () => {
    expect(() =>
      defineModule({ ...openBaseManifest, tier: "paid", priceCents: 4900 }),
    ).toThrow();
  });

  test("Apache-2.0 / oss with a priceCents is rejected (oss carries no price)", () => {
    expect(() =>
      defineModule({ ...openBaseManifest, priceCents: 4900 }),
    ).toThrow();
  });

  test("commercial with tier `oss` is rejected (commercial ⟺ paid)", () => {
    expect(() =>
      defineModule({ ...localAiManifest, tier: "oss", priceCents: null }),
    ).toThrow();
  });

  test("an AGPL-3.0-only license is rejected (off the allowlist — copyleft tripwire)", () => {
    expect(() =>
      defineModule({
        ...localAiManifest,
        // @ts-expect-error — AGPL-3.0-only is not a member of SPDX_LICENSES (compile + runtime reject)
        license: "AGPL-3.0-only",
      }),
    ).toThrow();
  });

  test("the committed field-crypto (commercial) + cli (open Base) manifest shapes both validate", () => {
    const fc = defineModule({ ...fieldCryptoManifest });
    expect(fc.license).toBe("LicenseRef-Caisson-Commercial");
    expect(fc.tier).toBe("paid");
    // cli is open Apache-2.0 Base as of ADR-0136 (ships-with-generator tooling) — oss tier, no price.
    const cli = defineModule({ ...cliManifest });
    expect(cli.license).toBe("Apache-2.0");
    expect(cli.tier).toBe("oss");
    expect(cli.priceCents).toBeNull();
  });
});
