import { describe, expect, test } from "bun:test";
import { accentCandidates } from "../tokens/candidates.ts";
import {
  DEFAULT_PRESET_ID,
  getPreset,
  listPresets,
  registerPreset,
} from "./presets.ts";

describe("preset registry (ADR-0250 G2b)", () => {
  test("the 3 locked OKLCH candidates are registered as built-in presets", () => {
    expect(listPresets().length).toBeGreaterThanOrEqual(
      accentCandidates.length,
    );
    expect(getPreset("caisson")).toBeDefined();
    expect(getPreset("pressure")).toBeDefined();
    expect(getPreset("bulkhead")).toBeDefined();
  });

  test("the default preset id matches the locked selection (candidate a)", () => {
    const a = accentCandidates.find((c) => c.id === "a");
    const preset = getPreset(DEFAULT_PRESET_ID);
    expect(preset?.dark).toEqual(a?.dark);
    expect(preset?.light).toEqual(a?.light);
  });

  test("getPreset returns undefined for an unregistered id", () => {
    expect(getPreset("does-not-exist")).toBeUndefined();
  });

  test("registerPreset accepts a well-formed custom preset", () => {
    registerPreset({
      id: "custom-test-preset",
      name: "Custom Test Preset",
      dark: getPreset("caisson")!.dark,
      light: getPreset("caisson")!.light,
    });
    expect(getPreset("custom-test-preset")).toBeDefined();
  });

  test("registerPreset rejects a bad shape — unknown key (.strict())", () => {
    expect(() =>
      registerPreset({
        id: "bad-extra-key",
        name: "Bad",
        dark: getPreset("caisson")!.dark,
        light: getPreset("caisson")!.light,
        // @ts-expect-error — deliberately testing the .strict() rejection path
        extraUnknownKey: "nope",
      }),
    ).toThrow();
  });

  test("registerPreset rejects a bad shape — missing/empty token", () => {
    expect(() =>
      registerPreset({
        id: "bad-empty-token",
        name: "Bad",
        dark: { ...getPreset("caisson")!.dark, bg: "" },
        light: getPreset("caisson")!.light,
      }),
    ).toThrow();
  });

  test("re-registering the same id with a DIFFERENT shape throws (no silent overwrite)", () => {
    registerPreset({
      id: "reregister-test",
      name: "Reregister Test",
      dark: getPreset("caisson")!.dark,
      light: getPreset("caisson")!.light,
    });
    expect(() =>
      registerPreset({
        id: "reregister-test",
        name: "Reregister Test",
        dark: getPreset("pressure")!.dark,
        light: getPreset("pressure")!.light,
      }),
    ).toThrow();
  });

  test("re-registering the same id with an IDENTICAL shape is a no-op", () => {
    const preset = {
      id: "idempotent-test",
      name: "Idempotent Test",
      dark: getPreset("caisson")!.dark,
      light: getPreset("caisson")!.light,
    };
    registerPreset(preset);
    expect(() => registerPreset(preset)).not.toThrow();
  });
});
