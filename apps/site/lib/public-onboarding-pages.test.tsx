import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import RefundsPage, {
  metadata as refundsMetadata,
} from "../app/legal/refunds/page";
import TermsPage from "../app/legal/terms/page";
import SupportPage, {
  metadata as supportMetadata,
} from "../app/(marketing)/support/page";

describe("public Paddle onboarding pages", () => {
  test("refunds publishes the unconditional 14-day policy and both request paths", () => {
    const html = renderToStaticMarkup(<RefundsPage />);

    expect(refundsMetadata.alternates?.canonical).toContain("/legal/refunds");
    expect(html).toContain("14-day money-back guarantee");
    expect(html).toContain("regardless of location");
    expect(html).toContain("mailto:support@caisson.sh");
    expect(html).toContain("https://paddle.net");
    expect(html).toContain("original payment method");
    expect(html).toContain("revokes the license entitlement");
    expect(html).toContain("removes any unused credits");
  });

  test("support exposes a direct buyer-support route without promising a ticket portal", () => {
    const html = renderToStaticMarkup(<SupportPage />);

    expect(supportMetadata.alternates?.canonical).toContain("/support");
    expect(html).toContain("support@caisson.sh");
    expect(html).toContain("order number");
    expect(html).toContain("Security reports");
    expect(html).toContain("security@caisson.sh");
    expect(html).not.toContain("Open a ticket");
  });

  test("the terms point buyer and refund help at the public support address", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("mailto:support@caisson.sh");
    expect(html).not.toContain("mailto:admin@caisson.sh");
  });
});
