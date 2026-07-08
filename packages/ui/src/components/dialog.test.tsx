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

  test("drawer variant supports a top side, for a nav sheet under a fixed header", () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="Menu" variant="drawer" side="top">
        <p>x</p>
      </Dialog>,
    );
    expect(html).toContain('data-side="top"');
  });

  test("className merges onto the dialog element alongside the base class", () => {
    const html = renderToStaticMarkup(
      <Dialog
        open
        onClose={() => {}}
        title="Menu"
        className="cs-mobile-nav-drawer"
      >
        <p>x</p>
      </Dialog>,
    );
    expect(html).toContain('class="cs-dialog cs-mobile-nav-drawer"');
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
