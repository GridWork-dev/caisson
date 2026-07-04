import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Terminal } from "./terminal";

describe("Terminal — recipe primitive (ADR-0099)", () => {
  test("body renders inside a non-scrolling .cs-terminal__body-frame wrapper", () => {
    const html = renderToStaticMarkup(
      <Terminal label="shell">bun run check</Terminal>,
    );
    expect(html).toContain("cs-terminal__bar");
    expect(html).toContain('class="cs-terminal__body-frame"');
    expect(html).toContain("cs-terminal__body");
    expect(html).toContain("bun run check");
    // the frame wraps the body pre — not the other way around
    expect(html.indexOf("cs-terminal__body-frame")).toBeLessThan(
      html.indexOf(">bun run check<"),
    );
  });
});
