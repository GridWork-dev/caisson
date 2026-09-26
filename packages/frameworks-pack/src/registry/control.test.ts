import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import { matchGolden } from "@caisson-sh/testing";
import {
  type CanonicalControl,
  type CrosswalkVerification,
  defineControl,
  defineFramework,
  isVerificationStale,
} from "./control.ts";

// matchGolden anchors __golden__/ to the file URL it's handed. The compliance package keeps ALL
// goldens in ONE package-level dir (src/__golden__ — the path the module manifest's `golden` field
// gates), so anchor at src/ (one level up from registry/), not this test's own subdir.
const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;

/** A representative own-authored canonical control with crosswalk references — the golden subject. */
function sampleControl(): CanonicalControl {
  return defineControl({
    id: "ACCESS-CONTROL.MFA",
    title: "Multi-factor authentication for privileged access",
    family: "Access Control",
    statement:
      "Privileged access to production systems and the tenant data plane requires a second " +
      "authentication factor beyond a password; single-factor privileged sessions are denied.",
    guidance:
      "Enforce at the identity provider for every role granted production or admin scope; record " +
      "the enrollment and the per-session factor in the audit chain.",
    crosswalk: [
      {
        framework: "SOC2-TSC",
        reference: "CC6.1",
        note: "Logical access security — authentication",
      },
      { framework: "HIPAA-Security", reference: "164.312(a)(2)(i)" },
    ],
  });
}

