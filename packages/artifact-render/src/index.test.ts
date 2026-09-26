import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  isReadinessLanguage,
  assertReadinessLanguage,
  redactToAllowlist,
  renderCitationRow,
  citationRowToJson,
} from "./index.ts";

describe("readiness-language filter", () => {
  test("passes ordinary readiness/posture prose", () => {
    expect(isReadinessLanguage("evidence is ready; one gap remains")).toBe(
      true,
    );
  });

  for (const banned of ["compliant", "Certified", "VERIFIED"]) {
    test(`rejects "${banned}"`, () => {
      expect(isReadinessLanguage(`this makes you ${banned}`)).toBe(false);
      expect(() =>
        assertReadinessLanguage(`this makes you ${banned}`, "field"),
      ).toThrow(ValidationError);
    });
  }

  test("word-bounded — does not false-positive on a substring", () => {
    // "uncertified" / "unverified" contain the banned root but not the banned word.
    expect(isReadinessLanguage("status is uncertified pending review")).toBe(
      true,
    );
  });
});

describe("redactToAllowlist", () => {
  const facts = {
    "framework.title": "ISO/IEC 27001:2022",
    "chainAnchor.tipHash": "deadbeef",
    tenantId: "tenant-acme",
  };

  test("only allowlisted keys survive", () => {
    const redacted = redactToAllowlist(facts, ["framework.title"]);
    expect(redacted).toEqual({ "framework.title": "ISO/IEC 27001:2022" });
  });

  test("a field absent from the allowlist never renders — none of its bytes appear", () => {
    const redacted = redactToAllowlist(facts, ["framework.title"]);
    const bytes = JSON.stringify(redacted);
    expect(bytes.includes("deadbeef")).toBe(false);
    expect(bytes.includes("tenant-acme")).toBe(false);
  });

  test("an allowlisted key absent from facts is simply omitted, not errored", () => {
    const redacted = redactToAllowlist(facts, [
      "framework.title",
      "no-such-key",
    ]);
    expect(Object.keys(redacted)).toEqual(["framework.title"]);
  });

  test("empty allowlist redacts everything", () => {
    expect(redactToAllowlist(facts, [])).toEqual({});
  });
});

describe("renderCitationRow", () => {
  test("builds a validated row", () => {
    const row = renderCitationRow({
      control: "A.5.15",
      claim: "applicable",
      justification: "Mapped to tenant-isolation RLS.",
      evidencePointer: "ACCESS-CONTROL.LOGICAL",
    });
    expect(row.control).toBe("A.5.15");
    expect(citationRowToJson(row)).toEqual({
      control: "A.5.15",
      claim: "applicable",
      justification: "Mapped to tenant-isolation RLS.",
      evidencePointer: "ACCESS-CONTROL.LOGICAL",
    });
  });

  test("omits evidencePointer from the JSON shape when unset", () => {
    const row = renderCitationRow({
      control: "A.5.99",
      claim: "unresolved",
      justification: "No crosswalk row maps this control yet.",
    });
    expect(citationRowToJson(row)).toEqual({
      control: "A.5.99",
      claim: "unresolved",
      justification: "No crosswalk row maps this control yet.",
    });
  });

  test("rejects a banned claim word in justification (ADR-0080)", () => {
    expect(() =>
      renderCitationRow({
        control: "A.5.15",
        claim: "applicable",
        justification: "This makes you compliant.",
      }),
    ).toThrow(ValidationError);
  });

  test("rejects a banned claim word in control or claim too, not just justification (WR-02)", () => {
    expect(() =>
      renderCitationRow({
        control: "certified vendor A.5.15",
        claim: "applicable",
        justification: "fine",
      }),
    ).toThrow(ValidationError);
    expect(() =>
      renderCitationRow({
        control: "A.5.15",
        claim: "verified",
        justification: "fine",
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an out-of-bounds field", () => {
    expect(() =>
      renderCitationRow({
        control: "",
        claim: "applicable",
        justification: "x",
      }),
    ).toThrow(ValidationError);
  });
});
