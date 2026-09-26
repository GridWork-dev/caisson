import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import type { Framework } from "../registry/control.ts";
import { euAiAct } from "./eu-ai-act.ts";
import { hipaaSecurity } from "./hipaa-security.ts";
import { soc2Tsc } from "./soc2-tsc.ts";

// matchGolden anchors __golden__/ to the file URL it is handed. The compliance package keeps ALL
// goldens in ONE package-level dir (src/__golden__ — the path the manifest's `golden` field gates),
// so anchor at src/ (one level up from frameworks/), not this test's own subdir.
const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;

/** Catalog-level structural invariants shared by every authored framework pack. */
function assertWellFormedCatalog(fw: Framework): void {
  expect(fw.controls.length).toBeGreaterThan(0);
  // Control ids unique within the framework (defineFramework enforces; assert the realized pack).
  const ids = fw.controls.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const control of fw.controls) {
    // Canonical control id is uppercase/`.`/`-` only.
    expect(control.id).toMatch(/^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/);
    // Crosswalk references unique on (framework, reference) per control.
    const keys = control.crosswalk.map((x) =>
      JSON.stringify([x.framework, x.reference]),
    );
    expect(new Set(keys).size).toBe(keys.length);
  }
}

describe("soc2-tsc pack", () => {
  test("is a well-formed own-authored catalog", () => {
    expect(soc2Tsc.id).toBe("soc2-tsc");
    expect(soc2Tsc.version).toBe("2024.1");
    assertWellFormedCatalog(soc2Tsc);
  });

  test("every control crosswalks to at least one external reference", () => {
    for (const control of soc2Tsc.controls) {
      expect(control.crosswalk.length).toBeGreaterThan(0);
    }
  });

  test("covers the Common Criteria series via SOC2-TSC references", () => {
    const refs = soc2Tsc.controls
      .flatMap((c) => c.crosswalk)
      .filter((x) => x.framework === "SOC2-TSC")
      .map((x) => x.reference);
    // Representative coverage across CC1–CC9 plus a category criterion.
    for (const expected of [
      "CC1.1",
      "CC6.1",
      "CC7.2",
      "CC8.1",
      "CC9.2",
      "A1.2",
    ]) {
      expect(refs).toContain(expected);
    }
  });
});

describe("hipaa-security pack", () => {
  test("is a well-formed own-authored catalog", () => {
    expect(hipaaSecurity.id).toBe("hipaa-security");
    expect(hipaaSecurity.version).toBe("2024.1");
    assertWellFormedCatalog(hipaaSecurity);
  });

  test("every control crosswalks to at least one external reference", () => {
    for (const control of hipaaSecurity.controls) {
      expect(control.crosswalk.length).toBeGreaterThan(0);
    }
  });

  test("covers Administrative, Physical, and Technical safeguards via CFR citations", () => {
    const refs = hipaaSecurity.controls
      .flatMap((c) => c.crosswalk)
      .filter((x) => x.framework === "HIPAA-Security")
      .map((x) => x.reference);
    for (const expected of [
      "164.308(a)(1)(i)", // Administrative — security management process
      "164.310(a)(1)", // Physical — facility access controls
      "164.312(a)(2)(i)", // Technical — unique user identification
      "164.316(a)", // Documentation requirements
    ]) {
      expect(refs).toContain(expected);
    }
  });
});

describe("eu-ai-act pack", () => {
  test("is a well-formed own-authored catalog", () => {
    expect(euAiAct.id).toBe("eu-ai-act");
    expect(euAiAct.version).toBe("2024.1");
    assertWellFormedCatalog(euAiAct);
  });

  test("every control crosswalks to at least one external reference", () => {
    for (const control of euAiAct.controls) {
      expect(control.crosswalk.length).toBeGreaterThan(0);
    }
  });

  test("covers the high-risk Title III Chapter 2-3 obligations via EU-AI-Act article references", () => {
    const refs = euAiAct.controls
      .flatMap((c) => c.crosswalk)
      .filter((x) => x.framework === "EU-AI-Act")
      .map((x) => x.reference);
    // Representative coverage: requirements (Art 9-15) through provider duties (Art 17-73).
    for (const expected of [
      "Art. 9", // risk management system
      "Art. 10", // data and data governance
      "Art. 11", // technical documentation
      "Art. 12", // record-keeping / automatic logging
      "Art. 14", // human oversight
      "Art. 15", // accuracy, robustness, cybersecurity
      "Art. 17", // quality management system
      "Art. 43", // conformity assessment
      "Art. 72", // post-market monitoring
      "Art. 73", // serious-incident reporting
    ]) {
      expect(refs).toContain(expected);
    }
  });

  test("reuses the shared AUDIT.IMMUTABLE-LOG and GOVERNANCE.DOCUMENTATION canonical ids verbatim", () => {
    // Mirrors the GOVERNANCE.SECURITY-RESPONSIBILITY precedent shared by soc2-tsc/hipaa-security:
    // the SAME canonical control (id/title/family/statement) reused across frameworks, with each
    // pack supplying only its own crosswalk entry — never a duplicated-but-drifted definition.
    const shared = (id: string) => euAiAct.controls.find((c) => c.id === id);
    const auditLog = shared("AUDIT.IMMUTABLE-LOG");
    expect(auditLog?.statement).toBe(
      soc2Tsc.controls.find((c) => c.id === "AUDIT.IMMUTABLE-LOG")?.statement,
    );
    const docRetention = shared("GOVERNANCE.DOCUMENTATION");
    expect(docRetention?.statement).toBe(
      hipaaSecurity.controls.find((c) => c.id === "GOVERNANCE.DOCUMENTATION")
        ?.statement,
    );
  });
});

describe("control-to-code traceability (ADR-0229 row 9)", () => {
  // The exemplar golden for the traceability idiom (docs/compliance/control-traceability.md): a
  // control-logic fixture carrying `policyVersion` — the ADR/policy revision it was captured under.
  // Derived from the real soc2Tsc pack (not fabricated), and a plain matchGolden compare (no
  // .strict() re-parse), so it pins evidence provenance without touching the framework schema.
  test("soc2-tsc traceability record pins its policyVersion", () => {
    matchGolden(PKG_SRC_META, "control-traceability", {
      policyVersion: "ADR-0057",
      framework: soc2Tsc.id,
      catalogVersion: soc2Tsc.version,
      control: soc2Tsc.controls.find((c) => c.id === "AUDIT.IMMUTABLE-LOG")?.id,
    });
  });
});

describe("catalog goldens", () => {
  // Pins the validated wire shape the collectors and manifest consume. Ships inline; the
  // gate runs with BLESS unset.
  test("soc2-tsc catalog is byte-stable", () => {
    matchGolden(PKG_SRC_META, "soc2-tsc.catalog", soc2Tsc);
  });

  test("hipaa-security catalog is byte-stable", () => {
    matchGolden(PKG_SRC_META, "hipaa-security.catalog", hipaaSecurity);
  });

  test("eu-ai-act catalog is byte-stable", () => {
    matchGolden(PKG_SRC_META, "eu-ai-act.catalog", euAiAct);
  });
});
