import { describe, expect, test } from "bun:test";
import { createTheme } from "./create-theme.ts";
import { getPreset, registerPreset } from "./presets.ts";

describe("createTheme (ADR-0250 G2b)", () => {
  test("no options resolves the locked default (caisson) preset", () => {
    const theme = createTheme();
    expect(theme.id).toBe("caisson");
    expect(theme.dark).toEqual(getPreset("caisson")!.dark);
    expect(theme.light).toEqual(getPreset("caisson")!.light);
  });

  test("preset selects a named built-in", () => {
    const theme = createTheme({ preset: "pressure" });
    expect(theme.id).toBe("pressure");
    expect(theme.dark.accent).toBe(getPreset("pressure")!.dark.accent);
  });

  test("an unknown preset id throws with the known-id list", () => {
    expect(() => createTheme({ preset: "not-a-real-preset" })).toThrow(
      /Unknown theme preset/,
    );
  });

  test("overrides layer on top of the preset without touching untouched tokens", () => {
    const theme = createTheme({
      overrides: { dark: { accent: "oklch(0.5 0.2 30)" } },
    });
    expect(theme.dark.accent).toBe("oklch(0.5 0.2 30)");
    // everything else stays the preset's value
    expect(theme.dark.bg).toBe(getPreset("caisson")!.dark.bg);
    expect(theme.light).toEqual(getPreset("caisson")!.light);
  });

  test("a bad override — unknown key — is rejected (.strict())", () => {
    expect(() =>
      createTheme({
        overrides: {
          // @ts-expect-error — deliberately testing the .strict() rejection path
          dark: { notARealToken: "oklch(0.5 0.2 30)" },
        },
      }),
    ).toThrow();
  });

  test("a bad override — empty-string token — is rejected", () => {
    expect(() =>
      createTheme({ overrides: { dark: { accent: "" } } }),
    ).toThrow();
  });

  test("createTheme composes with a caller-registered custom preset", () => {
    registerPreset({
      id: "create-theme-custom",
      name: "Create Theme Custom",
      dark: getPreset("caisson")!.dark,
      light: getPreset("caisson")!.light,
    });
    const theme = createTheme({
      preset: "create-theme-custom",
      overrides: { light: { fg: "oklch(0.1 0 0)" } },
    });
    expect(theme.id).toBe("create-theme-custom");
    expect(theme.light.fg).toBe("oklch(0.1 0 0)");
  });
});
