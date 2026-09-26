import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import PrivacyPage from "../app/legal/privacy/page";
import TermsPage from "../app/legal/terms/page";
import SupportPage, {
  metadata as supportMetadata,
} from "../app/(marketing)/support/page";

// The public help + legal pages the open-source site keeps. Nothing on them may point at a
// purchase path, the retired commerce routes, or the payment processor.
const RETIRED = [
  "paddle",
  "checkout",
  "/legal/eula",
  "/legal/license",
  "/legal/refunds",
  "order number",
];

describe("public support + legal pages", () => {
  test("support exposes a direct support route without promising a ticket portal", () => {
    const html = renderToStaticMarkup(<SupportPage />);

    expect(supportMetadata.alternates?.canonical).toContain("/support");
    expect(html).toContain("support@caisson.sh");
    expect(html).toContain("Security reports");
    expect(html).toContain("security@caisson.sh");
    expect(html).not.toContain("Open a ticket");
  });

  test("the terms point help at the public support address", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("mailto:support@caisson.sh");
    expect(html).not.toContain("mailto:admin@caisson.sh");
  });

  test("no page names the payment processor, a purchase path, or a retired route", () => {
    for (const [name, Page] of [
      ["support", SupportPage],
      ["terms", TermsPage],
      ["privacy", PrivacyPage],
    ] as const) {
      const html = renderToStaticMarkup(<Page />).toLowerCase();
      for (const retired of RETIRED) {
        expect(`${name}: ${retired} ${html.includes(retired)}`).toBe(
          `${name}: ${retired} false`,
        );
      }
      expect(html.match(/\$\d/g)).toBeNull();
    }
  });
});
