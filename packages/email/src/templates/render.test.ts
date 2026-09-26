import { describe, expect, test } from "bun:test";
import {
  EMAIL_TEMPLATE_IDS,
  renderEmailTemplate,
  tryRenderEmailTemplate,
  type EmailTemplateId,
  type TemplateDataMap,
} from "./index.ts";
import { BRAND_COLOR_DARK } from "./layout.tsx";

const URL = "https://caisson.sh/action?token=sample";

const SAMPLE: { [K in EmailTemplateId]: TemplateDataMap[K] } = {
  "magic-link": { url: URL },
  "password-reset": { url: URL },
  "verify-email": { url: URL },
  "credits-expiring": { credits: 120, expiresOn: "2027-07-06", url: URL },
  "updates-window-expiring": {
    entitlementId: "compliance",
    expiresOn: "2027-07-06",
    url: URL,
  },
  "purchase-confirmation": {
    buyerName: "Ada",
    orderId: "ord_sample",
    currency: "usd",
    amountTotalMinor: 79900,
    lines: [{ label: "Compliance bundle", amountMinor: 79900 }],
    dashboardUrl: URL,
  },
  "subscription-payment-received": {
    buyerName: "Ada",
    orderId: "txn_cycle_sample",
    currency: "usd",
    amountTotalMinor: 149900,
    lines: [{ label: "Compliance Updates" }],
    dashboardUrl: URL,
  },
  "renewal-confirmation": {
    buyerName: "Ada",
    orderId: "ord_ren_sample",
    currency: "usd",
    amountTotalMinor: 29900,
    lines: [{ label: "Compliance bundle", newWindowEnd: "2027-07-06" }],
    dashboardUrl: URL,
  },
  "access-revoked": {
    buyerName: "Ada",
    reason: "refund",
    dashboardUrl: URL,
  },
  "waitlist-welcome": { email: "founder@acme.com", bundle: "Compliance" },
  "nurture-follow-up": { email: "cto@acme.com", bundle: "Compliance" },
  "abandoned-checkout": {
    buyerName: "Ada",
    lines: [{ label: "Compliance bundle" }],
    url: URL,
  },
};

