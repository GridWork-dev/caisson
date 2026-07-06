// ADR-0077 edition member-version pin map. The `members` field added to ModuleManifest
// enforces that `kind === "edition"` carries a non-empty EXACT-version pin map; ranges and `latest`
// are rejected by the shared `semver` regex; the representative golden fixture round-trips.
//
// Contract: an edition WITHOUT members throws; a range/`latest` member version is rejected at
// the Zod boundary; the golden fixture parses and matches the committed shape (ADR-0013). A non-
// edition module may omit `members` (defaults to {} — no refine fires for non-editions).
import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson/testing";
import { type ModuleManifestInput, defineModule } from "./module-manifest";

// Representative edition input carrying a non-empty members pin map (ADR-0077).
const representativeEdition: ModuleManifestInput = {
  id: "@caisson/compliance",
  version: "0.1.0",
  kind: "edition",
  editions: ["compliance"],
  tier: "paid",
  priceCents: 99900,
  license: "LicenseRef-Caisson-Commercial",
  dependencies: [
    "@caisson/audit-worm",
    "@caisson/field-crypto",
    "@caisson/tenancy-rls",
    "@caisson/kernel",
  ],
  members: {
    "@caisson/compliance": "0.1.0",
    "@caisson/audit-worm": "0.1.0",
    "@caisson/field-crypto": "0.1.0",
    "@caisson/tenancy-rls": "0.1.0",
    "@caisson/kernel": "0.1.0",
  },
  golden: "src/__golden__",
  description:
    "Representative compliance edition fixture — ADR-0077 member-version pin map (golden).",
};

describe("ADR-0077 edition member-version pin map", () => {
  test("the golden parses and the full defaulted manifest matches the committed fixture", () => {
    const produced = defineModule({ ...representativeEdition });
    matchGolden(import.meta.url, "edition-manifest-pins", produced);
  });

  test("an edition WITHOUT members throws (non-empty required, ADR-0077)", () => {
    // Omitting `members` causes Zod to default it to {}; the refine then rejects.
    expect(() =>
      defineModule({
        ...representativeEdition,
        members: {},
      }),
    ).toThrow(/non-empty members pin map/);
  });

  test("a range member version is rejected (semver regex, exact-only)", () => {
    // `^1.0.0` is a range (caret), not an exact semver — must be rejected at the Zod boundary.
    expect(() =>
      defineModule({
        ...representativeEdition,
        members: { "@caisson/compliance": "^1.0.0" },
      }),
    ).toThrow();
  });

  test("a `latest` member version is rejected (semver regex)", () => {
    // `latest` is not a semver string and must never appear in a pin map (ADR-0077).
    expect(() =>
      defineModule({
        ...representativeEdition,
        members: { "@caisson/compliance": "latest" },
      }),
    ).toThrow();
  });

  test("a bundle-kind manifest requires a non-empty members pin map too (ADR-0257)", () => {
    // The ADR-0257 bundle kind composes exactly like an edition: members required, exact pins.
    // It does NOT declare `editions[]` — the bundle id is the module-id slug.
    const bundleInput: ModuleManifestInput = {
      id: "@caisson/provenance",
      version: "0.1.0",
      kind: "bundle",
      tier: "paid",
      priceCents: 39900,
      license: "LicenseRef-Caisson-Commercial",
      members: {
        "@caisson/audit-worm": "0.1.0",
        "@caisson/field-crypto": "0.1.0",
      },
      description: "Provenance bundle fixture (ADR-0257 members pin map).",
    };
    const m = defineModule({ ...bundleInput });
    expect(m.kind).toBe("bundle");
    expect(m.editions).toEqual([]);
    expect(() => defineModule({ ...bundleInput, members: {} })).toThrow(
      /non-empty members pin map/,
    );
    expect(() =>
      defineModule({
        ...bundleInput,
        members: { "@caisson/audit-worm": "latest" },
      }),
    ).toThrow();
  });

  test("sellable is additive/optional — an omitting manifest stays valid and absent from the output (ADR-0257)", () => {
    const m = defineModule({
      id: "@caisson/kernel",
      version: "0.0.0",
      kind: "base",
      tier: "paid",
      priceCents: 4900,
      license: "LicenseRef-Caisson-Commercial",
      description: "Governance kernel (fixture — sellable omitted).",
    });
    // No `.default(true)`: an omitting manifest carries no `sellable` key at all (so the golden
    // manifest snapshots don't churn); the price-coverage gate reads absence as sellable.
    expect("sellable" in m).toBe(false);
  });

  test("sellable: false is accepted (bundle-only substrate declaration)", () => {
    const m = defineModule({
      id: "@caisson/platform-reads",
      version: "0.0.0",
      kind: "base",
      tier: "paid",
      priceCents: 4900,
      sellable: false,
      license: "LicenseRef-Caisson-Commercial",
      description: "Bundle-only substrate (fixture — sellable false).",
    });
    expect(m.sellable).toBe(false);
  });

  test("sellable rejects a non-boolean (still .strict())", () => {
    expect(() =>
      defineModule({
        id: "@caisson/kernel",
        version: "0.0.0",
        kind: "base",
        tier: "paid",
        priceCents: 4900,
        // @ts-expect-error — sellable must be a boolean
        sellable: "no",
        license: "LicenseRef-Caisson-Commercial",
        description: "Fixture — non-boolean sellable.",
      }),
    ).toThrow();
  });

  test("a non-edition module may omit members (defaults to {}, no refine fires)", () => {
    // `kind: "base"` is not an edition — omitting members is valid (defaults to {}).
    expect(() =>
      defineModule({
        id: "@caisson/kernel",
        version: "0.0.0",
        kind: "base",
        tier: "paid",
        priceCents: 4900,
        license: "LicenseRef-Caisson-Commercial",
        description:
          "Governance kernel (fixture — non-edition members omission).",
      }),
    ).not.toThrow();
  });
});
