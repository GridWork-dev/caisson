import { expectNoA11yViolationsIn, renderIntoJsdom } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";

import { Tooltip } from "./tooltip";

function pressEscape(el: HTMLElement) {
  const win = el.ownerDocument.defaultView as unknown as typeof window;
  el.dispatchEvent(
    new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
}

describe("Tooltip", () => {
  test("closed by default — no tooltip panel in the document", () => {
    const { document, unmount } = renderIntoJsdom(
      <Tooltip content="Explains the thing">
        <button type="button">?</button>
      </Tooltip>,
    );
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    unmount();
  });

  test("focus opens immediately and wires aria-describedby; blur closes", () => {
    const { document, container, act, unmount } = renderIntoJsdom(
      <Tooltip content="Explains the thing">
        <button type="button">?</button>
      </Tooltip>,
    );
    const trigger = container.querySelector("button")!;

    act(() => trigger.focus());
    const panel = document.querySelector('[role="tooltip"]');
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toBe("Explains the thing");
    expect(trigger.getAttribute("aria-describedby")).toBe(panel!.id);

    act(() => trigger.blur());
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    unmount();
  });

  test("Escape on the trigger closes an open tooltip", () => {
    const { document, container, act, unmount } = renderIntoJsdom(
      <Tooltip content="Explains the thing">
        <button type="button">?</button>
      </Tooltip>,
    );
    const trigger = container.querySelector("button")!;
    act(() => trigger.focus());
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();

    act(() => pressEscape(trigger));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    unmount();
  });

  test("has no axe violations while open", async () => {
    const { document, container, act, unmount } = renderIntoJsdom(
      <Tooltip content="Explains the thing">
        <button type="button" aria-label="Info">
          ?
        </button>
      </Tooltip>,
    );
    act(() => container.querySelector("button")!.focus());
    await expectNoA11yViolationsIn(document.body);
    unmount();
  });
});
