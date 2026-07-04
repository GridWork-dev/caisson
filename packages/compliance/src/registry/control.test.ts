import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson/kernel";
import { matchGolden } from "@caisson/testing";
import {
  type CanonicalControl,
  defineControl,
  defineFramework,
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
