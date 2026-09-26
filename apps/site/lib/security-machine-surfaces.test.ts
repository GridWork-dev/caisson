import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { GET as llmsTxt } from "../app/llms.txt/route.ts";
import { metadata } from "../app/security/page.tsx";
import { faqPage } from "./jsonld.ts";
import {
  SECURITY_FAQ,
  SECURITY_LLMS_SUMMARY,
  SECURITY_META_DESCRIPTION,
  SITE_SECURITY_FAQ,
} from "./security-copy.ts";

describe("security claims stay identical across human and machine surfaces", () => {
  test("metadata describes the static site from the shared copy", () => {
    const meta = metadata as {
      description?: unknown;
      openGraph?: { description?: unknown };
      twitter?: { description?: unknown };
    };
    expect(meta.description).toBe(SECURITY_META_DESCRIPTION);
    expect(meta.openGraph?.description).toBe(SECURITY_META_DESCRIPTION);
    expect(meta.twitter?.description).toBe(SECURITY_META_DESCRIPTION);
    expect(SECURITY_META_DESCRIPTION).toContain("static");
  });

  test("llms.txt carries the same site posture", async () => {
    const text = await llmsTxt().text();
    expect(text).toContain("[Security](/security)");
    expect(text).toContain(SECURITY_LLMS_SUMMARY);
  });

  test("visible FAQ and FAQPage JSON-LD consume the one shared answer", () => {
    const pageSource = readFileSync(
      new URL("../app/security/page.tsx", import.meta.url),
      "utf8",
    );
    const siteQuestion = faqPage(SECURITY_FAQ).mainEntity.find(
      (entry) => entry.name === SITE_SECURITY_FAQ.question,
    );
    expect(pageSource).toMatch(/faqPage\(SECURITY_FAQ\)/);
    expect(pageSource).toMatch(/<Faq\s+items=\{SECURITY_FAQ\}/);
    expect(siteQuestion?.acceptedAnswer.text).toBe(SITE_SECURITY_FAQ.answer);
  });
});
