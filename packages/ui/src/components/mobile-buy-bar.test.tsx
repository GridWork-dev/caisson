import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MobileBuyBar } from "./mobile-buy-bar";

describe("MobileBuyBar — sticky mobile purchase bar (ADR-0099 recipe)", () => {
  test("renders the label, the formatted price, and the passed action as-is", () => {
    const html = renderToStaticMarkup(
      <MobileBuyBar
        label="Field crypto"
        price="$149"
        action={<button type="button">Add to cart</button>}
      />,
    );
    expect(html).toContain("cs-mobile-buy-bar");
    expect(html).toContain(">Field crypto<");
    expect(html).toContain(">$149<");
    expect(html).toContain("cs-num");
    expect(html).toContain(">Add to cart<");
  });

  test("exposes an accessible region name derived from the label", () => {
    const html = renderToStaticMarkup(
      <MobileBuyBar label="Audit worm" price="$249" action={null} />,
    );
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Buy Audit worm"');
  });
});
