import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson/testing";
import type { Framework } from "../registry/control.ts";
import { euAiAct } from "./eu-ai-act.ts";
import { hipaaSecurity } from "./hipaa-security.ts";
import { soc2Tsc } from "./soc2-tsc.ts";

// matchGolden anchors __golden__/ to the file URL it is handed. The compliance package keeps ALL
// goldens in ONE package-level dir (src/__golden__ — the path the manifest's `golden` field gates,
// T18), so anchor at src/ (one level up from frameworks/), not this test's own subdir.
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

describe("eu-ai-act reserved slot", () => {
  test("is a named reservation with no authored control content", () => {
    expect(euAiAct.id).toBe("eu-ai-act");
    expect(euAiAct.status).toBe("reserved");
    // No catalog golden and no controls — this is a manifest slot, not a defineFramework pack.
    expect("controls" in euAiAct).toBe(false);
    expect(euAiAct.outline.length).toBeGreaterThan(0);
    for (const item of euAiAct.outline) {
      expect(item.section).not.toBe("");
      expect(item.heading).not.toBe("");
    }
  });
});

describe("catalog goldens", () => {
  // Pins the validated wire shape T11 (collectors) and T18 (manifest) consume. Ships inline; the
  // gate runs with BLESS unset.
  test("soc2-tsc catalog is byte-stable", () => {
    matchGolden(PKG_SRC_META, "soc2-tsc.catalog", soc2Tsc);
  });

  test("hipaa-security catalog is byte-stable", () => {
    matchGolden(PKG_SRC_META, "hipaa-security.catalog", hipaaSecurity);
  });
});
