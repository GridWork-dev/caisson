import { renderIntoJsdom } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Dialog, lockBodyScroll, unlockBodyScroll } from "./dialog";

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

  // renderIntoJsdom stubs HTMLDialogElement's showModal()/close() (jsdom doesn't implement
  // them), so a real <Dialog> can be mounted here to exercise the effect wiring end-to-end,
  // rather than only the helper functions in isolation below.
  describe("body scroll-lock via a mounted Dialog (IN-08 wiring)", () => {
    test("mounting <Dialog open> locks scroll; unmounting while open restores it", () => {
      const { document, unmount } = renderIntoJsdom(
        <Dialog open onClose={() => {}} title="x">
          <p>body</p>
        </Dialog>,
      );
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(document.body.style.overflow).toBe("");
    });

    test("closing via the open prop restores scroll without unmounting", () => {
      const { document, rerender, unmount } = renderIntoJsdom(
        <Dialog open onClose={() => {}} title="x">
          <p>body</p>
        </Dialog>,
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Dialog open={false} onClose={() => {}} title="x">
          <p>body</p>
        </Dialog>,
      );
      expect(document.body.style.overflow).toBe("");
      unmount();
    });

    test("two open dialogs share one lock — closing one leaves scroll locked, closing both restores it", () => {
      const { document, rerender, unmount } = renderIntoJsdom(
        <>
          <Dialog open onClose={() => {}} title="a">
            <p>a</p>
          </Dialog>
          <Dialog open onClose={() => {}} title="b">
            <p>b</p>
          </Dialog>
        </>,
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <>
          <Dialog open onClose={() => {}} title="a">
            <p>a</p>
          </Dialog>
          <Dialog open={false} onClose={() => {}} title="b">
            <p>b</p>
          </Dialog>
        </>,
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <>
          <Dialog open={false} onClose={() => {}} title="a">
            <p>a</p>
          </Dialog>
          <Dialog open={false} onClose={() => {}} title="b">
            <p>b</p>
          </Dialog>
        </>,
      );
      expect(document.body.style.overflow).toBe("");
      unmount();
    });
  });

  // Direct unit coverage of the counted lock/restore mechanics themselves.
  describe("body scroll-lock (IN-08)", () => {
    test("locks on first call, restores the prior value once fully unlocked", () => {
      const { document, unmount } = renderIntoJsdom(<div />);
      document.body.style.overflow = "auto";

      lockBodyScroll();
      expect(document.body.style.overflow).toBe("hidden");

      unlockBodyScroll();
      expect(document.body.style.overflow).toBe("auto");
      unmount();
    });

    test("nested locks only restore after every lock is released", () => {
      const { document, unmount } = renderIntoJsdom(<div />);
      document.body.style.overflow = "";

      lockBodyScroll();
      lockBodyScroll();
      expect(document.body.style.overflow).toBe("hidden");

      unlockBodyScroll();
      expect(document.body.style.overflow).toBe("hidden");

      unlockBodyScroll();
      expect(document.body.style.overflow).toBe("");
      unmount();
    });

    test("unlockBodyScroll never goes negative on an extra call", () => {
      const { document, unmount } = renderIntoJsdom(<div />);
      document.body.style.overflow = "scroll";

      lockBodyScroll();
      unlockBodyScroll();
      unlockBodyScroll();
      expect(document.body.style.overflow).toBe("scroll");

      lockBodyScroll();
      expect(document.body.style.overflow).toBe("hidden");
      unlockBodyScroll();
      unmount();
    });
  });
});
