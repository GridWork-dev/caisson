import { expectNoA11yViolations } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Radio } from "./radio";

describe("Radio", () => {
  test("renders a real input[type=radio] plus a decorative circle", () => {
    const html = renderToStaticMarkup(
      <Radio name="type" label="Bundles" checked readOnly />,
    );
    expect(html).toContain('type="radio"');
    expect(html).toContain('name="type"');
    expect(html).toContain("cs-radio__circle");
    expect(html).toContain("Bundles");
  });

  test("bare control (no label) omits the label span", () => {
    const html = renderToStaticMarkup(
      <Radio name="type" aria-label="All" readOnly />,
    );
    expect(html).not.toContain("cs-radio__label");
  });

  test("has no axe violations for a grouped set", async () => {
    const html = renderToStaticMarkup(
      <fieldset>
        <legend>Type</legend>
        <Radio name="type" label="All" checked readOnly />
        <Radio name="type" label="Bundles" checked={false} readOnly />
      </fieldset>,
    );
    await expectNoA11yViolations(html);
  });
});
