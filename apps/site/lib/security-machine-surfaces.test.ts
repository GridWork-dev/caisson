import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { faqPage } from "./jsonld.ts";

interface SecurityClaims {
  SECURITY_META_DESCRIPTION: string;
  SECURITY_LLMS_SUMMARY: string;
  ADMIN_SECURITY_POSTURE: { title: string; body: string };
  ADMIN_SECURITY_FAQ: { question: string; answer: string };
  SECURITY_FAQ: ReadonlyArray<{ question: string; answer: string }>;
}

const claimsModule = await import("./security-copy.ts").catch(() => null);
const pageModule = await import("../app/security/page.tsx");
const llmsModule = await import("../app/llms.txt/route.ts");

function claims(): SecurityClaims {
  expect(claimsModule).not.toBeNull();
  if (claimsModule === null) {
    throw new Error("shared security machine-surface copy is not implemented");
  }
  return claimsModule as SecurityClaims;
}

describe("security claims stay identical across human and machine surfaces", () => {
  test("metadata describes Railway now and hedges Cloud Run edge gates", () => {
    const copy = claims();
    const metadata = pageModule.metadata as {
      description?: unknown;
      openGraph?: { description?: unknown };
      twitter?: { description?: unknown };
    };

    expect(metadata.description).toBe(copy.SECURITY_META_DESCRIPTION);
    expect(metadata.openGraph?.description).toBe(
      copy.SECURITY_META_DESCRIPTION,
    );
    expect(metadata.twitter?.description).toBe(copy.SECURITY_META_DESCRIPTION);
    expect(copy.SECURITY_META_DESCRIPTION).toContain("Railway");
    expect(copy.SECURITY_META_DESCRIPTION).toContain("Cloud Run");
  });

  test("llms.txt carries the same current-versus-future admin posture", async () => {
    const copy = claims();
    const response = llmsModule.GET();
    const text = await response.text();

    expect(text).toContain("[Security](/security)");
    expect(text).toContain(copy.SECURITY_LLMS_SUMMARY);
  });

  test("visible FAQ and FAQPage JSON-LD consume the one shared answer", () => {
    const copy = claims();
    const pageSource = readFileSync(
      new URL("../app/security/page.tsx", import.meta.url),
      "utf8",
    );
    const schema = faqPage(copy.SECURITY_FAQ);
    const adminQuestion = schema.mainEntity.find(
      (entry) => entry.name === copy.ADMIN_SECURITY_FAQ.question,
    );

    expect(pageSource).toMatch(/faqPage\(SECURITY_FAQ\)/);
    expect(pageSource).toMatch(/<Faq\s+items=\{SECURITY_FAQ\}/);
    // ADMIN_SECURITY_POSTURE sits in the SecurityClaims contract above but was asserted on no
    // surface, so inlining a stale literal over the shared constant kept all three tests green
    // while the rendered posture card shipped a claim that is false without CF_ACCESS_REQUIRED.
    expect(pageSource).toMatch(/\.\.\.ADMIN_SECURITY_POSTURE/);
    expect(adminQuestion?.acceptedAnswer.text).toBe(
      copy.ADMIN_SECURITY_FAQ.answer,
    );
  });
});
