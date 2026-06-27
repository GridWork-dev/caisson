// @stack/eslint-config — the single lint standard (ADR-0002).
// Flat config. Type-checked rules are deferred (P3) to keep the gate fast + robust;
// `tsc --strict` (the build task) is the deep type-safety floor. These rules enforce the
// engineering invariants that are syntactic: no-any, no-console, type-only import discipline.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

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
    // CLI entrypoints legitimately print to stdout (the "no-console" rule targets library code).
    files: ["**/gate.ts", "**/bin/**", "**/*.cli.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/**", "**/*.d.ts", "migrations/**", "**/__golden__/**"],
  },
);
