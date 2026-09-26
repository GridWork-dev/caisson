// Extraction-integrity check: the bespoke glyph set is the brand's registrable IP, so a dropped or
// renamed glyph is a real regression (the kit renders `null` for an unregistered name). Pins the 37
// domain names + that each entry is a render function, and that the lockup exports survive the move.
import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Glyph, Wordmark, brandGlyphs } from "./index.ts";

const EXPECTED_NAMES = [
  "rls",
  "worm",
  "audit-chain",
  "fail-closed",
  "field-crypto",
  "evidence-pack",
  "caisson",
  "retention-runner",
  "alerting",
  "ai-meter",
  "ai-evals",
  "guardrails",
  "prompt-registry",
  "local-store",
  "agent-kernel",
  "agent-runner",
  "bundle",
  "plan-tier",
  "edition-compliance",
  "edition-ai-kit",
  "edition-local-ai",
  "edition-agent-dev",
  "access-review",
  "risk-register",
  "trust-page",
  "agent-trajectory",
  "tool-exec",
  "org-controls",
  "compliance-core",
  "billing-orchestration",
  "ui-pro",
  "local-inference",
  "local-privacy",
  "local-sync",
  "frameworks-pack",
  "signing-primitive",
  "credits",
] as const;

const MODULE_DEPTH_NAMES = [
  "access-review",
  "risk-register",
  "trust-page",
] as const;

function renderModuleDepthGlyphs(theme: "dark" | "light"): string {
  return renderToStaticMarkup(
    createElement(
      "section",
      { "data-theme": theme, style: { color: "var(--cs-fg)" } },
      ...MODULE_DEPTH_NAMES.map((name) =>
        createElement(brandGlyphs[name], {
          key: name,
          className: "cs-icon",
          "data-size": "lg",
          role: "img",
          "aria-label": name,
        }),
      ),
    ),
  );
}

describe("@caisson-sh/brand glyph set", () => {
  test("exports exactly the 37 bespoke domain glyphs", () => {
    expect(Object.keys(brandGlyphs).sort()).toEqual([...EXPECTED_NAMES].sort());
  });

  test("every glyph is a render function", () => {
    for (const name of EXPECTED_NAMES) {
      expect(typeof brandGlyphs[name]).toBe("function");
    }
  });

  test("the module-depth glyphs stay on the 24px currentColor line contract", () => {
    for (const name of MODULE_DEPTH_NAMES) {
      const html = renderToStaticMarkup(brandGlyphs[name]({}));
      expect(html).toContain('viewBox="0 0 24 24"');
      expect(html).toContain('fill="none"');
      expect(html).toContain('stroke="currentColor"');
      expect(html).not.toMatch(/#[\da-f]{3,8}|(?:rgb|hsl|oklch)\(/i);
    }
  });

  test("the module-depth glyphs render token-following snapshots in both modes", () => {
    expect(renderModuleDepthGlyphs("dark")).toMatchSnapshot("dark");
    expect(renderModuleDepthGlyphs("light")).toMatchSnapshot("light");
  });

  test("the brand lockup exports survive the move", () => {
    expect(Glyph).toBeDefined();
    expect(Wordmark).toBeDefined();
  });
});
