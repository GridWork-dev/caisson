import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Dialog } from "./dialog";

describe("Dialog", () => {
  test("renders a native dialog labelled by its title, with a close button", () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="Settings">
        <p>Body</p>
      </Dialog>,
    );
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-label="Settings"');
    expect(html).toContain('data-variant="modal"');
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain("Body");
  });

  test("drawer variant carries a side", () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="Cart" variant="drawer" side="left">
        <p>x</p>
      </Dialog>,
    );
    expect(html).toContain('data-variant="drawer"');
    expect(html).toContain('data-side="left"');
  });

  test("hideHeader drops the default title/close chrome", () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="Custom" hideHeader>
        <p>only body</p>
      </Dialog>,
    );
    expect(html).not.toContain('aria-label="Close"');
    expect(html).toContain("only body");
  });
});
