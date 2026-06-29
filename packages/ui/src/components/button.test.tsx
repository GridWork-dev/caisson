import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "./button";

describe("Button — recipe reference (ADR-0099)", () => {
  test("native <button>: data-* variants + type=button by default", () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" size="sm">
        Go
      </Button>,
    );
    expect(html).toContain("<button");
    expect(html).toContain("cs-button");
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain('data-size="sm"');
    expect(html).toContain('type="button"');
    expect(html).toContain(">Go</button>");
  });

  test("asChild: Radix Slot merges kit props onto the slotted element (framework-agnostic nav seam)", () => {
    const html = renderToStaticMarkup(
      <Button asChild variant="primary">
        <a href="/pricing">Pricing</a>
      </Button>,
    );
    expect(html).toContain("<a ");
    expect(html).toContain('href="/pricing"');
    expect(html).toContain("cs-button");
    expect(html).toContain('data-variant="primary"');
    // the slotted <a> replaced the default <button>, and carries no stray type attr
    expect(html).not.toContain("<button");
  });
});
