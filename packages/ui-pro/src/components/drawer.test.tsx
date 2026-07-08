import { expectNoA11yViolationsIn, renderIntoJsdom } from "@caisson/testing";
import { describe, expect, test } from "bun:test";
import { useState } from "react";

import { Drawer } from "./drawer";

function pressEscape(el: HTMLElement) {
  const win = el.ownerDocument.defaultView as unknown as typeof window;
  el.dispatchEvent(
    new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
}

function pressTab(el: HTMLElement, opts: { shiftKey?: boolean } = {}) {
  const win = el.ownerDocument.defaultView as unknown as typeof window;
  el.dispatchEvent(
    new win.KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: opts.shiftKey ?? false,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** A minimal controlled wrapper — Drawer is controlled-only (matches Popover/Menu). Drawer renders
 * no trigger of its own, so the test owns one (mirrors real usage — see `MobileNav`). */
function ControlledDrawer({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open menu
      </button>
      <Drawer open={open} onOpenChange={setOpen} aria-label="Primary (mobile)">
        <a href="#first">First link</a>
        <a href="#second">Second link</a>
      </Drawer>
    </>
  );
}

/** Opens the drawer with the trigger holding focus first, mirroring a real keyboard-driven open
 * (Drawer captures `document.activeElement` at open time to know where to return focus later). */
function openViaTrigger(container: HTMLElement, act: (fn: () => void) => void) {
  const trigger = container.querySelector("button")!;
  act(() => {
    trigger.focus();
    trigger.click();
  });
  return trigger;
}

describe("Drawer", () => {
  test("closed by default — no dialog mounted", () => {
    const { document, unmount } = renderIntoJsdom(<ControlledDrawer />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  test("opening moves focus to the first focusable element inside the panel", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledDrawer />,
    );
    openViaTrigger(container, act);

    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Primary (mobile)");
    expect(document.activeElement).toBe(
      document.querySelector('a[href="#first"]'),
    );

    unmount();
  });

  test("body scroll is locked while open and restored on close", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledDrawer />,
    );
    const trigger = openViaTrigger(container, act);
    expect(document.body.style.overflow).toBe("hidden");

    act(() => pressEscape(document.body));
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  test("Escape closes and returns focus to whatever had it before opening", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledDrawer />,
    );
    const trigger = openViaTrigger(container, act);

    act(() => pressEscape(document.body));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  test("clicking the scrim closes the drawer", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledDrawer />,
    );
    openViaTrigger(container, act);

    const scrim = document.querySelector(".cs-drawer-scrim") as HTMLElement;
    act(() => scrim.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    unmount();
  });

  test("clicking inside the panel does not close it (scrim click only)", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledDrawer />,
    );
    openViaTrigger(container, act);

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    act(() => dialog.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    unmount();
  });

  test("Tab and Shift+Tab wrap focus within the panel (trap, both directions)", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledDrawer />,
    );
    openViaTrigger(container, act);

    const first = document.querySelector('a[href="#first"]') as HTMLElement;
    const last = document.querySelector('a[href="#second"]') as HTMLElement;
    expect(document.activeElement).toBe(first);

    // Shift+Tab from the first focusable wraps to the last.
    act(() => pressTab(first, { shiftKey: true }));
    expect(document.activeElement).toBe(last);

    // Tab from the last focusable wraps back to the first.
    act(() => pressTab(last));
    expect(document.activeElement).toBe(first);

    unmount();
  });

  test("has no axe violations while open", async () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledDrawer />,
    );
    openViaTrigger(container, act);
    await expectNoA11yViolationsIn(document.body);
    unmount();
  });
});
