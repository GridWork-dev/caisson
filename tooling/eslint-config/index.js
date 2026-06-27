/**
 * @stack/eslint-config — the single ESLint standards source (ADR-0002). Every package extends it.
 *
 * OWNERSHIP: the foundations track owns the strict base (typescript-eslint strict + the
 * no-any/no-console floor) per ADR-0002; the D9 module-standards track owns `boundaries.js`
 * (the import-boundary rules, ADR-0022). Keep the two in separate files to avoid a cross-track
 * merge conflict — foundations PREPENDS its base array at the MERGE POINT below.
 */
import { boundaries } from "./boundaries.js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ── MERGE POINT (foundations, ADR-0002): spread the strict base config array here ──
  // ...strictBase,
  ...boundaries,
];
