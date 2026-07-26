import { describe, expect, test } from "bun:test";
import * as oscalSpine from "@caisson/oscal-spine";
import * as complianceCore from "./index.ts";

describe("@caisson/compliance-core OSCAL compatibility surface", () => {
  test("re-exports the whole OSCAL package surface unchanged", () => {
    expect(complianceCore.toOscalBundle).toBe(oscalSpine.toOscalBundle);
    expect(complianceCore.toOscalCatalog).toBe(oscalSpine.toOscalCatalog);
    expect(complianceCore.nist80053Crosswalk).toBe(
      oscalSpine.nist80053Crosswalk,
    );
  });
});
