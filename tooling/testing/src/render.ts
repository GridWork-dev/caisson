import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";

export interface JsdomRender {
  dom: JSDOM;
  document: Document;
  container: HTMLElement;
  root: Root;
  /** Wraps a state-changing interaction (a real DOM event dispatch, a prop update via `rerender`)
   * so React flushes effects before the caller asserts. */
  act: (fn: () => void) => void;
  rerender: (next: ReactElement) => void;
  /** Unmounts, closes the JSDOM window, and restores every global this call overwrote — MUST be
   * called (in a `finally`, ideally) or a later test in the same process inherits a closed,
   * torn-down `document`/`window` and fails with unrelated-looking DOM errors. */
  unmount: () => void;
}

const GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "Node",
  "Element",
  "HTMLElement",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;

/**
 * Mounts a real React client tree (`createRoot` + `act`) into a fresh JSDOM window — needed for
 * the kit's focus-managed primitives (Tooltip/Popover/Menu, ADR-0291): `renderToStaticMarkup`
 * cannot render them at all (React's server renderer throws on a `createPortal`), and their
 * open/close, keyboard nav, and focus-management behavior only exists once effects run, which SSR
 * never does. `react-dom`'s client renderer reads its environment off ambient globals rather than
 * the target container's `ownerDocument`, so `window`/`document`/etc. are set on `globalThis` for
 * the duration of the render (this is the same non-isolated-global constraint `jest-environment-
 * jsdom` papers over; there is no portable way to scope it to one JSDOM instance without pulling in
 * a full test-environment package) — `unmount()` restores every one of them, which matters because
 * bun:test runs a directory's test files in one shared process: a leaked global `document` from a
 * closed JSDOM window breaks the NEXT file's axe-core calls with an unrelated-looking DOM error.
 */
export function renderIntoJsdom(element: ReactElement): JsdomRender {
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', {
    url: "http://localhost/",
    // pretendToBeVisual: JSDOM omits requestAnimationFrame/cancelAnimationFrame without it —
    // react-dom's client renderer schedules work through them.
    pretendToBeVisual: true,
  });

  // jsdom reflects HTMLDialogElement's `open` attribute but doesn't implement showModal()/close()
  // at all (its impl class is an empty HTMLElement subclass) — a mount of a component built on the
  // native <dialog> (e.g. @caisson-sh/ui's Dialog) throws TypeError without this. Stubbed with just
  // enough behavior (flip `open`, fire the native `close` event) for effect-driven open/close tests.
  const dialogProto = dom.window.HTMLDialogElement.prototype;
  if (!dialogProto.showModal) {
    dialogProto.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
    dialogProto.close = function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new dom.window.Event("close"));
    };
  }

  const g = globalThis as unknown as Record<string, unknown>;
  const saved: Record<string, unknown> = {};
  for (const key of GLOBAL_KEYS) saved[key] = g[key];

  g.window = dom.window;
  g.document = dom.window.document;
  g.navigator = dom.window.navigator;
  g.Node = dom.window.Node;
  g.Element = dom.window.Element;
  g.HTMLElement = dom.window.HTMLElement;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const container = dom.window.document.getElementById("root");
  if (!container) throw new Error("renderIntoJsdom: #root container missing");

  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(element);
  });

  return {
    dom,
    document: dom.window.document,
    container,
    root,
    act: (fn) => act(fn),
    rerender: (next) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      dom.window.close();
      for (const key of GLOBAL_KEYS) g[key] = saved[key];
    },
  };
}
