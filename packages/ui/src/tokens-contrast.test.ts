import { describe, expect, test } from "bun:test";

import { checkContrast } from "@caisson-sh/ds-manifest";
import {
  codeTokensDark,
  codeTokensLight,
  darkTheme,
  functionalDark,
  functionalLight,
  lightTheme,
} from "./tokens/index.ts";

/**
 * The manifest package owns the one browser-equivalent gamut mapping and WCAG pair matrix.
 * @caisson-sh/ui supplies only its live token objects here, so neither thresholds nor color math can
 * drift between the kit's CI gate and the agent-facing doctor.
 */
describe("WCAG contrast matrix — both modes (ADR-0101 gate #2)", () => {
  test("dark semantic, functional, and code tokens clear the shared matrix", () => {
    expect(
      checkContrast(darkTheme, functionalDark, "dark", codeTokensDark),
    ).toEqual([]);
  });

  test("light semantic, functional, and code tokens clear the shared matrix", () => {
    expect(
      checkContrast(lightTheme, functionalLight, "light", codeTokensLight),
    ).toEqual([]);
  });
});
