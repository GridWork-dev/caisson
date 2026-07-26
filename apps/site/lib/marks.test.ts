// Catalog-mark integrity (ADR-0237 F6 / ADR-0380 lock 6): every sellable module must resolve
// through the bespoke registry rather than the generic `boxes` fallback.
import { describe, expect, test } from "bun:test";

import { moduleMark } from "./marks";
import { MODULE_PRICES } from "./pricing";

describe("catalog module marks", () => {
  test("every sellable module resolves to a non-fallback mark", () => {
    const fallbackIds = MODULE_PRICES.filter(
      ({ id }) => moduleMark(id) === "boxes",
    ).map(({ id }) => id);
    expect(fallbackIds).toEqual([]);
  });

  test("the module-depth wave maps to its three bespoke glyphs", () => {
    expect(moduleMark("access-review")).toBe("access-review");
    expect(moduleMark("risk-register")).toBe("risk-register");
    expect(moduleMark("trust-page")).toBe("trust-page");
  });
});