describe("renderEmailTemplate", () => {
  for (const id of EMAIL_TEMPLATE_IDS) {
    test(`${id}: html and text carry the expected link, subject is non-empty`, async () => {
      const data = SAMPLE[id];
      const rendered = await renderEmailTemplate(id, data);
      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.html).toContain("Caisson");
      // Most templates carry the sample one-time action/dashboard URL; the two growth emails link
      // a fixed docs URL instead (neither `url` nor `dashboardUrl` — see their own tests below).
      const expectedUrl =
        "url" in data || "dashboardUrl" in data
          ? URL
          : "https://caisson.sh/docs";
      expect(rendered.html).toContain(expectedUrl);
      expect(rendered.text).toContain(expectedUrl);
      // The HTML and text fallback are rendered from the SAME element — never drift.
      expect(rendered.text).not.toContain("<html");
    });

    test(`${id}: carries the dark-mode color-scheme metas and prefers-color-scheme palette`, async () => {
      const rendered = await renderEmailTemplate(id, SAMPLE[id]);
      // The hybrid dark-mode contract (layout.tsx): both scheme metas present…
      expect(rendered.html).toContain('name="color-scheme"');
      expect(rendered.html).toContain('name="supported-color-schemes"');
      // …and the author dark palette, keyed off the layout classes with !important
      // (inline light styles otherwise always win).
      expect(rendered.html).toContain("@media (prefers-color-scheme: dark)");
      expect(rendered.html).toContain(BRAND_COLOR_DARK.bg);
      expect(rendered.html).toContain(BRAND_COLOR_DARK.fg);
      expect(rendered.html).toMatch(/\.em-body[^{]*\{[^}]*!important/);
    });
  }

  test("credits-expiring: dynamic subject and body carry the count + date (ADR-0252)", async () => {
    const rendered = await renderEmailTemplate("credits-expiring", {
      credits: 120,
      expiresOn: "2027-07-06",
      url: URL,
    });
    expect(rendered.subject).toBe("120 credits expire on 2027-07-06");
    expect(rendered.html).toContain("120");
    expect(rendered.html).toContain("2027-07-06");
    expect(rendered.text).toContain("burn first");
  });

  test("updates-window-expiring: dynamic subject and body carry the label + date (G24)", async () => {
    const rendered = await renderEmailTemplate("updates-window-expiring", {
      entitlementId: "field-crypto",
      expiresOn: "2027-08-01",
      url: URL,
    });
    expect(rendered.subject).toBe(
      "Your Field Crypto updates window ends 2027-08-01",
    );
    expect(rendered.html).toContain("Field Crypto");
    expect(rendered.html).toContain("2027-08-01");
    expect(rendered.text).toContain("keeps working");
  });

  test("purchase-confirmation: subject + body carry the order id, line items, and total", async () => {
    const rendered = await renderEmailTemplate("purchase-confirmation", {
      buyerName: "Ada",
      orderId: "ord_42",
      currency: "usd",
      amountTotalMinor: 79900,
      lines: [{ label: "Compliance bundle", amountMinor: 79900 }],
      dashboardUrl: URL,
    });
    expect(rendered.subject).toBe("Your Caisson order ord_42 is confirmed");
    expect(rendered.html).toContain("ord_42");
    expect(rendered.html).toContain("Compliance bundle");
    expect(rendered.html).toContain("799.00 USD");
    // The install command every other surface teaches (the create-caisson name is retired).
    expect(rendered.text).toContain("bunx @caisson-sh/cli@latest");
  });

  test("purchase-confirmation: a line with no per-line amount renders its label alone", async () => {
    const rendered = await renderEmailTemplate("purchase-confirmation", {
      buyerName: "Ada",
      orderId: "ord_43",
      currency: "usd",
      amountTotalMinor: 79900,
      lines: [{ label: "Compliance bundle" }],
      dashboardUrl: URL,
    });
    expect(rendered.html).toContain("Compliance bundle");
    expect(rendered.html).toContain("Total charged");
    expect(rendered.html).toContain("799.00 USD");
  });

  test("subscription-payment-received: recurring-payment copy, order id + total, NOT the first-purchase heading (CAISSON-27)", async () => {
    const rendered = await renderEmailTemplate(
      "subscription-payment-received",
      {
        buyerName: "Ada",
        orderId: "txn_cycle_9",
        currency: "usd",
        amountTotalMinor: 149900,
        lines: [{ label: "Compliance Updates" }],
        dashboardUrl: URL,
      },
    );
    expect(rendered.subject).toBe(
      "Your Caisson subscription payment txn_cycle_9 was received",
    );
    expect(rendered.html).toContain("Subscription payment received");
    expect(rendered.html).toContain("txn_cycle_9");
    expect(rendered.html).toContain("1499.00 USD");
    // Distinct from the first-purchase receipt — never the "Purchase confirmed" heading.
    expect(rendered.html).not.toContain("Purchase confirmed");
    expect(rendered.text).toContain("bunx @caisson-sh/cli@latest");
  });

  test("renewal-confirmation: subject + body carry the order id, renewed line, window date, and total (ADR-0251)", async () => {
    const rendered = await renderEmailTemplate("renewal-confirmation", {
      buyerName: "Ada",
      orderId: "ord_ren_42",
      currency: "usd",
      amountTotalMinor: 29900,
      lines: [{ label: "Compliance bundle", newWindowEnd: "2028-01-15" }],
      dashboardUrl: URL,
    });
    expect(rendered.subject).toBe(
      "Your Caisson renewal ord_ren_42 is confirmed",
    );
    expect(rendered.html).toContain("ord_ren_42");
    expect(rendered.html).toContain("Compliance bundle");
    expect(rendered.html).toContain("2028-01-15");
    expect(rendered.html).toContain("299.00 USD");
    expect(rendered.text).toContain("bunx @caisson-sh/cli@latest");
  });

  test("renewal-confirmation: an omitted total (mixed cart) renders no 'Total charged' line", async () => {
    // On a mixed cart the purchase receipt owns the whole-event total; a second email repeating
    // it would read as a double charge.
    const rendered = await renderEmailTemplate("renewal-confirmation", {
      buyerName: "Ada",
      orderId: "ord_ren_43",
      currency: "usd",
      lines: [{ label: "Compliance", newWindowEnd: "2028-01-15" }],
      dashboardUrl: URL,
    });
    expect(rendered.html).toContain("2028-01-15");
    expect(rendered.html).not.toContain("Total charged");
  });

  test("access-revoked: refund copy, subject + heading distinct from a cancel (G27)", async () => {
    const rendered = await renderEmailTemplate("access-revoked", {
      buyerName: "Ada",
      reason: "refund",
      dashboardUrl: URL,
    });
    expect(rendered.subject).toBe("Your Caisson refund has been processed");
    expect(rendered.html).toContain("Refund processed");
    expect(rendered.html).toContain("refund has been processed");
  });

  test("access-revoked: subscription-canceled copy is distinct from a refund (G27)", async () => {
    const rendered = await renderEmailTemplate("access-revoked", {
      buyerName: "Ada",
      reason: "subscription_canceled",
      dashboardUrl: URL,
    });
    expect(rendered.subject).toBe(
      "Your Caisson subscription has been canceled",
    );
    expect(rendered.html).toContain("Subscription canceled");
    expect(rendered.html).not.toContain("Refund processed");
  });

  test("waitlist-welcome: subject + body carry the bundle label and recipient", async () => {
    const rendered = await renderEmailTemplate("waitlist-welcome", {
      email: "founder@acme.com",
      bundle: "Compliance",
    });
    expect(rendered.subject).toBe(
      "You're on the Caisson Compliance early-access list",
    );
    expect(rendered.html).toContain("founder@acme.com");
    expect(rendered.html).toContain("Caisson Compliance");
  });

  test("waitlist-welcome: an omitted bundle reads as the general Caisson list", async () => {
    const rendered = await renderEmailTemplate("waitlist-welcome", {
      email: "founder@acme.com",
    });
    expect(rendered.subject).toBe("You're on the Caisson early-access list");
  });

  test("nurture-follow-up: subject + body carry the bundle label and recipient", async () => {
    const rendered = await renderEmailTemplate("nurture-follow-up", {
      email: "cto@acme.com",
      bundle: "Compliance",
    });
    expect(rendered.subject).toBe(
      "What Caisson Compliance ships, and what it doesn't",
    );
    expect(rendered.html).toContain("cto@acme.com");
    expect(rendered.html).toContain("fail-closed");
  });

  test("abandoned-checkout: flat statement, line items, cart CTA — no urgency copy", async () => {
    const rendered = await renderEmailTemplate("abandoned-checkout", {
      buyerName: "Ada",
      lines: [{ label: "Compliance bundle" }],
      url: URL,
    });
    expect(rendered.subject).toBe("Your cart is still here");
    expect(rendered.html).toContain("Compliance bundle");
    expect(rendered.html).toContain("Return to cart");
    for (const urgent of ["act now", "hurry", "expires soon", "countdown"]) {
      expect(rendered.html.toLowerCase()).not.toContain(urgent);
    }
  });

  test("abandoned-checkout: an omitted discount pair renders no discount sentence", async () => {
    const rendered = await renderEmailTemplate("abandoned-checkout", {
      buyerName: "Ada",
      lines: [{ label: "Compliance bundle" }],
      url: URL,
    });
    expect(rendered.html).not.toContain("promo=");
  });

  test("abandoned-checkout: a configured discount renders the label + promo link", async () => {
    const rendered = await renderEmailTemplate("abandoned-checkout", {
      buyerName: "Ada",
      lines: [{ label: "Compliance bundle" }],
      url: URL,
      discountLabel: "10% off",
      discountUrl: `${URL}?promo=SAVE10`,
    });
    expect(rendered.html).toContain("10% off");
    expect(rendered.html).toContain("promo=SAVE10");
  });

  // Guards the security-floor fix an earlier standalone-HTML version of these two templates
  // needed (a caller-supplied email reaching raw HTML unescaped): react-email/JSX auto-escapes
  // every text child, so a script-shaped email must render as inert text, never live markup.
  test("waitlist-welcome + nurture-follow-up: a script-shaped email never renders unescaped", async () => {
    const maliciousEmail = "<script>alert(1)</script>@evil.com";
    const welcome = await renderEmailTemplate("waitlist-welcome", {
      email: maliciousEmail,
    });
    expect(welcome.html).not.toContain("<script>alert(1)</script>");
    expect(welcome.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");

    const nurture = await renderEmailTemplate("nurture-follow-up", {
      email: maliciousEmail,
    });
    expect(nurture.html).not.toContain("<script>alert(1)</script>");
    expect(nurture.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("tryRenderEmailTemplate", () => {
  test("renders credits-expiring from free-form driver data with the right shape", async () => {
    const rendered = await tryRenderEmailTemplate("credits-expiring", {
      credits: 45,
      expiresOn: "2027-01-02",
      url: URL,
    });
    expect(rendered?.subject).toBe("45 credits expire on 2027-01-02");
  });

  test("falls back to null on a shape mismatch (a url alone is not this template)", async () => {
    expect(await tryRenderEmailTemplate("credits-expiring", { url: URL })).toBe(
      null,
    );
    // The auth templates still gate on url presence.
    expect(await tryRenderEmailTemplate("magic-link", { nope: 1 })).toBe(null);
  });

  test("purchase-confirmation: renders from free-form driver data, falls back to null on a bad line shape", async () => {
    const rendered = await tryRenderEmailTemplate("purchase-confirmation", {
      buyerName: "Ada",
      orderId: "ord_42",
      currency: "usd",
      amountTotalMinor: 79900,
      lines: [{ label: "Compliance bundle", amountMinor: 79900 }],
      dashboardUrl: URL,
    });
    expect(rendered?.subject).toBe("Your Caisson order ord_42 is confirmed");

    expect(
      await tryRenderEmailTemplate("purchase-confirmation", {
        buyerName: "Ada",
        orderId: "ord_42",
        currency: "usd",
        amountTotalMinor: 79900,
        lines: [{ label: "Compliance bundle", amountMinor: 799.5 }],
        dashboardUrl: URL,
      }),
    ).toBe(null);
  });

  test("renewal-confirmation: renders from free-form driver data, falls back to null on a bad line shape", async () => {
    const rendered = await tryRenderEmailTemplate("renewal-confirmation", {
      buyerName: "Ada",
      orderId: "ord_ren_42",
      currency: "usd",
      amountTotalMinor: 29900,
      lines: [{ label: "Compliance bundle", newWindowEnd: "2028-01-15" }],
      dashboardUrl: URL,
    });
    expect(rendered?.subject).toBe(
      "Your Caisson renewal ord_ren_42 is confirmed",
    );

    expect(
      await tryRenderEmailTemplate("renewal-confirmation", {
        buyerName: "Ada",
        orderId: "ord_ren_42",
        currency: "usd",
        amountTotalMinor: 29900,
        lines: [{ label: "Compliance bundle" }], // missing newWindowEnd
        dashboardUrl: URL,
      }),
    ).toBe(null);
  });

  test("abandoned-checkout: a half-set discount pair (label with no url, or vice versa) fails closed", async () => {
    const base = {
      buyerName: "Ada",
      lines: [{ label: "Compliance bundle" }],
      url: URL,
    };
    expect(
      await tryRenderEmailTemplate("abandoned-checkout", {
        ...base,
        discountLabel: "10% off",
      }),
    ).toBe(null);
    expect(
      await tryRenderEmailTemplate("abandoned-checkout", {
        ...base,
        discountUrl: `${URL}?promo=SAVE10`,
      }),
    ).toBe(null);
    expect(await tryRenderEmailTemplate("abandoned-checkout", base)).not.toBe(
      null,
    );
  });
});
