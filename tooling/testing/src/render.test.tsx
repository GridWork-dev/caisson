import { describe, expect, test } from "bun:test";
import { useState } from "react";
import { createPortal } from "react-dom";

import { renderIntoJsdom } from "./render.ts";

function Counter() {
  const [n, setN] = useState(0);
  return (
    <button type="button" onClick={() => setN((v) => v + 1)}>
      count: {n}
    </button>
  );
}

function Portaled() {
  return (
    <div>
      <span>host</span>
      {createPortal(
        <div id="portal-target">portal content</div>,
        document.body,
      )}
    </div>
  );
}

describe("renderIntoJsdom", () => {
  test("mounts a real client tree and reflects DOM updates from event dispatch", () => {
    const { document: doc, act, unmount } = renderIntoJsdom(<Counter />);
    const button = doc.querySelector("button");
    expect(button?.textContent).toContain("count: 0");

    act(() => {
      button?.dispatchEvent(
        new doc.defaultView!.MouseEvent("click", { bubbles: true }),
      );
    });
    expect(button?.textContent).toContain("count: 1");

    unmount();
  });

  test("createPortal content lands in document.body, outside the container", () => {
    const { document: doc, container, unmount } = renderIntoJsdom(<Portaled />);
    expect(container.querySelector("span")?.textContent).toBe("host");
    expect(container.querySelector("#portal-target")).toBeNull();
    expect(doc.body.querySelector("#portal-target")?.textContent).toBe(
      "portal content",
    );

    unmount();
  });
});
