import { expectNoA11yViolationsIn, renderIntoJsdom } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { useState } from "react";

import { Popover } from "./popover";

function pressEscape(el: HTMLElement) {
  const win = el.ownerDocument.defaultView as unknown as typeof window;
  el.dispatchEvent(
    new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
}

function pointerDownOutside(doc: Document) {
  const win = doc.defaultView as unknown as typeof window;
  doc.body.dispatchEvent(
    new win.PointerEvent("pointerdown", { bubbles: true }),
  );
}

/** A minimal controlled wrapper — Popover is controlled-only (matches Dialog/Tabs). */
function ControlledPopover({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <Popover trigger="Filters" open={open} onOpenChange={setOpen}>
      <p>Panel content</p>
    </Popover>
  );
}

describe("Popover", () => {
  test("closed by default — trigger has aria-expanded=false, no panel mounted", () => {
    const { container, document, unmount } = renderIntoJsdom(
      <ControlledPopover />,
    );
    const trigger = container.querySelector("button")!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(
      document.querySelector("#" + trigger.getAttribute("aria-controls")),
    ).toBeNull();
    unmount();
  });

  test("click opens; trigger aria-expanded flips and the panel is aria-controls-linked", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledPopover />,
    );
    const trigger = container.querySelector("button")!;

    act(() => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panelId = trigger.getAttribute("aria-controls")!;
    const panel = document.getElementById(panelId);
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toBe("Panel content");

    unmount();
  });

  test("Escape closes and returns focus to the trigger", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledPopover />,
    );
    const trigger = container.querySelector("button")!;
    act(() => trigger.click());
    const panelId = trigger.getAttribute("aria-controls")!;

    act(() => pressEscape(trigger));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(panelId)).toBeNull();
    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  test("opening via keyboard moves focus into the panel (WCAG 2.4.3 — portal tab order)", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledPopover />,
    );
    const trigger = container.querySelector("button")!;

    // A keyboard activation (Enter/Space) fires the same click event a real browser would.
    act(() => trigger.click());
    const panelId = trigger.getAttribute("aria-controls")!;
    const panel = document.getElementById(panelId);

    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);

    unmount();
  });

  test("a pointerdown outside the trigger+panel closes it", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledPopover />,
    );
    const trigger = container.querySelector("button")!;
    act(() => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    act(() => pointerDownOutside(document));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    unmount();
  });

  test("has no axe violations while open", async () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledPopover />,
    );
    act(() => container.querySelector("button")!.click());
    await expectNoA11yViolationsIn(document.body);
    unmount();
  });
});
