import { describe, expect, test } from "bun:test";
import { EMAIL_TEMPLATE_IDS, renderEmailTemplate } from "./index.ts";

describe("renderEmailTemplate", () => {
  for (const id of EMAIL_TEMPLATE_IDS) {
    test(`${id}: html and text both carry the action url, subject is non-empty`, async () => {
      const url = "https://caisson.sh/action?token=sample";
      const rendered = await renderEmailTemplate(id, { url });
      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.html).toContain(url);
      expect(rendered.html).toContain("Caisson");
      expect(rendered.text).toContain(url);
      // The HTML and text fallback are rendered from the SAME element — never drift.
      expect(rendered.text).not.toContain("<html");
    });
  }
});
