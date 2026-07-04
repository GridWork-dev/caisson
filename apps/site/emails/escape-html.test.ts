// Guards the D1 security-floor fix (ADR-0233 audit, findings e629f41681647152 /
// 6ca95b078e8b2c69): buyer-supplied `email` must never reach the rendered HTML unescaped.
// Feeds an XSS-shaped email into both sibling templates and asserts the literal tag never
// survives — only its HTML-entity encoding does.
import { expect, test } from "bun:test";
import { buildWaitlistWelcome } from "./waitlist-welcome.ts";
import { buildNurtureFollowUp } from "./nurture-follow-up.ts";

const maliciousEmail = "<script>alert(1)</script>@evil.com";

test("buildWaitlistWelcome escapes a script-tag email", () => {
  const html = buildWaitlistWelcome({ email: maliciousEmail });
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
});

test("buildNurtureFollowUp escapes a script-tag email at both interpolation sites", () => {
  const html = buildNurtureFollowUp({ email: maliciousEmail });
  expect(html).not.toContain("<script>alert(1)</script>");
  // Two email interpolation sites in this template (salutation + footer) — both must be escaped.
  const occurrences =
    html.split("&lt;script&gt;alert(1)&lt;/script&gt;").length - 1;
  expect(occurrences).toBe(2);
});
