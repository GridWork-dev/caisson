import { describe, expect, test } from "bun:test";

import { displayLabel } from "../components/plan-purchase-row";

describe("displayLabel", () => {
  test("resolves a bare bundle id", () => {
    expect(displayLabel("ai-production")).toBe("AI-Production");
  });

  test("resolves a _bundle-suffixed tag", () => {
    expect(displayLabel("ai-production_bundle")).toBe("AI-Production");
  });

  test("resolves a _module-suffixed tag to the module catalog (WR-01)", () => {
    expect(displayLabel("field-crypto_module")).toBe("Field encryption");
  });

  test("falls back to a humanized tag for anything with no catalog entry", () => {
    expect(displayLabel("credit_pack")).toBe("Credit pack");
  });
});
