import { expectNoA11yViolations } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Badge } from "./badge";

describe("Badge", () => {
  test("renders text content with a neutral/md default", () => {
    const html = renderToStaticMarkup(<Badge>New</Badge>);
    expect(html).toContain("cs-badge");
    expect(html).toContain('data-tone="neutral"');
    expect(html).toContain('data-size="md"');
    expect(html).toContain("New");
  });

  test("tone + size render as data-* attributes", () => {
    const html = renderToStaticMarkup(
      <Badge tone="success" size="sm">
        Active
      </Badge>,
    );
    expect(html).toContain('data-tone="success"');
    expect(html).toContain('data-size="sm"');
  });

  test("has no axe violations", async () => {
    await expectNoA11yViolations(
      renderToStaticMarkup(<Badge tone="danger">3</Badge>),
    );
  });
});
