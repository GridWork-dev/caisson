import { describe, expect, test } from "bun:test";

import { displayLabel, displayPrice } from "../components/plan-purchase-row";
import { bundlePrice, moduleAmount } from "../lib/pricing";

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

describe("displayPrice (ADR-0374: Buy rows previously showed no price)", () => {
  test("resolves a bundle id to the SAME formatted price bundlePrice() returns", () => {
    expect(displayPrice("ai-production_bundle")).toBe(
      bundlePrice("ai-production"),
    );
  });

  test("resolves a module id to its catalog amount, formatted", () => {
    expect(displayPrice("field-crypto_module")).toBe(
      `$${moduleAmount("field-crypto").toLocaleString("en-US")}`,
    );
  });

  test("returns null for a tag with no one-time catalog entry (a subscription tag)", () => {
    expect(displayPrice("credit_pack")).toBeNull();
  });
});
