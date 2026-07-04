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