describe("defineControl", () => {
  test("round-trips a valid control and defaults crosswalk to []", () => {
    const control = defineControl({
      id: "AUDIT.IMMUTABLE-LOG",
      title: "Immutable audit log",
      family: "Audit & Accountability",
      statement:
        "Security-relevant events are written to an append-only, hash-chained log that cannot " +
        "be altered or deleted after the fact.",
    });
    expect(control.id).toBe("AUDIT.IMMUTABLE-LOG");
    expect(control.crosswalk).toEqual([]);
    expect(control.guidance).toBeUndefined();
  });

  test("preserves and validates crosswalk references", () => {
    const control = sampleControl();
    expect(control.crosswalk).toHaveLength(2);
    expect(control.crosswalk[0]).toEqual({
      framework: "SOC2-TSC",
      reference: "CC6.1",
      note: "Logical access security — authentication",
    });
  });

  test("rejects unknown keys (.strict boundary)", () => {
    expect(() =>
      defineControl({
        id: "ACCESS-CONTROL.MFA",
        title: "x",
        family: "Access Control",
        statement: "y",
        // @ts-expect-error — unknown key must be rejected at the boundary
        owner: "security-team",
      }),
    ).toThrow(ValidationError);
  });

  test("rejects a non-canonical control id", () => {
    expect(() =>
      defineControl({
        id: "access-control.mfa", // lowercase — not a canonical id
        title: "x",
        family: "Access Control",
        statement: "y",
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an empty title", () => {
    expect(() =>
      defineControl({
        id: "ACCESS-CONTROL.MFA",
        title: "   ",
        family: "Access Control",
        statement: "y",
      }),
    ).toThrow(ValidationError);
  });

  test("rejects duplicate crosswalk references on (framework, reference)", () => {
    expect(() =>
      defineControl({
        id: "ACCESS-CONTROL.MFA",
        title: "x",
        family: "Access Control",
        statement: "y",
        crosswalk: [
          { framework: "SOC2-TSC", reference: "CC6.1" },
          { framework: "SOC2-TSC", reference: "CC6.1" },
        ],
      }),
    ).toThrow(ValidationError);
  });
});

describe("structured provenance (ADR-0333/CR-10 -- verification replaces verified: boolean)", () => {
  function sampleVerification(): CrosswalkVerification {
    return {
      status: "reviewed",
      relationship: "equivalent",
      sourceId: "packages/field-crypto/src/crypto-shred.test.ts",
      sourceVersion: "2026.1",
      sourceDigest:
        "e57977329145a27f8054314141f56b22bd9ea4d39001b998d47a630899d1cbe0".slice(
          0,
          64,
        ),
      reviewedBy: "operator",
      reviewedAt: "2026-07-13T00:00:00.000Z",
    };
  }

  test("a crosswalk reference with a valid verification record parses", () => {
    const control = defineControl({
      id: "ACCESS-CONTROL.MFA",
      title: "x",
      family: "Access Control",
      statement: "y",
      crosswalk: [
        {
          framework: "SOC2-TSC",
          reference: "C1.2",
          verification: sampleVerification(),
        },
      ],
    });
    expect(control.crosswalk[0]?.verification).toEqual(sampleVerification());
  });

  test("verification is optional -- an absent record is honest unreviewed-equivalent", () => {
    const control = defineControl({
      id: "ACCESS-CONTROL.MFA",
      title: "x",
      family: "Access Control",
      statement: "y",
      crosswalk: [{ framework: "SOC2-TSC", reference: "CC6.1" }],
    });
    expect(control.crosswalk[0]?.verification).toBeUndefined();
  });

  test("rejects an unknown field inside verification (.strict() boundary)", () => {
    expect(() =>
      defineControl({
        id: "ACCESS-CONTROL.MFA",
        title: "x",
        family: "Access Control",
        statement: "y",
        crosswalk: [
          {
            framework: "SOC2-TSC",
            reference: "C1.2",
            verification: {
              ...sampleVerification(),
              // @ts-expect-error -- unknown key must be rejected at the boundary
              confidencePercent: 90,
            },
          },
        ],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects a malformed sourceDigest (must be 64-hex)", () => {
    expect(() =>
      defineControl({
        id: "ACCESS-CONTROL.MFA",
        title: "x",
        family: "Access Control",
        statement: "y",
        crosswalk: [
          {
            framework: "SOC2-TSC",
            reference: "C1.2",
            verification: {
              ...sampleVerification(),
              sourceDigest: "not-a-digest",
            },
          },
        ],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an invalid status/relationship enum value", () => {
    expect(() =>
      defineControl({
        id: "ACCESS-CONTROL.MFA",
        title: "x",
        family: "Access Control",
        statement: "y",
        crosswalk: [
          {
            framework: "SOC2-TSC",
            reference: "C1.2",
            verification: {
              ...sampleVerification(),
              status: "verified" as unknown as CrosswalkVerification["status"],
            },
          },
        ],
      }),
    ).toThrow(ValidationError);
  });

  describe("isVerificationStale (A2 -- source-digest change invalidates review)", () => {
    test("undefined verification is stale (never reviewed)", () => {
      expect(isVerificationStale(undefined, "a".repeat(64))).toBe(true);
    });

    test("matching sourceDigest is not stale", () => {
      const v = sampleVerification();
      expect(isVerificationStale(v, v.sourceDigest)).toBe(false);
    });

    test("a changed sourceDigest is stale", () => {
      const v = sampleVerification();
      expect(isVerificationStale(v, "b".repeat(64))).toBe(true);
    });
  });
});

describe("defineFramework", () => {
  test("builds a framework from canonical controls", () => {
    const framework = defineFramework({
      id: "soc2-tsc",
      title: "SOC 2 — Trust Services Criteria",
      version: "2024.1",
      description:
        "Trust Services Criteria coverage pack (own-authored, crosswalked).",
      controls: [sampleControl()],
    });
    expect(framework.id).toBe("soc2-tsc");
    expect(framework.controls).toHaveLength(1);
    expect(framework.controls[0]?.id).toBe("ACCESS-CONTROL.MFA");
  });

  test("rejects an empty control set", () => {
    expect(() =>
      defineFramework({
        id: "soc2-tsc",
        title: "SOC 2",
        version: "2024.1",
        description: "x",
        controls: [],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects duplicate control ids within a framework", () => {
    expect(() =>
      defineFramework({
        id: "soc2-tsc",
        title: "SOC 2",
        version: "2024.1",
        description: "x",
        controls: [sampleControl(), sampleControl()],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects a non-kebab framework id", () => {
    expect(() =>
      defineFramework({
        id: "SOC2_TSC",
        title: "SOC 2",
        version: "2024.1",
        description: "x",
        controls: [sampleControl()],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects unknown keys (.strict boundary)", () => {
    expect(() =>
      defineFramework({
        id: "soc2-tsc",
        title: "SOC 2",
        version: "2024.1",
        description: "x",
        controls: [sampleControl()],
        // @ts-expect-error — unknown key must be rejected at the boundary
        authoredBy: "compliance-team",
      }),
    ).toThrow(ValidationError);
  });
});

describe("golden", () => {
  test("canonical control shape is byte-stable", () => {
    // Pins the canonical-control + crosswalk-reference wire shape the framework packs and collectors consume.
    matchGolden(PKG_SRC_META, "sample-control", sampleControl());
  });
});
