import { expectNoA11yViolationsIn, renderIntoJsdom } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { useState } from "react";

import { Menu } from "./menu";
import type { MenuItemSpec } from "./menu";

function press(el: HTMLElement, key: string) {
  const win = el.ownerDocument.defaultView as unknown as typeof window;
  el.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true }));
}

function ControlledMenu({ items }: { items: readonly MenuItemSpec[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Menu trigger="Actions" items={items} open={open} onOpenChange={setOpen} />
  );
}

function makeItems(onSelect: (id: string) => void): MenuItemSpec[] {
  return [
    { id: "rename", label: "Rename", onSelect: () => onSelect("rename") },
    {
      id: "archive",
      label: "Archive",
      onSelect: () => onSelect("archive"),
      disabled: true,
    },
    {
      id: "delete",
      label: "Delete",
      onSelect: () => onSelect("delete"),
      danger: true,
    },
  ];
}

describe("Menu", () => {
  test("closed by default — trigger has aria-haspopup=menu, aria-expanded=false", () => {
    const { container, unmount } = renderIntoJsdom(
      <ControlledMenu items={makeItems(() => {})} />,
    );
    const trigger = container.querySelector("button")!;
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    unmount();
  });

  test("click opens the menu and moves focus to the first enabled item", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledMenu items={makeItems(() => {})} />,
    );
    const trigger = container.querySelector("button")!;
    act(() => trigger.click());

    const menu = document.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    const items = document.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(3);
    expect(document.activeElement?.textContent).toBe("Rename");

    unmount();
  });

  test("ArrowDown/ArrowUp roves focus among items, wrapping at the ends", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledMenu items={makeItems(() => {})} />,
    );
    act(() => container.querySelector("button")!.click());
    expect(document.activeElement?.textContent).toBe("Rename");

    act(() => press(document.activeElement as HTMLElement, "ArrowDown"));
    // "Archive" is disabled and skipped — lands on "Delete".
    expect(document.activeElement?.textContent).toBe("Delete");

    act(() => press(document.activeElement as HTMLElement, "ArrowDown"));
    expect(document.activeElement?.textContent).toBe("Rename");

    act(() => press(document.activeElement as HTMLElement, "ArrowUp"));
    expect(document.activeElement?.textContent).toBe("Delete");

    unmount();
  });

  test("clicking an item calls onSelect, closes the menu, and returns focus to the trigger", () => {
    const selected: string[] = [];
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledMenu items={makeItems((id) => selected.push(id))} />,
    );
    const trigger = container.querySelector("button")!;
    act(() => trigger.click());
    const deleteItem = [...document.querySelectorAll('[role="menuitem"]')].find(
      (el) => el.textContent === "Delete",
    ) as HTMLElement;

    act(() => deleteItem.click());
    expect(selected).toEqual(["delete"]);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  test("Escape closes and returns focus to the trigger", () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledMenu items={makeItems(() => {})} />,
    );
    const trigger = container.querySelector("button")!;
    act(() => trigger.click());
    act(() => press(document.activeElement as HTMLElement, "Escape"));

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  test("has no axe violations while open", async () => {
    const { container, document, act, unmount } = renderIntoJsdom(
      <ControlledMenu items={makeItems(() => {})} />,
    );
    act(() => container.querySelector("button")!.click());
    await expectNoA11yViolationsIn(document.body);
    unmount();
  });
});
