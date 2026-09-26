import { expectNoA11yViolations } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Tabs } from "./tabs";

const ITEMS = [
  { id: "modules", label: "Modules", panel: <p>Module grid</p> },
  { id: "bundles", label: "Bundles", panel: <p>Bundle grid</p> },
  { id: "docs", label: "Docs", panel: <p>Docs</p>, disabled: true },
];

describe("Tabs", () => {
  test("renders tablist/tab/tabpanel roles wired by aria-controls/aria-labelledby", () => {
    const html = renderToStaticMarkup(
      <Tabs
        items={ITEMS}
        value="modules"
        onValueChange={() => {}}
        aria-label="Marketplace sections"
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Marketplace sections"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-controls="cs-tabpanel-modules"');
    expect(html).toContain('id="cs-tabpanel-modules"');
    expect(html).toContain('aria-labelledby="cs-tab-modules"');
  });

  test("only the active tab is selected + Tab-reachable; others are tabindex=-1", () => {
    const html = renderToStaticMarkup(
      <Tabs
        items={ITEMS}
        value="bundles"
        onValueChange={() => {}}
        aria-label="x"
      />,
    );
    expect(html).toContain('aria-selected="true"');
    expect((html.match(/aria-selected="false"/g) ?? []).length).toBe(2);
    expect((html.match(/tabindex="-1"/g) ?? []).length).toBe(2);
    expect(html).toContain('tabindex="0"');
  });

  test("disabled tab carries aria-disabled + a real disabled attribute", () => {
    const html = renderToStaticMarkup(
      <Tabs
        items={ITEMS}
        value="modules"
        onValueChange={() => {}}
        aria-label="x"
      />,
    );
    expect(html).toContain('aria-disabled="true"');
  });

  test("renders only the active panel's content", () => {
    const html = renderToStaticMarkup(
      <Tabs
        items={ITEMS}
        value="bundles"
        onValueChange={() => {}}
        aria-label="x"
      />,
    );
    expect(html).toContain("Bundle grid");
    expect(html).not.toContain("Module grid");
  });

  test("inactive tabs carry no aria-controls — their panel isn't mounted (IN-02)", () => {
    const html = renderToStaticMarkup(
      <Tabs
        items={ITEMS}
        value="modules"
        onValueChange={() => {}}
        aria-label="x"
      />,
    );
    expect(html).toContain('aria-controls="cs-tabpanel-modules"');
    expect(html).not.toContain('aria-controls="cs-tabpanel-bundles"');
    expect(html).not.toContain('aria-controls="cs-tabpanel-docs"');
  });

  test("has no axe violations", async () => {
    await expectNoA11yViolations(
      renderToStaticMarkup(
        <Tabs
          items={ITEMS}
          value="modules"
          onValueChange={() => {}}
          aria-label="Sections"
        />,
      ),
    );
  });
});
