import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  NOT_LEGAL_ADVICE,
  type ExemptionOutputRule,
  defineExemptionWorksheet,
} from "./exemption-worksheet.ts";
import { ftcEndorsementDisclosureWorksheet } from "./exemplar-ftc-endorsement.ts";

/** A representative valid rule row, reused across tests. */
function sampleRule(): ExemptionOutputRule {
  return {
    legalTestElement: "Material connection must be disclosed.",
    outputRule: "Disclosure string required adjacent to the claim.",
    enforcement: "automated-guardrail",
  };
}

describe("defineExemptionWorksheet", () => {
  test("round-trips a valid worksheet and leaves signOff undefined when omitted", () => {
    const worksheet = defineExemptionWorksheet({
      id: "sample-worksheet",
      title: "Sample worksheet",
      exemption: "A generic exemption.",
      jurisdiction: "US -- Generic",
      disclaimer: NOT_LEGAL_ADVICE,
      rules: [sampleRule()],
    });
    expect(worksheet.id).toBe("sample-worksheet");
    expect(worksheet.rules).toHaveLength(1);
    expect(worksheet.signOff).toBeUndefined();
  });

  test("accepts a signed worksheet with a human sign-off", () => {
    const worksheet = defineExemptionWorksheet({
      id: "sample-worksheet",
      title: "Sample worksheet",
      exemption: "A generic exemption.",
      jurisdiction: "US -- Generic",
      disclaimer: NOT_LEGAL_ADVICE,
      rules: [sampleRule()],
      signOff: {
        reviewerName: "Sample Reviewer",
        reviewerRole: "Outside counsel",
        signedAt: "2026-07-03T00:00:00Z",
        scope: "v1 landing-page copy only",
      },
    });
    expect(worksheet.signOff?.reviewerName).toBe("Sample Reviewer");
  });

  test("rejects a missing or altered disclaimer (the caveat is enforced, not styled)", () => {
    expect(() =>
      defineExemptionWorksheet({
        id: "sample-worksheet",
        title: "Sample worksheet",
        exemption: "A generic exemption.",
        jurisdiction: "US -- Generic",
        // The input boundary is runtime-validated (parseStrict takes unknown), so a wrong
        // disclaimer is type-valid here and MUST be rejected by the schema's z.literal at runtime.
        disclaimer: "This is fine, trust me.",
        rules: [sampleRule()],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an empty rule set", () => {
    expect(() =>
      defineExemptionWorksheet({
        id: "sample-worksheet",
        title: "Sample worksheet",
        exemption: "A generic exemption.",
        jurisdiction: "US -- Generic",
        disclaimer: NOT_LEGAL_ADVICE,
        rules: [],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects duplicate legal-test-elements within a worksheet", () => {
    expect(() =>
      defineExemptionWorksheet({
        id: "sample-worksheet",
        title: "Sample worksheet",
        exemption: "A generic exemption.",
        jurisdiction: "US -- Generic",
        disclaimer: NOT_LEGAL_ADVICE,
        rules: [sampleRule(), sampleRule()],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects a non-kebab worksheet id", () => {
    expect(() =>
      defineExemptionWorksheet({
        id: "Sample_Worksheet",
        title: "Sample worksheet",
        exemption: "A generic exemption.",
        jurisdiction: "US -- Generic",
        disclaimer: NOT_LEGAL_ADVICE,
        rules: [sampleRule()],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an invalid enforcement mode", () => {
    expect(() =>
      defineExemptionWorksheet({
        id: "sample-worksheet",
        title: "Sample worksheet",
        exemption: "A generic exemption.",
        jurisdiction: "US -- Generic",
        disclaimer: NOT_LEGAL_ADVICE,
        rules: [
          {
            ...sampleRule(),
            // @ts-expect-error -- not a member of EnforcementMode
            enforcement: "vibes",
          },
        ],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects unknown keys (.strict boundary)", () => {
    expect(() =>
      defineExemptionWorksheet({
        id: "sample-worksheet",
        title: "Sample worksheet",
        exemption: "A generic exemption.",
        jurisdiction: "US -- Generic",
        disclaimer: NOT_LEGAL_ADVICE,
        rules: [sampleRule()],
        // @ts-expect-error -- unknown key must be rejected at the boundary
        owner: "compliance-team",
      }),
    ).toThrow(ValidationError);
  });
});

describe("ftcEndorsementDisclosureWorksheet exemplar", () => {
  test("is a valid, unsigned worksheet with four output rules", () => {
    expect(ftcEndorsementDisclosureWorksheet.id).toBe(
      "ftc-endorsement-disclosure",
    );
    expect(ftcEndorsementDisclosureWorksheet.disclaimer).toBe(NOT_LEGAL_ADVICE);
    expect(ftcEndorsementDisclosureWorksheet.rules).toHaveLength(4);
    expect(ftcEndorsementDisclosureWorksheet.signOff).toBeUndefined();
  });

  test("every rule has a distinct legal-test-element and a valid enforcement mode", () => {
    const elements = ftcEndorsementDisclosureWorksheet.rules.map(
      (r) => r.legalTestElement,
    );
    expect(new Set(elements).size).toBe(elements.length);
    for (const rule of ftcEndorsementDisclosureWorksheet.rules) {
      expect(["automated-guardrail", "human-review", "untracked"]).toContain(
        rule.enforcement,
      );
    }
  });
});
