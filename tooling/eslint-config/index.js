// @caisson/eslint-config — the single ESLint standards source (ADR-0002) + the import-boundary
// rules (ADR-0022). Two-track ownership composed here:
//   - Foundations owns the strict base (typescript-eslint strict + the no-any/no-console floor).
//   - D9 module-standards owns `boundaries.js` (the provider-SDK import boundary, ADR-0011/0022).
// Flat config. Type-checked rules are deferred (P3) to keep the gate fast + robust; `tsc --strict`
// (the build task) is the deep type-safety floor. These rules enforce the engineering invariants
// that are syntactic: no-any, no-console, type-only import discipline.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { boundaries } from "./boundaries.js";
import { antiSlop } from "./anti-slop.js";

/** @type {import("typescript-eslint").ConfigArray} */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // ADR-0002: no `any`, no `console.log` in product code.
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
      // verbatimModuleSyntax + isolatedModules want explicit type-only imports.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Test files may use console for harness diagnostics and looser typing.
    files: ["**/*.test.ts", "**/*.integration.test.ts", "**/__golden__/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // CLI entrypoints + build/gen scripts legitimately print to stdout (the "no-console" rule
    // targets library code).
    files: ["**/gate.ts", "**/bin/**", "**/*.cli.ts", "**/scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // jsx-a11y recommended (Kickoff T task 14 — verified gap: the kit ships a11y-conscious
    // components with no static a11y lint floor). Scoped to JSX surfaces; the plugin's flat
    // config carries no `files` key of its own, so we add one.
    // RAMP (wave constraint, 2026-07-13): severities are mapped to "warn" because the remaining
    // violations live in packages/ui and apps/site — frozen trees owned by the parallel design
    // session this wave. Reconcile session: fix those, then delete the mapping below so the
    // plugin's own "error" severities gate the repo. ui-pro's violations were fixed in-wave.
    files: ["**/*.tsx", "**/*.jsx"],
    ...jsxA11y.flatConfigs.recommended,
    rules: Object.fromEntries(
      Object.entries(jsxA11y.flatConfigs.recommended.rules).map(
        ([id, level]) => {
          const severity = Array.isArray(level) ? level[0] : level;
          if (severity === "off" || severity === 0) return [id, "off"];
          return [
            id,
            Array.isArray(level) ? ["warn", ...level.slice(1)] : "warn",
          ];
        },
      ),
    ),
  },
  // D9 import-boundary rules (ADR-0011/0022): provider-SDK denylist. Static backstop;
  // dependency-cruiser is the authoritative dynamic/transitive layer.
  ...boundaries,
  // Anti-slop AST guard (ADR-0101 gate #3): bans inline-style / raw-colour / AI-slop copy in kit
  // components — the recipe (ADR-0099) enforced statically. Scoped to packages/ui today (staged).
  ...antiSlop,
  {
    ignores: ["dist/**", "**/*.d.ts", "migrations/**", "**/__golden__/**"],
  },
);
