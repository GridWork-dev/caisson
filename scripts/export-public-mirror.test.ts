import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  MIRROR_ASSET_FILES,
  resolveCatalogSpec,
  rewriteProseMentions,
  sanitizeAdrCitations,
  sanitizeSourceComments,
} from "./export-public-mirror.ts";

const MIRROR_ASSETS_DIR = join(import.meta.dir, "mirror-assets");

describe("rewriteProseMentions", () => {
  const open = new Set(["kernel", "ai-config", "license-verify"]);

  test("renames an open mention mid-sentence", () => {
    expect(rewriteProseMentions("use @caisson/kernel here", open)).toBe(
      "use @caisson-sh/kernel here",
    );
  });

  test("renames a sentence-final open mention WITHOUT swallowing the period", () => {
    // The bug: `[\w.-]+` captured `kernel.`, missed the allowlist, shipped @caisson/kernel. as-is.
    expect(rewriteProseMentions("built on @caisson/kernel.", open)).toBe(
      "built on @caisson-sh/kernel.",
    );
    expect(rewriteProseMentions("see @caisson/license-verify.", open)).toBe(
      "see @caisson-sh/license-verify.",
    );
  });

  test("leaves a commercial (non-open) mention at @caisson/*", () => {
    expect(rewriteProseMentions("needs @caisson/compliance.", open)).toBe(
      "needs @caisson/compliance.",
    );
  });

  test("preserves the hyphen inside a kebab slug", () => {
    expect(rewriteProseMentions("@caisson/ai-config, then done", open)).toBe(
      "@caisson-sh/ai-config, then done",
    );
  });
});

describe("sanitizeAdrCitations", () => {
  test("strips a single bare ADR-id parenthetical", () => {
    expect(
      sanitizeAdrCitations(
        "any path is constructed or any subprocess spawned (ADR-0021).",
      ),
    ).toBe("any path is constructed or any subprocess spawned.");
  });

  test("strips a multi-id parenthetical (slash-separated)", () => {
    expect(
      sanitizeAdrCitations("a different discipline (ADR-0010/0015)."),
    ).toBe("a different discipline.");
  });

  test("strips a parenthetical with a short internal phase code plus ids", () => {
    expect(
      sanitizeAdrCitations("the credit ledger (P6, ADR-0089/0017) closes."),
    ).toBe("the credit ledger closes.");
  });

  test("leaves a parenthetical that mixes prose with an ADR id untouched", () => {
    const text = "read the invariant (see ADR-0072 for details) first.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("leaves a non-ADR parenthetical untouched", () => {
    const text =
      "Asymmetric (Ed25519 license) verification is NOT here: it uses crypto.verify.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("collapses the double space left by a removed mid-sentence parenthetical", () => {
    expect(
      sanitizeAdrCitations("debits once (ADR-0024)  — safe to retry."),
    ).toBe("debits once — safe to retry.");
  });

  test("is a no-op on prose with no parentheticals", () => {
    const text = "Validate every input with Zod at the API boundary.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("leaves unrelated markdown list-continuation indentation untouched", () => {
    const text = [
      "- **Allowlist BEFORE side effects.** Always go through `generate`: every module",
      "  id + version is validated against the registry index (ADR-0021).",
      "  Never build a path from an unvalidated id/version.",
    ].join("\n");
    const after = sanitizeAdrCitations(text);
    expect(after).toContain("\n  id + version is validated");
    expect(after).toContain("\n  Never build a path");
    expect(after).not.toContain("ADR-0021");
  });

  // Regression: two whole-document cleanup passes (empty-parens strip, space-before-punct strip)
  // used to run after the citation removal and silently corrupted any real `()` call or
  // space-before-punctuation ANYWHERE in the text — not just next to a stripped citation. Fixed by
  // moving the cleanup inside the removal callback, scoped to only the removal site.
  test("leaves real API syntax with empty parens intact when nowhere near a citation", () => {
    const cases = [
      "Validate every input with `z.object().strict()` at the boundary.",
      "IDs come from `crypto.randomUUID()`, never Math.random.",
      "Call `initObservability()` once at process start.",
      "The teardown hook runs `cleanup()` before exit.",
      "The lint pass covers every source file (not .tsx files, those are excluded).",
    ];
    for (const text of cases) {
      expect(sanitizeAdrCitations(text)).toBe(text);
    }
  });

  test("strips a real ADR citation while leaving unrelated () syntax elsewhere in the same text intact", () => {
    const text =
      "Debit before spend (ADR-0049/0007). Validate with `z.object().strict()` and `crypto.randomUUID()` for ids.";
    const after = sanitizeAdrCitations(text);
    expect(after).toBe(
      "Debit before spend. Validate with `z.object().strict()` and `crypto.randomUUID()` for ids.",
    );
  });
});

