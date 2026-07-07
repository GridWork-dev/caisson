import { describe, expect, test } from "bun:test";
import {
  EMAIL_TEMPLATE_IDS,
  renderEmailTemplate,
  tryRenderEmailTemplate,
  type EmailTemplateId,
  type TemplateDataMap,
} from "./index.ts";

const URL = "https://caisson.sh/action?token=sample";

const SAMPLE: { [K in EmailTemplateId]: TemplateDataMap[K] } = {
  "magic-link": { url: URL },
  "password-reset": { url: URL },
  "verify-email": { url: URL },
  "credits-expiring": { credits: 120, expiresOn: "2027-07-06", url: URL },
  "purchase-confirmation": {
    buyerName: "Ada",
    orderId: "ord_sample",
    currency: "usd",
    amountTotalMinor: 79900,
    lines: [{ label: "Compliance bundle", amountMinor: 79900 }],
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
};

describe("renderEmailTemplate", () => {
  for (const id of EMAIL_TEMPLATE_IDS) {
    test(`${id}: html and text both carry the action url, subject is non-empty`, async () => {
      const rendered = await renderEmailTemplate(id, SAMPLE[id]);
      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.html).toContain(URL);
      expect(rendered.html).toContain("Caisson");
      expect(rendered.text).toContain(URL);
      // The HTML and text fallback are rendered from the SAME element — never drift.
      expect(rendered.text).not.toContain("<html");
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
});
