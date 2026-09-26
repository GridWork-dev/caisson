import { describe, expect, test } from "bun:test";

/**
 * Exports-map resolution guard. `packages/ui/package.json`'s `exports` field is the ONLY thing
 * that decides whether a subpath a consumer imports actually resolves — a new source directory
 * with no matching entry (or a typo'd one) fails at the CONSUMER, not here, unless something
 * self-imports through the real package name the way a real consumer would (a known class of
 * bug: the kit once shipped without an exports entry a component needed). Self-import via the package's
 * own name (`@caisson-sh/ui/...`) exercises the same resolution path bun/node give any consumer.
 */
describe("@caisson-sh/ui exports map (self-import resolution)", () => {
  test('"." resolves and re-exports both the token contract and the theme API', async () => {
    const root = await import("@caisson-sh/ui");
    // token contract (pre-existing)
    expect(root.darkTheme).toBeDefined();
    expect(root.foundation).toBeDefined();
    // theme API (this change)
    expect(root.createTheme).toBeTypeOf("function");
    expect(root.applyTheme).toBeTypeOf("function");
    expect(root.registerPreset).toBeTypeOf("function");
  });

  test('"./tokens" resolves and includes the shared css-var helpers', async () => {
    const tokens = await import("@caisson-sh/ui/tokens");
    expect(tokens.darkTheme).toBeDefined();
    expect(tokens.semanticThemeToCssVars).toBeTypeOf("function");
  });

  test('"./theme" resolves the full runtime theme API surface', async () => {
    const theme = await import("@caisson-sh/ui/theme");
    expect(theme.createTheme).toBeTypeOf("function");
    expect(theme.applyTheme).toBeTypeOf("function");
    expect(theme.themeToCssVars).toBeTypeOf("function");
    expect(theme.themeToCssText).toBeTypeOf("function");
    expect(theme.registerPreset).toBeTypeOf("function");
    expect(theme.getPreset).toBeTypeOf("function");
    expect(theme.listPresets).toBeTypeOf("function");
    expect(theme.DEFAULT_PRESET_ID).toBe("caisson");

    const resolved = theme.createTheme();
    expect(resolved.id).toBe("caisson");
  });
});
