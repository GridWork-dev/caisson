import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

import PartnersPage from "../app/(marketing)/partners/page";
import { PartnersApplyButton, PartnersApplyLink } from "./partners-apply";

// D12 item 4: instrumenting /partners must not cost the no-JS path. The tracked components carry
// the real `mailto:` in their markup, so a visitor with JS off (or with the Plausible env unset)
// still gets a working application link — the event is additive, never the mechanism.
const APPLY_HREF =
  "mailto:support@caisson.sh?subject=Caisson%20design-partner%20application";

const PAGE_SOURCE = readFileSync(
  fileURLToPath(
    new URL("../app/(marketing)/partners/page.tsx", import.meta.url),
  ),
  "utf8",
);

describe("/partners application links", () => {
  test("both tracked components render the real mailto href", () => {
    expect(
      renderToStaticMarkup(<PartnersApplyLink>email us</PartnersApplyLink>),
    ).toContain(`href="${APPLY_HREF}"`);
    expect(
      renderToStaticMarkup(<PartnersApplyButton>Apply</PartnersApplyButton>),
    ).toContain(`href="${APPLY_HREF}"`);
  });

  test("the server-rendered page keeps both mailto fallbacks", () => {
    const html = renderToStaticMarkup(<PartnersPage />);
    const hrefs = html.split(`href="${APPLY_HREF}"`).length - 1;

    expect(hrefs).toBe(2);
  });

  test("the page routes every application link through the tracked components", () => {
    // The regression this guards: re-adding a bare `<a href="mailto:…">` silently drops the
    // signal again (zero sends stayed indistinguishable from zero page traffic). A rendered-markup
    // assertion cannot see it — renderToStaticMarkup drops onClick — so check the source shape.
    expect(PAGE_SOURCE).not.toContain('href="mailto:');
    expect(PAGE_SOURCE).toContain("<PartnersApplyLink>");
    expect(PAGE_SOURCE).toContain("<PartnersApplyButton>");
  });
});
