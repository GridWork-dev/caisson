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
});
