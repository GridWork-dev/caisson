import { expectNoA11yViolations } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  test("renders a real input[type=checkbox] plus a decorative box", () => {
    const html = renderToStaticMarkup(
      <Checkbox label="Has media" checked readOnly />,
    );
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("cs-checkbox__box");
    expect(html).toContain("Has media");
  });

  test("bare control (no label) omits the label span", () => {
    const html = renderToStaticMarkup(
      <Checkbox aria-label="Select" readOnly />,
    );
    expect(html).not.toContain("cs-checkbox__label");
    expect(html).toContain('aria-label="Select"');
  });

  test("disabled sets data-disabled on the wrapper and disables the input", () => {
    const html = renderToStaticMarkup(<Checkbox label="x" disabled readOnly />);
    expect(html).toContain("data-disabled");
    expect(html).toContain('disabled=""');
  });

  test("has no axe violations, checked and unchecked", async () => {
    await expectNoA11yViolations(
      renderToStaticMarkup(<Checkbox label="Category" checked readOnly />),
    );
    await expectNoA11yViolations(
      renderToStaticMarkup(
        <Checkbox label="Category" checked={false} readOnly />,
      ),
    );
  });
});
