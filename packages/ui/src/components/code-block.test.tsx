import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CodeBlock } from "./code-block";

describe("CodeBlock — recipe primitive (ADR-0099)", () => {
  test("default: bare <pre class=cs-code> sits inside a non-scrolling .cs-code-frame wrapper", () => {
    const html = renderToStaticMarkup(<CodeBlock code="bun install" />);
    expect(html).toContain('class="cs-code-frame"');
    expect(html).toContain('class="cs-code"');
    expect(html).toContain("bun install");
    // the frame wraps the pre — not the other way around
    expect(html.indexOf("cs-code-frame")).toBeLessThan(
      html.indexOf(">bun install<"),
    );
  });

  test("frame=true defers entirely to <Terminal> — no .cs-code-frame in this branch", () => {
    const html = renderToStaticMarkup(
      <CodeBlock frame code="bun install" label="shell" />,
    );
    expect(html).toContain("cs-terminal");
    expect(html).not.toContain("cs-code-frame");
  });
});
