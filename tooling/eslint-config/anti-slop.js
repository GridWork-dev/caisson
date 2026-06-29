/**
 * Anti-slop AST guard (ADR-0099 gate #3) — the recipe's deterministic ESLint layer. A custom rule
 * (inline flat-config plugin, mirroring the boundaries.js precedent) bans, in KIT COMPONENT code,
 * the three slop tells ADR-0097 forbids:
 *
 *   1. inline `style={{…}}` JSX attributes — variants ride `data-*` + co-located CSS, never inline.
 *      The ONE sanctioned exception is a genuinely DYNAMIC value (Reveal's per-instance
 *      transitionDelay); reveal.tsx is scoped out.
 *   2. raw colour literals (hex / oklch / rgb / hsl) in component source — components read
 *      `var(--cs-*)` via CSS; the only legal home for a colour value is the token objects
 *      (foundation.ts / candidates.ts), which live in src/tokens, NOT src/components.
 *   3. house AI-slop copy tells in rendered JSX text.
 *
 * STAGED (ADR-0099): scoped to the kit (`packages/ui/src/components`) today — the recipe's reference
 * home; it broadens to `apps/*` once each app is rebuilt kit-first (P1.5 studio / Phase-2 site).
 * basePath is pinned to the repo root so the same absolute files match whether ESLint runs from the
 * repo root (`eslint .`) or per-package (`eslint src`, turbo) — the boundaries.js basePath lesson.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// hex (#abc / #aabbcc / #aabbccdd) OR a CSS colour function with a numeric payload. Deliberately
// excludes the ambiguous `color()` / `lab()` / `lch()` forms (rare; would risk identifier hits).
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:oklch|oklab|rgba?|hsla?)\s*\(/;

// Conservative AI-slop copy tells (whole-word, case-insensitive). Kept tight to avoid false hits;
// the marketing copy laws (ADR-0080) are the broader prose gate — this is the code-adjacent floor.
const SLOP =
  /\b(?:seamless(?:ly)?|effortless(?:ly)?|supercharges?|revolutioni[sz]e[ds]?|cutting-edge|best-in-class|world-class|game-?changers?|unlock(?:s|ing)? the power|take it to the next level|in today'?s fast-paced)\b/i;

/** @type {import("eslint").Rule.RuleModule} */
const noSlop = {
  meta: {
    type: "problem",
    docs: {
      description:
        "ban design slop in kit components: inline style, raw colour, AI-slop copy (ADR-0099 #3)",
    },
    schema: [],
    messages: {
      inlineStyle:
        "Inline `style={{…}}` is banned in kit components (recipe ADR-0097) — use a `data-*` variant + co-located CSS. Only a genuinely dynamic value may use inline style (see reveal.tsx, scoped out).",
      rawColor:
        "Raw colour literal `{{value}}` in component source (ADR-0099 #3). Components read `var(--cs-*)` via CSS; colour values live only in src/tokens.",
      slop: "AI-slop copy tell `{{value}}` in rendered text (ADR-0099 #3 / voice ADR-0080).",
    },
  },
  create(context) {
    const scanColor = (node, raw) => {
      const m = raw && raw.match(RAW_COLOR);
      if (m)
        context.report({ node, messageId: "rawColor", data: { value: m[0] } });
    };
    return {
      JSXAttribute(node) {
        if (node.name?.name === "style")
          context.report({ node, messageId: "inlineStyle" });
      },
      Literal(node) {
        if (typeof node.value === "string") scanColor(node, node.value);
      },
      TemplateElement(node) {
        scanColor(node, node.value?.raw ?? "");
      },
      JSXText(node) {
        const m = node.value.match(SLOP);
        if (m)
          context.report({ node, messageId: "slop", data: { value: m[0] } });
      },
    };
  },
};

const plugin = { rules: { "no-slop": noSlop } };

/** @type {import("eslint").Linter.Config[]} */
export const antiSlop = [
  {
    name: "caisson/anti-slop",
    basePath: REPO_ROOT,
    files: ["packages/ui/src/components/**/*.{ts,tsx}"],
    // Reveal's per-instance `transitionDelay` is the recipe's ONE sanctioned dynamic inline style.
    ignores: ["packages/ui/src/components/reveal.tsx"],
    plugins: { "caisson-slop": plugin },
    rules: { "caisson-slop/no-slop": "error" },
  },
];

export default antiSlop;
