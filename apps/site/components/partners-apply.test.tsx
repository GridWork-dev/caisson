import { renderIntoJsdom } from "@caisson/testing";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import PartnersPage from "../app/(marketing)/partners/page";

// Two properties, and the click test is the load-bearing one: a markup assertion cannot see an
// onClick, so without a real DOM click, deleting both handlers from partners-apply.tsx would leave
// every other assertion here green. The `source` split is the whole reason to fire an event rather
// than read pageviews, so it is asserted per surface.
const trackEvent = mock((_name: string, _props?: Record<string, string>) => {
  /* recorded, never sent */
});
mock.module("@/lib/analytics", () => ({ trackEvent }));

const { PartnersApplyButton, PartnersApplyLink } =
  await import("./partners-apply");

const APPLY_HREF =
  "mailto:support@caisson.sh?subject=Caisson%20design-partner%20application";

/** Click the component's anchor, swallowing the navigation jsdom cannot perform. */
function clickAnchor(root: ReturnType<typeof renderIntoJsdom>): void {
  const anchor = root.document.querySelector("a");
  expect(anchor?.getAttribute("href")).toBe(APPLY_HREF);
  root.document.addEventListener("click", (e) => {
    e.preventDefault();
  });
  root.act(() => {
    anchor?.dispatchEvent(
      new root.document.defaultView!.MouseEvent("click", { bubbles: true }),
    );
  });
}

beforeEach(() => {
  trackEvent.mockClear();
});

describe("/partners application links", () => {
  test("the CTA fires one partners_apply_click tagged cta", () => {
    const root = renderIntoJsdom(
      <PartnersApplyButton>Apply by email</PartnersApplyButton>,
    );
    try {
      clickAnchor(root);
      expect(trackEvent).toHaveBeenCalledTimes(1);
      expect(trackEvent.mock.calls[0]).toEqual([
        "partners_apply_click",
        { source: "cta" },
      ]);
    } finally {
      root.unmount();
    }
  });

  test("the prose link fires one partners_apply_click tagged prose", () => {
    const root = renderIntoJsdom(
      <PartnersApplyLink>support@caisson.sh</PartnersApplyLink>,
    );
    try {
      clickAnchor(root);
      expect(trackEvent).toHaveBeenCalledTimes(1);
      expect(trackEvent.mock.calls[0]).toEqual([
        "partners_apply_click",
        { source: "prose" },
      ]);
    } finally {
      root.unmount();
    }
  });

  // Instrumenting the page must not cost the no-JS path: the href is a real mailto in the static
  // markup, so a visitor with JS off (or with the Plausible env unset) still gets a working
  // application link. The event is additive, never the mechanism.
  test("the server-rendered page keeps both mailto fallbacks", () => {
    const html = renderToStaticMarkup(<PartnersPage />);

    expect(html.split(`href="${APPLY_HREF}"`).length - 1).toBe(2);
  });
});
