// Extraction-integrity check: the bespoke glyph set is the brand's registrable IP, so a dropped or
// renamed glyph is a real regression (the kit renders `null` for an unregistered name). Pins the 22
// domain names + that each entry is a render function, and that the lockup exports survive the move.
import { describe, expect, test } from "bun:test";

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
] as const;

describe("@caisson/brand glyph set", () => {
  test("exports exactly the 22 bespoke domain glyphs", () => {
    expect(Object.keys(brandGlyphs).sort()).toEqual([...EXPECTED_NAMES].sort());
  });

  test("every glyph is a render function", () => {
    for (const name of EXPECTED_NAMES) {
      expect(typeof brandGlyphs[name]).toBe("function");
    }
  });

  test("the brand lockup exports survive the move", () => {
    expect(Glyph).toBeDefined();
    expect(Wordmark).toBeDefined();
  });
});
