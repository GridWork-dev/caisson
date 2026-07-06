// ADR-0257 §1.2 / ADR-0247 F7 — the per-MEMBER snapshot-at-sale filter (the D side of the D/E
// boundary; E owns per-VERSION enforcement at the Worker). `expandEntitlements` gains an optional
// `EntitlementSnapshot` (the buyer's signed `entitledSince` + an injected bundle-membership
// timeline): a bundle member that joined AFTER the buyer's entitledSince for that bundle is dropped,
// fail-SOFT at every missing/malformed edge. Omitting the snapshot is byte-identical to the prior
// behavior; the TM-E fail-closed throw is untouched on both paths.
import { describe, expect, test } from "bun:test";
import { type EntitlementSnapshot, expandEntitlements } from "./entitlements";
import { loadRegistryIndex } from "./registry-index";

/** A hermetic index: a Compliance edition meta whose members map carries three commercial members,
 *  each an indexed module. Bundle id `compliance` aliases to itself (ADR-0257). */
const index = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/compliance",
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          publishedAt: "2026-06-30T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000010",
          manifest: {
            id: "@caisson/compliance",
            version: "0.1.0",
            kind: "edition",
            editions: ["compliance"],
            tier: "paid",
            priceCents: 104900,
            license: "LicenseRef-Caisson-Commercial",
            members: {
              "@caisson/compliance": "0.1.0",
              "@caisson/field-crypto": "0.1.0",
              "@caisson/audit-worm": "0.1.0",
              "@caisson/alerting": "0.1.0",
            },
            description: "Compliance edition meta (fixture).",
          },
        },
      ],
    },
    ...["field-crypto", "audit-worm", "alerting"].map((slug) => ({
      id: `@caisson/${slug}`,
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          publishedAt: "2026-06-30T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000010",
          manifest: {
            id: `@caisson/${slug}`,
            version: "0.1.0",
            kind: "primitive" as const,
            editions: [] as string[],
            tier: "paid" as const,
            priceCents: 19900,
            license: "LicenseRef-Caisson-Commercial",
            description: `${slug} member (fixture).`,
          },
        },
      ],
    })),
  ],
});

/** The full unfiltered Compliance expansion — the baseline every filtered case is measured against. */
const UNFILTERED = [...expandEntitlements(index, ["compliance"])].sort();

describe("per-member snapshot filter (ADR-0247 F7 / ADR-0257)", () => {
  test("no snapshot → unfiltered (byte-identical to the prior contract)", () => {
    expect(UNFILTERED).toContain("@caisson/field-crypto");
    expect(UNFILTERED).toContain("@caisson/alerting");
  });

  test("a member that joined AFTER entitledSince is dropped; earlier members stay", () => {
    const snapshot: EntitlementSnapshot = {
      entitledSince: { compliance: "2026-06-15T00:00:00.000Z" },
      membershipTimeline: {
        compliance: {
          "field-crypto": "2026-06-01T00:00:00.000Z", // before sale → kept
          alerting: "2026-07-01T00:00:00.000Z", // AFTER sale → dropped
          // audit-worm has NO join date → fail-soft kept
        },
      },
    };
    const members = [...expandEntitlements(index, ["compliance"], snapshot)];
    expect(members).toContain("@caisson/field-crypto");
    expect(members).toContain("@caisson/audit-worm"); // missing join date → fail soft
    expect(members).not.toContain("@caisson/alerting");
  });

  test("timeline keyed by the FULL @caisson/<slug> id matches too", () => {
    const snapshot: EntitlementSnapshot = {
      entitledSince: { compliance: "2026-06-15T00:00:00.000Z" },
      membershipTimeline: {
        compliance: { "@caisson/alerting": "2026-07-01T00:00:00.000Z" },
      },
    };
    const members = [...expandEntitlements(index, ["compliance"], snapshot)];
    expect(members).not.toContain("@caisson/alerting");
  });

  test("absent entitledSince key = GRANDFATHERED (no filtering for that bundle)", () => {
    const snapshot: EntitlementSnapshot = {
      entitledSince: {}, // no key for compliance → grandfathered
      membershipTimeline: {
        compliance: { alerting: "2999-01-01T00:00:00.000Z" }, // would drop everything if applied
      },
    };
    expect(
      [...expandEntitlements(index, ["compliance"], snapshot)].sort(),
    ).toEqual(UNFILTERED);
  });

  test("no timeline for the bundle = fail-soft (all members kept)", () => {
    const snapshot: EntitlementSnapshot = {
      entitledSince: { compliance: "2000-01-01T00:00:00.000Z" }, // ancient — would drop all if a timeline existed
      membershipTimeline: {}, // none → fail soft
    };
    expect(
      [...expandEntitlements(index, ["compliance"], snapshot)].sort(),
    ).toEqual(UNFILTERED);
  });

  test("unparseable entitledSince → fail-soft (keep all)", () => {
    const snapshot: EntitlementSnapshot = {
      entitledSince: { compliance: "not-a-date" },
      membershipTimeline: {
        compliance: { alerting: "2026-07-01T00:00:00.000Z" },
      },
    };
    expect(
      [...expandEntitlements(index, ["compliance"], snapshot)].sort(),
    ).toEqual(UNFILTERED);
  });

  test("unparseable member join date → fail-soft (keep that member)", () => {
    const snapshot: EntitlementSnapshot = {
      entitledSince: { compliance: "2026-06-15T00:00:00.000Z" },
      membershipTimeline: { compliance: { alerting: "whenever" } },
    };
    expect([...expandEntitlements(index, ["compliance"], snapshot)]).toContain(
      "@caisson/alerting",
    );
  });

  test("a member joining EXACTLY at entitledSince is kept (only strictly-after is dropped)", () => {
    const snapshot: EntitlementSnapshot = {
      entitledSince: { compliance: "2026-07-01T00:00:00.000Z" },
      membershipTimeline: {
        compliance: { alerting: "2026-07-01T00:00:00.000Z" },
      },
    };
    expect([...expandEntitlements(index, ["compliance"], snapshot)]).toContain(
      "@caisson/alerting",
    );
  });

  test("TM-E pin: the fail-closed throw survives snapshot mode (unknown id still throws)", () => {
    const snapshot: EntitlementSnapshot = {
      entitledSince: { compliance: "2026-06-15T00:00:00.000Z" },
      membershipTimeline: { compliance: {} },
    };
    expect(() =>
      expandEntitlements(index, ["compliance", "garbage"], snapshot),
    ).toThrow();
  });
});
