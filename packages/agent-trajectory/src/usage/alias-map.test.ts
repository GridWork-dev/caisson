import { describe, expect, test } from "bun:test";
import { BUNDLED_PRICE_BOOK, resolvePriceEntry } from "@caisson-sh/ai-meter";
import { resolveModelAlias } from "./alias-map.ts";

describe("resolveModelAlias", () => {
  test("a known dated Claude id resolves to the exact BUNDLED_PRICE_BOOK row", () => {
    const alias = resolveModelAlias("anthropic", "claude-sonnet-4-5-20250514");
    expect(alias).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4.5",
    });
    // The alias must actually resolve in the bundled book — proves it isn't a dangling reference.
    expect(() =>
      resolvePriceEntry(BUNDLED_PRICE_BOOK, alias!.provider, alias!.model),
    ).not.toThrow();
  });

  test("every seeded alias resolves to a real BUNDLED_PRICE_BOOK row", () => {
    for (const [key, alias] of [
      [
        "anthropic/claude-sonnet-4-5-20250514",
        resolveModelAlias("anthropic", "claude-sonnet-4-5-20250514"),
      ],
      [
        "anthropic/claude-3-5-haiku-20241022",
        resolveModelAlias("anthropic", "claude-3-5-haiku-20241022"),
      ],
      [
        "openai/gpt-4o-mini-2024-07-18",
        resolveModelAlias("openai", "gpt-4o-mini-2024-07-18"),
      ],
    ] as const) {
      expect(alias, `alias for ${key}`).not.toBeNull();
      expect(() =>
        resolvePriceEntry(BUNDLED_PRICE_BOOK, alias!.provider, alias!.model),
      ).not.toThrow();
    }
  });

  test("an unknown model or provider misses -> null, never a guess", () => {
    expect(resolveModelAlias("openai", "gpt-5.6-sol")).toBeNull();
    expect(resolveModelAlias("anthropic", "claude-opus-4-8")).toBeNull();
    expect(
      resolveModelAlias("unknown-vendor", "claude-sonnet-4-5-20250514"),
    ).toBeNull();
  });
});
