import { expectNoA11yViolations } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Accordion } from "./accordion";

const ITEMS = [
  { id: "a", trigger: "What is Caisson?", content: "A component kit." },
  { id: "b", trigger: "Is it open source?", content: "The base is." },
];

describe("Accordion", () => {
  test("renders a <details>/<summary> per item, closed by default", () => {
    const html = renderToStaticMarkup(<Accordion items={ITEMS} />);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("What is Caisson?");
    expect(html).toContain("A component kit.");
    expect(html).not.toContain('open=""');
  });

  test("defaultOpen opens that item", () => {
    const html = renderToStaticMarkup(
      <Accordion items={[{ ...ITEMS[0]!, defaultOpen: true }]} />,
    );
    expect(html).toContain('open=""');
  });

  test("type=single groups items under one exclusive native name", () => {
    const html = renderToStaticMarkup(
      <Accordion items={ITEMS} type="single" name="faq-group" />,
    );
    expect(html.match(/name="faq-group"/g)?.length).toBe(2);
  });

  test("has no axe violations, multiple and single", async () => {
    await expectNoA11yViolations(
      renderToStaticMarkup(<Accordion items={ITEMS} />),
    );
    await expectNoA11yViolations(
      renderToStaticMarkup(
        <Accordion items={ITEMS} type="single" name="faq" />,
      ),
    );
  });
});