describe("resolveCatalogSpec", () => {
  const catalogConfig = {
    catalog: { zod: "^3.23.8", typescript: "^5.7.3" },
    catalogs: { zod4: { zod: "^4.0.0" } },
  };

  test("passes a non-catalog specifier through unchanged", () => {
    expect(resolveCatalogSpec("zod", "^3.23.0", catalogConfig)).toBe("^3.23.0");
  });

  test("resolves the default catalog specifier to its concrete range", () => {
    expect(resolveCatalogSpec("zod", "catalog:", catalogConfig)).toBe(
      "^3.23.8",
    );
  });

  test("resolves a named catalog specifier (catalog:<name>)", () => {
    expect(resolveCatalogSpec("zod", "catalog:zod4", catalogConfig)).toBe(
      "^4.0.0",
    );
  });

  test("throws on a default catalog specifier with no matching entry", () => {
    expect(() =>
      resolveCatalogSpec("left-pad", "catalog:", catalogConfig),
    ).toThrow(/Unresolvable catalog specifier/);
  });

  test("throws on a named catalog specifier with no matching table", () => {
    expect(() =>
      resolveCatalogSpec("zod", "catalog:missing", catalogConfig),
    ).toThrow(/Unresolvable catalog specifier/);
  });
});

describe("sanitizeSourceComments", () => {
  test("sanitizes a bare ADR-id parenthetical inside a line comment only", () => {
    const code = [
      "// Asymmetric (Ed25519 license) verification is NOT here: it uses `crypto.verify`, a different",
      "// discipline (ADR-0010/0015).",
      "import { createHash, timingSafeEqual } from 'node:crypto';",
    ].join("\n");
    const after = sanitizeSourceComments(code);
    expect(after).toContain("// Asymmetric (Ed25519 license) verification");
    expect(after).toContain("// discipline.");
    expect(after).not.toContain("ADR-0010");
    // Code outside the comment is untouched.
    expect(after).toContain(
      "import { createHash, timingSafeEqual } from 'node:crypto';",
    );
  });

  test("sanitizes inside a block comment without touching adjacent code", () => {
    const code = [
      "/**",
      " * Debit before spend (ADR-0049/0007).",
      " */",
      "export function run(): void {}",
    ].join("\n");
    const after = sanitizeSourceComments(code);
    expect(after).toContain(" * Debit before spend.");
    expect(after).toContain("export function run(): void {}");
  });

  test("never mistakes a https:// URL string for a line comment", () => {
    const code = 'const DOCS_URL = "https://caisson.sh/docs"; // stable link';
    expect(sanitizeSourceComments(code)).toBe(code);
  });

  test("never mistakes a string literal's raw comment-lookalike text for a real comment", () => {
    // Regression: a string literal containing `*/`/`/*` used to be misread as spanning into the
    // next real block comment, and the empty-parens cleanup then stripped `()` out of real code
    // caught in that false span (found live in packages/cli/src/demo.test.ts's hostile-string
    // fixture: `expect(stub).toBeDefined();` was corrupted to `expect(stub).toBeDefined;`).
    const code = [
      "const injected = '*/ throw new Error(\"INJECTED\"); /*';",
      "/**",
      " * Debit before spend (ADR-0049).",
      " */",
      "expect(stub).toBeDefined();",
    ].join("\n");
    const after = sanitizeSourceComments(code);
    expect(after).toContain(
      "const injected = '*/ throw new Error(\"INJECTED\"); /*';",
    );
    expect(after).toContain(" * Debit before spend.");
    expect(after).toContain("expect(stub).toBeDefined();");
  });
});

describe("MIRROR_ASSET_FILES", () => {
  test("every listed source file exists under scripts/mirror-assets/", () => {
    for (const { src } of MIRROR_ASSET_FILES) {
      expect(existsSync(join(MIRROR_ASSETS_DIR, src))).toBe(true);
    }
  });

  // Pins the presentation-punch-list additions actually land in the export wiring, not just on
  // disk under mirror-assets/ (an asset never added to this table is silently never exported).
  test("ships the community-health + presentation assets at the expected mirror path", () => {
    const dests = MIRROR_ASSET_FILES.map((f) => f.dest);
    expect(dests).toContain("SECURITY.md");
    expect(dests).toContain("SUPPORT.md");
    expect(dests).toContain("CODE_OF_CONDUCT.md");
    expect(dests).toContain(".github/ISSUE_TEMPLATE/bug_report.md");
  });
});
