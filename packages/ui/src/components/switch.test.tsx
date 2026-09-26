import { expectNoA11yViolations } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Switch } from "./switch";

describe("Switch", () => {
  test("renders role=switch with aria-checked reflecting state", () => {
    const on = renderToStaticMarkup(
      <Switch checked label="Has media" onCheckedChange={() => {}} />,
    );
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain("Has media");

    const off = renderToStaticMarkup(
      <Switch checked={false} label="Has media" onCheckedChange={() => {}} />,
    );
    expect(off).toContain('aria-checked="false"');
  });

  test("icon-only (no label) still requires an accessible name via aria-label", () => {
    const html = renderToStaticMarkup(
      <Switch checked aria-label="Dark mode" onCheckedChange={() => {}} />,
    );
    expect(html).not.toContain("cs-switch__label");
    expect(html).toContain('aria-label="Dark mode"');
  });

  test("has no axe violations, on and off, labelled and icon-only", async () => {
    await expectNoA11yViolations(
      renderToStaticMarkup(
        <Switch checked label="Notifications" onCheckedChange={() => {}} />,
      ),
    );
    await expectNoA11yViolations(
      renderToStaticMarkup(
        <Switch
          checked={false}
          aria-label="Dark mode"
          onCheckedChange={() => {}}
        />,
      ),
    );
  });
});
