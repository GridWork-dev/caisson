import { describe, expect, test } from "bun:test";

import {
  axeViolations,
  expectNoA11yViolations,
  formatAxeViolations,
} from "./axe.ts";

describe("axeViolations", () => {
  test("passes clean, labelled markup", async () => {
    const violations = await axeViolations(
      '<button type="button" aria-label="Close">x</button>',
    );
    expect(violations).toEqual([]);
  });

  test("flags an unlabelled interactive control", async () => {
    const violations = await axeViolations(
      '<div role="checkbox" aria-checked="false"></div>',
    );
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.id === "aria-toggle-field-name")).toBe(
      true,
    );
  });

  test("formatAxeViolations renders a readable summary", async () => {
    const violations = await axeViolations(
      '<div role="checkbox" aria-checked="false"></div>',
    );
    const message = formatAxeViolations(violations);
    expect(message).toContain("aria-toggle-field-name");
  });

  test("expectNoA11yViolations passes clean markup and throws on a real violation", async () => {
    await expectNoA11yViolations(
      '<button type="button" aria-label="Close">x</button>',
    );
    await expect(
      expectNoA11yViolations(
        '<div role="checkbox" aria-checked="false"></div>',
      ),
    ).rejects.toThrow("aria-toggle-field-name");
  });
});
